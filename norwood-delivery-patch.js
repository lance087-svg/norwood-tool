// ============================================================
// NORWOOD SUPPLY — DELIVERY SCHEDULING PATCH v2
// norwood-delivery-patch.js
// Includes: Schedule button on invoice, Deliveries tab (office),
//           7-day schedule list, edit/cancel, driver app update
// ============================================================

(function () {

  // ── CONFIG ────────────────────────────────────────────────────────────────
  const TWILIO_ACCOUNT_SID = "YOUR_ACCOUNT_SID";
  const TWILIO_AUTH_TOKEN  = "YOUR_AUTH_TOKEN";
  const TWILIO_FROM_NUMBER = "YOUR_TWILIO_NUMBER";

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC7YaVUQTmLHAUOO5eROvJ6I_jbvJP7VJU",
    authDomain: "norwood-supply.firebaseapp.com",
    projectId: "norwood-supply",
    storageBucket: "norwood-supply.appspot.com",
    messagingSenderId: "407510932360",
    appId: "1:407510932360:web:ee4c1dde6440ede4be3db6"
  };

  const DRIVERS = [
    { id: "andre",      label: "Andre" },
    { id: "robert",     label: "Robert Bryson" },
    { id: "contractor", label: "Contractor" },
  ];

  // ── FIRESTORE ─────────────────────────────────────────────────────────────
  let _db = null;
  async function getDB() {
    if (_db) return _db;
    const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    _db = getFirestore(app);
    return _db;
  }

  async function saveDelivery(record) {
    const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const db = await getDB();
    const docRef = await addDoc(collection(db, "deliveries"), {
      ...record, status: "scheduled", createdAt: serverTimestamp(),
      smsLog: { scheduled: new Date().toISOString() }
    });
    return docRef.id;
  }

  async function loadDeliveries(days) {
    // Simplest possible query — get ALL deliveries, filter in JS
    const { collection, getDocs } =
      await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const db = await getDB();
    const today = new Date().toISOString().slice(0,10);
    const future = new Date(); future.setDate(future.getDate() + (days||7));
    const futureStr = future.toISOString().slice(0,10);
    const snap = await getDocs(collection(db, "deliveries"));
    const results = [];
    snap.forEach(d => {
      const rec = { id: d.id, ...d.data() };
      // Filter to today + 7 days in JS, exclude old cancelled
      if (rec.deliveryDate && rec.deliveryDate >= today && rec.deliveryDate <= futureStr) {
        results.push(rec);
      }
    });
    // Sort by date then stop order in JS
    results.sort((a,b) => {
      if (a.deliveryDate !== b.deliveryDate) return a.deliveryDate.localeCompare(b.deliveryDate);
      return (a.stopOrder||99) - (b.stopOrder||99);
    });
    return results;
  }

  async function updateDelivery(id, fields) {
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const db = await getDB();
    await updateDoc(doc(db, "deliveries", id), fields);
  }

  async function cancelDelivery(id) {
    await updateDelivery(id, { status: "cancelled", cancelledAt: new Date().toISOString() });
  }

  // ── SMS ───────────────────────────────────────────────────────────────────
  function smsScheduled(name, date, win) {
    const w = win ? `, ${win}` : "";
    return `Hi ${name||"valued customer"}, your Norwood Supply delivery is scheduled for ${date}${w}. We'll text you when your driver is on the way. Questions? Call (904) 768-6818.`;
  }

  async function sendSMS(to, body) {
    if (!to || to.replace(/\D/g,"").length < 10) return;
    if (!TWILIO_ACCOUNT_SID || TWILIO_ACCOUNT_SID === "YOUR_ACCOUNT_SID") {
      console.log(`[SMS STUB] To:${to}\n${body}`); return;
    }
    const digits = to.replace(/\D/g,"");
    const toNum = digits.length === 10 ? "+1"+digits : "+"+digits;
    try {
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
        method:"POST",
        headers:{
          "Authorization":"Basic "+btoa(TWILIO_ACCOUNT_SID+":"+TWILIO_AUTH_TOKEN),
          "Content-Type":"application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({To:toNum, From:TWILIO_FROM_NUMBER, Body:body})
      });
    } catch(e){ console.error("SMS error",e); }
  }

  // ── STYLES ────────────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    /* Schedule button */
    #schedule-delivery-btn{
      background:#1E70B8!important;color:#fff!important;padding:8px 16px!important;
      border-radius:5px!important;font-size:12px!important;font-weight:600!important;
      border:none!important;cursor:pointer!important;font-family:inherit!important;
    }
    #schedule-delivery-btn:hover{background:#155a94!important;}
    #schedule-delivery-btn.scheduled{background:#2d6a30!important;}

    /* Delivery strip */
    #dlv-strip{
      background:#e8f5e9;border:1.5px solid #a5d6a7;border-radius:7px;
      padding:10px 16px;margin-bottom:14px;font-size:13px;color:#2e7d32;
      display:none;align-items:center;gap:10px;
    }
    #dlv-strip.show{display:flex;}

    /* Schedule modal */
    #dlv-overlay{
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);
      z-index:9999;align-items:center;justify-content:center;
    }
    #dlv-overlay.open{display:flex;}
    #dlv-modal{
      background:#fff;border-radius:10px;width:100%;max-width:500px;
      margin:16px;box-shadow:0 8px 32px rgba(0,0,0,0.22);overflow:hidden;
      max-height:90vh;overflow-y:auto;
    }
    .dlv-mhdr{
      background:#1E70B8;color:#fff;padding:16px 20px;
      display:flex;align-items:center;justify-content:space-between;
      position:sticky;top:0;z-index:1;
    }
    .dlv-mhdr h2{font-size:16px;font-weight:700;margin:0;}
    .dlv-mhdr button{
      background:rgba(255,255,255,0.2);border:none;color:#fff;
      border-radius:50%;width:28px;height:28px;font-size:16px;cursor:pointer;
    }
    .dlv-mbody{padding:20px;}
    .dlv-fg{display:flex;flex-direction:column;gap:4px;margin-bottom:14px;}
    .dlv-lbl{font-size:11px;font-weight:700;color:#6b4f0a;text-transform:uppercase;letter-spacing:.5px;}
    .dlv-fg select,.dlv-fg input{
      padding:8px 10px;border-radius:5px;border:1.5px solid #d5c8a8;
      background:#faf8f4;font-size:13px;font-family:inherit;outline:none;width:100%;
    }
    .dlv-fg select:focus,.dlv-fg input:focus{border-color:#1E70B8;}
    .dlv-2col{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
    .dlv-mftr{
      padding:14px 20px;border-top:1px solid #f0e8d8;
      display:flex;gap:10px;justify-content:flex-end;
      background:#fff;
    }
    .dlv-mftr button{
      padding:9px 22px;border-radius:5px;border:none;
      font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;
    }
    .dlv-btn-cancel{background:#f0ece4;color:#6b5a3a;}
    .dlv-btn-save{background:#1E70B8;color:#fff;}
    .dlv-btn-save:disabled{background:#a0b8d0;cursor:not-allowed;}
    #dlv-sms-preview{
      font-size:11px;color:#555;background:#f5f0e8;border-radius:5px;
      padding:8px 10px;line-height:1.5;margin-top:2px;display:none;
    }

    /* Edit modal */
    #dlv-edit-overlay{
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);
      z-index:9999;align-items:center;justify-content:center;
    }
    #dlv-edit-overlay.open{display:flex;}
    #dlv-edit-modal{
      background:#fff;border-radius:10px;width:100%;max-width:460px;
      margin:16px;box-shadow:0 8px 32px rgba(0,0,0,0.22);overflow:hidden;
    }

    /* Deliveries page */
    #page-deliveries .dlv-day-hdr{
      background:#1a2438;color:#fff;padding:8px 14px;
      font-size:12px;font-weight:700;letter-spacing:.5px;
      text-transform:uppercase;border-radius:5px 5px 0 0;margin-top:16px;
      display:flex;justify-content:space-between;align-items:center;
    }
    #page-deliveries .dlv-day-hdr:first-child{margin-top:0;}
    .dlv-card{
      background:#fff;border:1px solid #e0d5c0;border-left:5px solid #e0d5c0;
      border-radius:0 0 5px 5px;margin-bottom:4px;overflow:hidden;
    }
    .dlv-card.status-scheduled{border-left-color:#f9a825;}
    .dlv-card.status-enroute{border-left-color:#1E70B8;}
    .dlv-card.status-delivered{border-left-color:#2d6a30;opacity:.75;}
    .dlv-card.status-cancelled{border-left-color:#ccc;opacity:.5;}
    .dlv-card-top{
      padding:12px 16px;display:flex;align-items:flex-start;
      justify-content:space-between;gap:12px;
    }
    .dlv-card-name{font-size:15px;font-weight:700;color:#1a1008;}
    .dlv-card-inv{font-size:11px;color:#8B6914;font-weight:600;margin-bottom:2px;}
    .dlv-card-meta{font-size:12px;color:#6b5a3a;margin-top:3px;line-height:1.5;}
    .dlv-pill{
      font-size:10px;font-weight:700;padding:3px 10px;border-radius:12px;
      white-space:nowrap;flex-shrink:0;
    }
    .pill-scheduled{background:#fff8e1;color:#6d4c00;border:1px solid #ffe082;}
    .pill-enroute{background:#e8f2fb;color:#155a94;border:1px solid #90caf9;}
    .pill-delivered{background:#e8f5e9;color:#2d6a30;border:1px solid #a5d6a7;}
    .pill-cancelled{background:#f5f5f5;color:#999;border:1px solid #ddd;}
    .dlv-card-actions{
      padding:8px 16px 12px;border-top:1px solid #f0e8d8;
      display:flex;gap:6px;flex-wrap:wrap;
    }
    .dlv-act-btn{
      padding:5px 12px;border-radius:4px;border:none;font-size:11px;
      font-weight:600;cursor:pointer;font-family:inherit;
    }
    .dlv-act-edit{background:#1E70B8;color:#fff;}
    .dlv-act-cancel{background:transparent;color:#c04040;border:1px solid #e08080;}
    .dlv-act-maps{background:#f0ece4;color:#1a1008;}
    .dlv-empty{
      text-align:center;padding:48px 24px;color:#a89060;
      font-size:14px;background:#fff;border-radius:8px;
      border:1px solid #e0d5c0;
    }
    .dlv-loading{text-align:center;padding:32px;color:#8B6914;font-size:13px;}
    .dlv-summary-bar{
      display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;
    }
    .dlv-stat{
      background:#fff;border:1px solid #e0d5c0;border-radius:7px;
      padding:10px 16px;flex:1;min-width:100px;text-align:center;
    }
    .dlv-stat-num{font-size:24px;font-weight:700;color:#1E70B8;}
    .dlv-stat-lbl{font-size:11px;color:#8B6914;text-transform:uppercase;letter-spacing:.5px;}
    .dlv-filters{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;}
    .dlv-filter-btn{
      padding:5px 14px;border-radius:20px;border:1.5px solid #e0d5c0;
      background:#fff;font-size:12px;font-weight:600;cursor:pointer;
      font-family:inherit;color:#6b5a3a;transition:all .15s;
    }
    .dlv-filter-btn.on{background:#1E70B8;color:#fff;border-color:#1E70B8;}
  `;
  document.head.appendChild(style);

  // ── SCHEDULE MODAL ────────────────────────────────────────────────────────
  const schedOverlay = document.createElement("div");
  schedOverlay.id = "dlv-overlay";
  schedOverlay.innerHTML = `
    <div id="dlv-modal">
      <div class="dlv-mhdr">
        <h2>🚚 Schedule Delivery</h2>
        <button onclick="NWDelivery.closeModal()">✕</button>
      </div>
      <div class="dlv-mbody">
        <div id="dlv-ref" style="font-size:12px;color:#8B6914;margin-bottom:14px;font-weight:600;"></div>
        <div class="dlv-2col">
          <div class="dlv-fg">
            <label class="dlv-lbl">Delivery Date</label>
            <input type="date" id="dlv-date" onchange="NWDelivery.updatePreview()" oninput="NWDelivery.updatePreview()">
          </div>
          <div class="dlv-fg">
            <label class="dlv-lbl">Driver</label>
            <select id="dlv-driver">
              <option value="">— Select —</option>
              ${DRIVERS.map(d=>`<option value="${d.id}">${d.label}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="dlv-2col">
          <div class="dlv-fg">
            <label class="dlv-lbl">Time Window</label>
            <select id="dlv-window" onchange="NWDelivery.updatePreview()">
              <option value="">No specific window</option>
              <option value="Morning (8 AM – 12 PM)">Morning (8–12 PM)</option>
              <option value="Afternoon (12 PM – 4 PM)">Afternoon (12–4 PM)</option>
              <option value="Early Morning (7:30 – 10 AM)">Early AM (7:30–10)</option>
              <option value="Late Afternoon (2 – 5 PM)">Late PM (2–5)</option>
              <option value="All Day">All Day</option>
            </select>
          </div>
          <div class="dlv-fg">
            <label class="dlv-lbl">Stop # (order)</label>
            <input type="number" id="dlv-stop" min="1" max="20" placeholder="1 = first">
          </div>
        </div>
        <div class="dlv-fg">
          <label class="dlv-lbl">Delivery Address</label>
          <input type="text" id="dlv-addr" placeholder="Auto-filled from invoice">
        </div>
        <div class="dlv-fg">
          <label class="dlv-lbl">Customer Cell (for SMS texts)</label>
          <input type="text" id="dlv-phone" placeholder="(xxx) xxx-xxxx" oninput="NWDelivery.updatePreview()">
        </div>
        <div class="dlv-fg">
          <label class="dlv-lbl">Notes for Driver</label>
          <input type="text" id="dlv-notes" placeholder="Gate code, access, who to ask for…">
        </div>
        <div id="dlv-sms-preview">
          <strong style="color:#2d6a30">📱 Text customer will receive:</strong><br>
          <span id="dlv-sms-text"></span>
        </div>
      </div>
      <div class="dlv-mftr">
        <button class="dlv-btn-cancel" onclick="NWDelivery.closeModal()">Cancel</button>
        <button class="dlv-btn-save" id="dlv-save-btn" onclick="NWDelivery.saveDelivery()">🚚 Schedule &amp; Notify Customer</button>
      </div>
    </div>`;
  document.body.appendChild(schedOverlay);

  // ── EDIT MODAL ────────────────────────────────────────────────────────────
  const editOverlay = document.createElement("div");
  editOverlay.id = "dlv-edit-overlay";
  editOverlay.innerHTML = `
    <div id="dlv-edit-modal">
      <div class="dlv-mhdr">
        <h2>✏️ Edit Delivery</h2>
        <button onclick="NWDelivery.closeEdit()">✕</button>
      </div>
      <div class="dlv-mbody">
        <input type="hidden" id="dlv-edit-id">
        <div class="dlv-2col">
          <div class="dlv-fg">
            <label class="dlv-lbl">Delivery Date</label>
            <input type="date" id="dlv-edit-date">
          </div>
          <div class="dlv-fg">
            <label class="dlv-lbl">Driver</label>
            <select id="dlv-edit-driver">
              ${DRIVERS.map(d=>`<option value="${d.id}">${d.label}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="dlv-2col">
          <div class="dlv-fg">
            <label class="dlv-lbl">Time Window</label>
            <select id="dlv-edit-window">
              <option value="">No specific window</option>
              <option value="Morning (8 AM – 12 PM)">Morning (8–12 PM)</option>
              <option value="Afternoon (12 PM – 4 PM)">Afternoon (12–4 PM)</option>
              <option value="Early Morning (7:30 – 10 AM)">Early AM (7:30–10)</option>
              <option value="Late Afternoon (2 – 5 PM)">Late PM (2–5)</option>
              <option value="All Day">All Day</option>
            </select>
          </div>
          <div class="dlv-fg">
            <label class="dlv-lbl">Stop #</label>
            <input type="number" id="dlv-edit-stop" min="1" max="20">
          </div>
        </div>
        <div class="dlv-fg">
          <label class="dlv-lbl">Address</label>
          <input type="text" id="dlv-edit-addr">
        </div>
        <div class="dlv-fg">
          <label class="dlv-lbl">Notes for Driver</label>
          <input type="text" id="dlv-edit-notes">
        </div>
      </div>
      <div class="dlv-mftr">
        <button class="dlv-btn-cancel" onclick="NWDelivery.closeEdit()">Cancel</button>
        <button class="dlv-btn-save" id="dlv-edit-save-btn" onclick="NWDelivery.saveEdit()">💾 Save Changes</button>
      </div>
    </div>`;
  document.body.appendChild(editOverlay);

  // ── DELIVERIES PAGE HTML ──────────────────────────────────────────────────
  function buildDeliveriesPage() {
    const page = document.createElement("div");
    page.id = "page-deliveries";
    page.className = "page";
    page.style.display = "none";
    page.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div>
          <h2 style="font-size:20px;font-weight:700;margin-bottom:3px">🚚 Delivery Schedule</h2>
          <p style="color:#6b5a3a;font-size:13px">Today + next 7 days · All drivers</p>
        </div>
        <button onclick="NWDelivery.refreshSchedule()" style="background:#1E70B8;color:#fff;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:700;border:none;cursor:pointer;font-family:inherit">🔄 Refresh</button>
      </div>

      <div class="dlv-summary-bar" id="dlv-summary-bar">
        <div class="dlv-stat"><div class="dlv-stat-num" id="dlv-stat-today">—</div><div class="dlv-stat-lbl">Today</div></div>
        <div class="dlv-stat"><div class="dlv-stat-num" id="dlv-stat-upcoming">—</div><div class="dlv-stat-lbl">Upcoming</div></div>
        <div class="dlv-stat"><div class="dlv-stat-num" id="dlv-stat-delivered">—</div><div class="dlv-stat-lbl">Delivered</div></div>
        <div class="dlv-stat"><div class="dlv-stat-num" id="dlv-stat-enroute">—</div><div class="dlv-stat-lbl">En Route</div></div>
      </div>

      <div class="dlv-filters" id="dlv-filters">
        <button class="dlv-filter-btn on" onclick="NWDelivery.setFilter('all',this)">All</button>
        <button class="dlv-filter-btn" onclick="NWDelivery.setFilter('scheduled',this)">Scheduled</button>
        <button class="dlv-filter-btn" onclick="NWDelivery.setFilter('enroute',this)">En Route</button>
        <button class="dlv-filter-btn" onclick="NWDelivery.setFilter('delivered',this)">Delivered</button>
        <button class="dlv-filter-btn" onclick="NWDelivery.setFilter('andre',this)">Andre</button>
        <button class="dlv-filter-btn" onclick="NWDelivery.setFilter('robert',this)">Robert</button>
        <button class="dlv-filter-btn" onclick="NWDelivery.setFilter('contractor',this)">Contractor</button>
      </div>

      <div id="dlv-schedule-list"><div class="dlv-loading">Loading deliveries…</div></div>
    `;
    // Insert before closing of .main
    const main = document.querySelector(".main");
    if (main) main.appendChild(page);
    return page;
  }

  // ── ADD NAV TAB ───────────────────────────────────────────────────────────
  function addDeliveriesTab() {
    if (document.getElementById("tab-deliveries")) return;
    const reportsTab = document.getElementById("tab-reports") ||
                       document.querySelector(".tab:last-of-type");
    if (!reportsTab) return;
    const tab = document.createElement("button");
    tab.className = "tab";
    tab.id = "tab-deliveries";
    tab.textContent = "🚚 Deliveries";
    tab.onclick = function() {
      if (window.showPage) window.showPage("deliveries", this);
      NWDelivery.refreshSchedule();
    };
    reportsTab.insertAdjacentElement("afterend", tab);
    buildDeliveriesPage();
  }

  // ── HELPER: get current invoice data ─────────────────────────────────────
  function getInvData() {
    return {
      name:   (document.getElementById("c-name")  ||{}).value||"",
      phone:  (document.getElementById("c-phone") ||{}).value||"",
      addr:   (document.getElementById("c-shipto")||{}).value||
              (document.getElementById("c-addr")  ||{}).value||"",
      notes:  (document.getElementById("c-notes") ||{}).value||"",
      invNum: (()=>{
        const el = document.querySelector(".inv-banner-num");
        return el ? el.textContent.replace("#","").trim() : "";
      })(),
      items: (()=>{
        const rows = document.querySelectorAll("#lines-tbody tr");
        const items=[];
        rows.forEach(r=>{
          const d=r.querySelector("td:nth-child(2)");
          const q=r.querySelector("td:nth-child(3)");
          if(d) items.push({description:d.textContent.trim(),qty:parseInt((q||{}).textContent)||1});
        });
        return items;
      })()
    };
  }

  // ── FORMAT HELPERS ────────────────────────────────────────────────────────
  function fmtDate(iso) {
    return new Date(iso+"T12:00:00").toLocaleDateString("en-US",
      {weekday:"short",month:"short",day:"numeric"});
  }
  function fmtDateLong(iso) {
    return new Date(iso+"T12:00:00").toLocaleDateString("en-US",
      {weekday:"long",month:"long",day:"numeric"});
  }
  function isToday(iso) {
    return iso === new Date().toISOString().slice(0,10);
  }
  function driverLabel(id) {
    return DRIVERS.find(d=>d.id===id)?.label || id || "—";
  }
  function statusPill(status) {
    const map = {
      scheduled: ["pill-scheduled","Scheduled"],
      enroute:   ["pill-enroute","En Route"],
      delivered: ["pill-delivered","Delivered"],
      cancelled: ["pill-cancelled","Cancelled"],
    };
    const [cls,lbl] = map[status]||["pill-cancelled",status];
    return `<span class="dlv-pill ${cls}">${lbl}</span>`;
  }

  // ── PUBLIC API ────────────────────────────────────────────────────────────
  let _allDeliveries = [];
  let _activeFilter = "all";

  window.NWDelivery = {

    // ── SCHEDULE MODAL ──────────────────────────────────────────────────────
    openModal() {
      const d = getInvData();
      document.getElementById("dlv-ref").textContent =
        `Invoice: ${d.invNum||"—"}  ·  Customer: ${d.name||"—"}`;
      document.getElementById("dlv-addr").value  = d.addr  || "";
      document.getElementById("dlv-phone").value = d.phone || "";
      document.getElementById("dlv-notes").value = d.notes || "";
      document.getElementById("dlv-driver").value = "";
      document.getElementById("dlv-stop").value   = "";
      document.getElementById("dlv-window").value = "";
      const tmr = new Date(); tmr.setDate(tmr.getDate()+1);
      document.getElementById("dlv-date").value = tmr.toISOString().slice(0,10);
      this.updatePreview();
      schedOverlay.classList.add("open");
    },

    closeModal() { schedOverlay.classList.remove("open"); },

    updatePreview() {
      const phone = (document.getElementById("dlv-phone")||{}).value||"";
      const date  = (document.getElementById("dlv-date") ||{}).value||"";
      const win   = (document.getElementById("dlv-window")||{}).value||"";
      const d = getInvData();
      const preview = document.getElementById("dlv-sms-preview");
      if (phone && date) {
        document.getElementById("dlv-sms-text").textContent =
          smsScheduled(d.name, fmtDate(date), win);
        preview.style.display = "block";
      } else {
        preview.style.display = "none";
      }
    },

    async saveDelivery() {
      const btn = document.getElementById("dlv-save-btn");
      const driverId = document.getElementById("dlv-driver").value;
      const date     = document.getElementById("dlv-date").value;
      const win      = document.getElementById("dlv-window").value;
      const stop     = parseInt(document.getElementById("dlv-stop").value)||1;
      const addr     = document.getElementById("dlv-addr").value.trim();
      const phone    = document.getElementById("dlv-phone").value.trim();
      const notes    = document.getElementById("dlv-notes").value.trim();

      if (!driverId){ alert("Please select a driver."); return; }
      if (!date)    { alert("Please select a delivery date."); return; }

      btn.disabled=true; btn.textContent="Saving…";

      const d = getInvData();
      const record = {
        invoiceNumber: d.invNum, customerName: d.name,
        customerPhone: phone||d.phone, address: addr||d.addr,
        driverId, deliveryDate:date, deliveryWindow:win,
        stopOrder:stop, deliveryNotes:notes, items:d.items
      };

      try {
        await saveDelivery(record);
        await sendSMS(phone||d.phone, smsScheduled(d.name, fmtDateLong(date), win));
        this._showStrip(record, fmtDateLong(date));
        this.closeModal();
        if(window.showToast) window.showToast(`✅ Delivery scheduled for ${fmtDateLong(date)}!`,"#2d6a30");
        else alert(`✅ Delivery scheduled for ${fmtDateLong(date)}!`);
      } catch(e) {
        alert("Error saving delivery. Check console.");
        console.error(e);
      }
      btn.disabled=false; btn.textContent="🚚 Schedule & Notify Customer";
    },

    _showStrip(record, dispDate) {
      const strip = document.getElementById("dlv-strip");
      if (!strip) return;
      strip.querySelector("#dlv-strip-title").textContent = `Delivery Scheduled — ${dispDate}`;
      strip.querySelector("#dlv-strip-detail").textContent =
        `Driver: ${driverLabel(record.driverId)}${record.deliveryWindow?"  ·  "+record.deliveryWindow:""}`;
      strip.classList.add("show");
      const btn = document.getElementById("schedule-delivery-btn");
      if(btn){ btn.textContent="✅ Delivery Scheduled"; btn.classList.add("scheduled"); }
    },

    // ── EDIT MODAL ──────────────────────────────────────────────────────────
    openEdit(id) {
      const d = _allDeliveries.find(x=>x.id===id);
      if (!d) return;
      document.getElementById("dlv-edit-id").value       = id;
      document.getElementById("dlv-edit-date").value     = d.deliveryDate||"";
      document.getElementById("dlv-edit-driver").value   = d.driverId||"";
      document.getElementById("dlv-edit-window").value   = d.deliveryWindow||"";
      document.getElementById("dlv-edit-stop").value     = d.stopOrder||"";
      document.getElementById("dlv-edit-addr").value     = d.address||"";
      document.getElementById("dlv-edit-notes").value    = d.deliveryNotes||"";
      editOverlay.classList.add("open");
    },

    closeEdit() { editOverlay.classList.remove("open"); },

    async saveEdit() {
      const btn = document.getElementById("dlv-edit-save-btn");
      const id  = document.getElementById("dlv-edit-id").value;
      btn.disabled=true; btn.textContent="Saving…";
      try {
        await updateDelivery(id, {
          deliveryDate:   document.getElementById("dlv-edit-date").value,
          driverId:       document.getElementById("dlv-edit-driver").value,
          deliveryWindow: document.getElementById("dlv-edit-window").value,
          stopOrder:      parseInt(document.getElementById("dlv-edit-stop").value)||1,
          address:        document.getElementById("dlv-edit-addr").value.trim(),
          deliveryNotes:  document.getElementById("dlv-edit-notes").value.trim(),
        });
        this.closeEdit();
        await this.refreshSchedule();
        if(window.showToast) window.showToast("✅ Delivery updated","#2d6a30");
      } catch(e){ alert("Error saving."); console.error(e); }
      btn.disabled=false; btn.textContent="💾 Save Changes";
    },

    async cancelDeliveryById(id, name) {
      if (!confirm(`Cancel delivery for ${name||"this customer"}?`)) return;
      await cancelDelivery(id);
      await this.refreshSchedule();
      if(window.showToast) window.showToast("Delivery cancelled","#c04040");
    },

    // ── SCHEDULE LIST ───────────────────────────────────────────────────────
    setFilter(filter, btn) {
      _activeFilter = filter;
      document.querySelectorAll(".dlv-filter-btn").forEach(b=>b.classList.remove("on"));
      if(btn) btn.classList.add("on");
      this.renderList();
    },

    async refreshSchedule() {
      const listEl = document.getElementById("dlv-schedule-list");
      if (!listEl) return;
      listEl.innerHTML = `<div class="dlv-loading">Loading deliveries…</div>`;
      try {
        _allDeliveries = await loadDeliveries(7);
        this.renderList();
      } catch(e) {
        listEl.innerHTML = `<div class="dlv-empty">⚠️ Could not load deliveries. Check connection.</div>`;
        console.error(e);
      }
    },

    renderList() {
      const listEl = document.getElementById("dlv-schedule-list");
      if (!listEl) return;

      // Filter
      let filtered = _allDeliveries.filter(d => d.status !== "cancelled" || _activeFilter === "all");
      if (_activeFilter === "scheduled") filtered = filtered.filter(d=>d.status==="scheduled");
      else if (_activeFilter === "enroute") filtered = filtered.filter(d=>d.status==="enroute");
      else if (_activeFilter === "delivered") filtered = filtered.filter(d=>d.status==="delivered");
      else if (["andre","robert","contractor"].includes(_activeFilter))
        filtered = filtered.filter(d=>d.driverId===_activeFilter);

      // Stats
      const today = new Date().toISOString().slice(0,10);
      document.getElementById("dlv-stat-today").textContent =
        _allDeliveries.filter(d=>d.deliveryDate===today && d.status!=="cancelled").length;
      document.getElementById("dlv-stat-upcoming").textContent =
        _allDeliveries.filter(d=>d.deliveryDate>today && d.status==="scheduled").length;
      document.getElementById("dlv-stat-delivered").textContent =
        _allDeliveries.filter(d=>d.status==="delivered").length;
      document.getElementById("dlv-stat-enroute").textContent =
        _allDeliveries.filter(d=>d.status==="enroute").length;

      if (filtered.length === 0) {
        listEl.innerHTML = `<div class="dlv-empty">📭 No deliveries found for this filter.</div>`;
        return;
      }

      // Group by date
      const byDate = {};
      filtered.forEach(d => {
        if (!byDate[d.deliveryDate]) byDate[d.deliveryDate] = [];
        byDate[d.deliveryDate].push(d);
      });

      let html = "";
      Object.keys(byDate).sort().forEach(date => {
        const delivs = byDate[date].sort((a,b)=>(a.stopOrder||99)-(b.stopOrder||99));
        const label = isToday(date) ? `TODAY — ${fmtDate(date)}` : fmtDate(date);
        html += `<div class="dlv-day-hdr">
          <span>${label}</span>
          <span style="font-weight:400;opacity:.8">${delivs.length} stop${delivs.length!==1?"s":""}</span>
        </div>`;
        delivs.forEach(d => {
          const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(d.address||"")}`;
          const canEdit = d.status !== "delivered" && d.status !== "cancelled";
          html += `<div class="dlv-card status-${d.status}">
            <div class="dlv-card-top">
              <div style="flex:1">
                <div class="dlv-card-inv">${d.invoiceNumber ? "INV #"+d.invoiceNumber : "No Invoice #"}</div>
                <div class="dlv-card-name">${d.customerName||"Customer"}</div>
                <div class="dlv-card-meta">
                  🚛 ${driverLabel(d.driverId)}
                  ${d.deliveryWindow ? "  ·  🕐 "+d.deliveryWindow : ""}
                  ${d.stopOrder ? "  ·  Stop #"+d.stopOrder : ""}
                  <br>📍 ${d.address||"No address"}
                  ${d.customerPhone ? "<br>📞 "+d.customerPhone : ""}
                  ${d.deliveryNotes ? "<br>📋 "+d.deliveryNotes : ""}
                </div>
              </div>
              ${statusPill(d.status)}
            </div>
            ${canEdit ? `<div class="dlv-card-actions">
              <button class="dlv-act-btn dlv-act-edit" onclick="NWDelivery.openEdit('${d.id}')">✏️ Edit</button>
              ${d.address ? `<a class="dlv-act-btn dlv-act-maps" href="${mapsUrl}" target="_blank">🗺 Maps</a>` : ""}
              <button class="dlv-act-btn dlv-act-cancel" onclick="NWDelivery.cancelDeliveryById('${d.id}','${(d.customerName||"").replace(/'/g,"\\'")}')">✕ Cancel</button>
            </div>` : ""}
          </div>`;
        });
      });

      listEl.innerHTML = html;
    }
  };

  // ── INJECT SCHEDULE BUTTON + STRIP into invoice toolbar ──────────────────
  function injectInvoiceButton() {
    if (!document.getElementById("schedule-delivery-btn")) {
      const anchor = document.getElementById("take-payment-btn");
      if (anchor) {
        const btn = document.createElement("button");
        btn.id = "schedule-delivery-btn";
        btn.textContent = "🚚 Schedule Delivery";
        btn.onclick = () => NWDelivery.openModal();
        anchor.insertAdjacentElement("afterend", btn);
      }
    }
    if (!document.getElementById("dlv-strip")) {
      const fulfillStrip = document.getElementById("inv-fulfillment-strip");
      if (fulfillStrip) {
        const strip = document.createElement("div");
        strip.id = "dlv-strip";
        strip.innerHTML = `
          <span style="font-size:20px">🚚</span>
          <div>
            <strong id="dlv-strip-title" style="display:block"></strong>
            <span id="dlv-strip-detail"></span>
          </div>`;
        fulfillStrip.appendChild(strip);
      }
    }
  }

  // ── HOOK showInvoice + showView ───────────────────────────────────────────
  function hookFunctions() {
    if (typeof window.showInvoice === "function" && !window._dlvHooked) {
      const _orig = window.showInvoice;
      window.showInvoice = function(...args) {
        _orig.apply(this, args);
        setTimeout(injectInvoiceButton, 150);
      };
      const _origSV = window.showView;
      window.showView = function(id, ...args) {
        _origSV.apply(this, [id, ...args]);
        if (id === "invoice-view") setTimeout(injectInvoiceButton, 150);
      };
      window._dlvHooked = true;
      addDeliveriesTab();
    } else if (!window._dlvHooked) {
      setTimeout(hookFunctions, 250);
    }
  }

  hookFunctions();
  setTimeout(injectInvoiceButton, 800);

})();
