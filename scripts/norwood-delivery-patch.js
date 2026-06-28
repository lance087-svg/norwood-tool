// ============================================================
// NORWOOD SUPPLY — DELIVERY SCHEDULING PATCH
// norwood-delivery-patch.js
//
// Drop this file in the same folder as index.html and add:
//   <script src="norwood-delivery-patch.js"></script>
// just before </body> (after the existing norwood-patch.js line)
//
// What this does:
//   • Adds a 🚚 Schedule Delivery button to the invoice toolbar
//   • Opens a scheduling modal (driver, date, time window, notes, phone)
//   • Saves delivery record to Firestore "deliveries" collection
//   • Sends Text #1 (Scheduled confirmation) to the customer via Twilio
//   • Shows delivery status strip on the invoice view when scheduled
// ============================================================

(function () {

  // ── FIREBASE (reuses the app already initialized in index.html) ──────────
  // index.html already loads Firebase and initializes the app.
  // We grab db from the global scope set by the main app.
  // If your main app exposes `window._nwDB`, we use that;
  // otherwise we re-init with the same config (safe — Firebase dedupes).

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC7YaVUQTmLHAUOO5eROvJ6I_jbvJP7VJU",
    authDomain: "norwood-supply.firebaseapp.com",
    projectId: "norwood-supply",
    storageBucket: "norwood-supply.appspot.com",
    messagingSenderId: "407510932360",
    appId: "1:407510932360:web:ee4c1dde6440ede4be3db6"
  };

  // ── TWILIO CONFIG (fill in when account is ready) ─────────────────────────
  const TWILIO_ACCOUNT_SID = "YOUR_ACCOUNT_SID";
  const TWILIO_AUTH_TOKEN  = "YOUR_AUTH_TOKEN";
  const TWILIO_FROM_NUMBER = "YOUR_TWILIO_NUMBER"; // e.g. +19047654321

  // ── DRIVER LIST (keep in sync with delivery.html) ────────────────────────
  const DRIVERS = [
    { id: "andre",      label: "Andre (Driver / Sales)" },
    { id: "robert",     label: "Robert Bryson (Driver / Yard)" },
    { id: "contractor", label: "Outside Contractor" },
  ];

  // ── SMS TEMPLATE ──────────────────────────────────────────────────────────
  function smsScheduled(name, date, window) {
    const w = window ? `, ${window}` : "";
    return `Hi ${name || "valued customer"}, your Norwood Supply delivery is scheduled for ${date}${w}. We'll text you when your driver is on the way. Questions? Call (904) 768-6818.`;
  }

  // ── SEND SMS (stubbed until Twilio creds are filled in) ──────────────────
  async function sendSMS(toNumber, message) {
    if (!toNumber || toNumber.replace(/\D/g,"").length < 10) {
      console.log("[SMS] No valid phone — skipped.");
      return;
    }
    if (!TWILIO_ACCOUNT_SID || TWILIO_ACCOUNT_SID === "YOUR_ACCOUNT_SID") {
      console.log(`[SMS STUB] To: ${toNumber}\n${message}`);
      return;
    }
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const body = new URLSearchParams({
        To: toNumber.replace(/\D/g,"").length === 10 ? "+1" + toNumber.replace(/\D/g,"") : toNumber,
        From: TWILIO_FROM_NUMBER,
        Body: message
      });
      await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": "Basic " + btoa(TWILIO_ACCOUNT_SID + ":" + TWILIO_AUTH_TOKEN),
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      });
    } catch(e) {
      console.error("SMS error:", e);
    }
  }

  // ── FIRESTORE WRITE ───────────────────────────────────────────────────────
  async function saveDeliveryToFirestore(record) {
    try {
      const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
      const { getFirestore, collection, addDoc, serverTimestamp } =
        await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

      const app = getApps().length
        ? getApps()[0]
        : initializeApp(FIREBASE_CONFIG);
      const db = getFirestore(app);

      const docRef = await addDoc(collection(db, "deliveries"), {
        ...record,
        status: "scheduled",
        createdAt: serverTimestamp(),
        smsLog: { scheduled: new Date().toISOString() }
      });
      return docRef.id;
    } catch(e) {
      console.error("Firestore write error:", e);
      return null;
    }
  }

  // ── INJECT STYLES ─────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #dlv-modal-overlay {
      display: none;
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      z-index: 9000;
      align-items: center;
      justify-content: center;
    }
    #dlv-modal-overlay.open { display: flex; }
    #dlv-modal {
      background: #fff;
      border-radius: 10px;
      width: 100%;
      max-width: 480px;
      margin: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.22);
      overflow: hidden;
    }
    #dlv-modal-header {
      background: #1E70B8;
      color: #fff;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    #dlv-modal-header h2 { font-size: 16px; font-weight: 700; margin: 0; }
    #dlv-modal-header button {
      background: rgba(255,255,255,0.2);
      border: none;
      color: #fff;
      border-radius: 50%;
      width: 28px; height: 28px;
      font-size: 16px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    #dlv-modal-body { padding: 20px; }
    .dlv-fg { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
    .dlv-lbl {
      font-size: 11px; font-weight: 700; color: #6b4f0a;
      text-transform: uppercase; letter-spacing: .5px;
    }
    .dlv-fg select, .dlv-fg input {
      padding: 8px 10px;
      border-radius: 5px;
      border: 1.5px solid #d5c8a8;
      background: #faf8f4;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      width: 100%;
    }
    .dlv-fg select:focus, .dlv-fg input:focus { border-color: #1E70B8; }
    .dlv-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    #dlv-modal-footer {
      padding: 14px 20px;
      border-top: 1px solid #f0e8d8;
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    #dlv-modal-footer button {
      padding: 9px 22px;
      border-radius: 5px;
      border: none;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
    }
    #dlv-cancel-btn { background: #f0ece4; color: #6b5a3a; }
    #dlv-save-btn { background: #1E70B8; color: #fff; }
    #dlv-save-btn:disabled { background: #a0b8d0; cursor: not-allowed; }
    #dlv-phone-note {
      font-size: 11px;
      color: #8B6914;
      background: #fdf0d0;
      border: 1px solid #e8c850;
      border-radius: 5px;
      padding: 7px 10px;
      margin-bottom: 14px;
      display: none;
    }
    #inv-delivery-strip {
      background: #e8f5e9;
      border: 1.5px solid #a5d6a7;
      border-radius: 7px;
      padding: 10px 16px;
      margin-bottom: 14px;
      font-size: 13px;
      color: #2e7d32;
      display: none;
      align-items: center;
      gap: 10px;
    }
    #inv-delivery-strip.show { display: flex; }
    .dlv-strip-icon { font-size: 20px; }
    .dlv-strip-text strong { display: block; font-weight: 700; }
    .btn-schedule-dlv {
      background: #1E70B8 !important;
      color: #fff !important;
      padding: 8px 16px !important;
      border-radius: 5px !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      border: none !important;
      cursor: pointer !important;
    }
    .btn-schedule-dlv:hover { background: #155a94 !important; }
  `;
  document.head.appendChild(style);

  // ── BUILD MODAL HTML ──────────────────────────────────────────────────────
  const modalOverlay = document.createElement("div");
  modalOverlay.id = "dlv-modal-overlay";
  modalOverlay.innerHTML = `
    <div id="dlv-modal">
      <div id="dlv-modal-header">
        <h2>🚚 Schedule Delivery</h2>
        <button onclick="NWDelivery.closeModal()">✕</button>
      </div>
      <div id="dlv-modal-body">
        <div id="dlv-inv-ref" style="font-size:12px;color:#8B6914;margin-bottom:14px;font-weight:600"></div>

        <div id="dlv-phone-note">
          ⚠️ No customer phone on file — SMS notification will be skipped. 
          You can add a phone number in the Customer Info section and re-save.
        </div>

        <div class="dlv-row">
          <div class="dlv-fg">
            <label class="dlv-lbl">Delivery Date</label>
            <input type="date" id="dlv-date">
          </div>
          <div class="dlv-fg">
            <label class="dlv-lbl">Driver</label>
            <select id="dlv-driver">
              <option value="">— Select —</option>
              ${DRIVERS.map(d => `<option value="${d.id}">${d.label}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="dlv-row">
          <div class="dlv-fg">
            <label class="dlv-lbl">Time Window</label>
            <select id="dlv-window">
              <option value="">No specific window</option>
              <option value="Morning (8 AM – 12 PM)">Morning (8 AM – 12 PM)</option>
              <option value="Afternoon (12 PM – 4 PM)">Afternoon (12 PM – 4 PM)</option>
              <option value="Morning (7:30 – 10 AM)">Early Morning (7:30 – 10 AM)</option>
              <option value="Late Afternoon (2 – 5 PM)">Late Afternoon (2 – 5 PM)</option>
              <option value="All Day">All Day</option>
            </select>
          </div>
          <div class="dlv-fg">
            <label class="dlv-lbl">Stop Order</label>
            <input type="number" id="dlv-stop" min="1" max="20" placeholder="1 = first stop">
          </div>
        </div>

        <div class="dlv-fg">
          <label class="dlv-lbl">Delivery Address</label>
          <input type="text" id="dlv-address" placeholder="Auto-filled from invoice">
        </div>

        <div class="dlv-fg">
          <label class="dlv-lbl">Customer Cell (for SMS texts)</label>
          <input type="text" id="dlv-phone" placeholder="(xxx) xxx-xxxx">
        </div>

        <div class="dlv-fg">
          <label class="dlv-lbl">Notes for Driver</label>
          <input type="text" id="dlv-notes" placeholder="Gate code, access instructions, who to ask for…">
        </div>

        <div id="dlv-sms-preview" style="font-size:11px;color:#555;background:#f5f0e8;border-radius:5px;padding:8px 10px;line-height:1.5;display:none">
          <strong style="color:#2d6a30">📱 Text that will be sent to customer:</strong><br>
          <span id="dlv-sms-text"></span>
        </div>
      </div>
      <div id="dlv-modal-footer">
        <button id="dlv-cancel-btn" onclick="NWDelivery.closeModal()">Cancel</button>
        <button id="dlv-save-btn" onclick="NWDelivery.saveDelivery()">🚚 Schedule &amp; Notify Customer</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalOverlay);

  // ── DELIVERY STATUS STRIP (shown on invoice view) ─────────────────────────
  // Injected into inv-fulfillment-strip if already exists, else prepended to invoice-view
  function getOrCreateStrip() {
    const existing = document.getElementById("inv-delivery-strip");
    if (existing) return existing;
    const strip = document.createElement("div");
    strip.id = "inv-delivery-strip";
    strip.innerHTML = `
      <div class="dlv-strip-icon">🚚</div>
      <div class="dlv-strip-text">
        <strong id="dlv-strip-title">Delivery Scheduled</strong>
        <span id="dlv-strip-detail"></span>
      </div>`;
    const fulfillStrip = document.getElementById("inv-fulfillment-strip");
    if (fulfillStrip) {
      fulfillStrip.appendChild(strip);
    } else {
      const invView = document.getElementById("invoice-view");
      if (invView) invView.prepend(strip);
    }
    return strip;
  }

  // ── INJECT SCHEDULE BUTTON INTO INVOICE TOOLBAR ───────────────────────────
  function injectButton() {
    const takePaymentBtn = document.getElementById("take-payment-btn");
    if (!takePaymentBtn) return;
    if (document.getElementById("schedule-delivery-btn")) return; // already injected

    const btn = document.createElement("button");
    btn.id = "schedule-delivery-btn";
    btn.className = "btn btn-schedule-dlv";
    btn.textContent = "🚚 Schedule Delivery";
    btn.onclick = () => NWDelivery.openModal();
    takePaymentBtn.insertAdjacentElement("afterend", btn);
  }

  // ── CURRENT INVOICE CONTEXT ───────────────────────────────────────────────
  function getCurrentInvoiceData() {
    // Pull from the fields visible in the builder / invoice view
    const name    = (document.getElementById("c-name")  || {}).value || "";
    const phone   = (document.getElementById("c-phone") || {}).value || "";
    const addr    = (document.getElementById("c-addr")  || {}).value || "";
    const shipto  = (document.getElementById("c-shipto")|| {}).value || "";
    const notes   = (document.getElementById("c-notes") || {}).value || "";

    // Invoice number from the rendered invoice content
    let invNum = "";
    const invMeta = document.querySelector(".inv-banner-num, .inv-meta-value");
    if (invMeta) invNum = invMeta.textContent.replace("#","").trim();

    // Line items from current quote lines
    let items = [];
    try {
      const rows = document.querySelectorAll("#lines-tbody tr");
      rows.forEach(row => {
        const desc = row.querySelector("td:nth-child(2)");
        const qty  = row.querySelector("td:nth-child(3)");
        if (desc) items.push({ description: desc.textContent.trim(), qty: parseInt((qty||{}).textContent) || 1 });
      });
    } catch(e) {}

    return { name, phone, addr: shipto || addr, invoiceNumber: invNum, items, officeNotes: notes };
  }

  // ── PUBLIC API ────────────────────────────────────────────────────────────
  window.NWDelivery = {

    currentDeliveryId: null,

    openModal() {
      injectButton(); // ensure button exists
      const data = getCurrentInvoiceData();

      // Pre-fill fields
      document.getElementById("dlv-inv-ref").textContent =
        data.invoiceNumber ? `Invoice: ${data.invoiceNumber}  ·  Customer: ${data.name || "—"}` : `Customer: ${data.name || "—"}`;
      document.getElementById("dlv-address").value = data.addr || "";
      document.getElementById("dlv-phone").value   = data.phone || "";
      document.getElementById("dlv-notes").value   = data.officeNotes || "";

      // Default date to tomorrow
      const tmr = new Date();
      tmr.setDate(tmr.getDate() + 1);
      document.getElementById("dlv-date").value = tmr.toISOString().slice(0,10);

      // Phone warning
      const phoneNote = document.getElementById("dlv-phone-note");
      phoneNote.style.display = !data.phone ? "block" : "none";

      // SMS preview
      this._updateSMSPreview();

      // Wire up live preview updates
      ["dlv-date","dlv-phone","dlv-window"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = () => this._updateSMSPreview();
        if (el) el.onchange = () => this._updateSMSPreview();
      });

      modalOverlay.classList.add("open");
    },

    closeModal() {
      modalOverlay.classList.remove("open");
    },

    _updateSMSPreview() {
      const phone = (document.getElementById("dlv-phone")||{}).value || "";
      const date  = (document.getElementById("dlv-date")||{}).value || "";
      const win   = (document.getElementById("dlv-window")||{}).value || "";
      const data  = getCurrentInvoiceData();
      const preview = document.getElementById("dlv-sms-preview");
      const previewText = document.getElementById("dlv-sms-text");

      if (phone && date) {
        const displayDate = date
          ? new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" })
          : "TBD";
        previewText.textContent = smsScheduled(data.name, displayDate, win);
        preview.style.display = "block";
      } else {
        preview.style.display = "none";
      }
    },

    async saveDelivery() {
      const saveBtn = document.getElementById("dlv-save-btn");
      const driverId    = document.getElementById("dlv-driver").value;
      const delivDate   = document.getElementById("dlv-date").value;
      const timeWindow  = document.getElementById("dlv-window").value;
      const stopOrder   = parseInt(document.getElementById("dlv-stop").value) || 1;
      const address     = document.getElementById("dlv-address").value.trim();
      const phone       = document.getElementById("dlv-phone").value.trim();
      const driverNotes = document.getElementById("dlv-notes").value.trim();

      if (!driverId)   { alert("Please select a driver."); return; }
      if (!delivDate)  { alert("Please select a delivery date."); return; }

      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";

      const data = getCurrentInvoiceData();
      const displayDate = new Date(delivDate + "T12:00:00")
        .toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });

      const record = {
        invoiceNumber:  data.invoiceNumber,
        customerName:   data.name,
        customerPhone:  phone || data.phone,
        address:        address || data.addr,
        driverId,
        deliveryDate:   delivDate,
        deliveryWindow: timeWindow,
        stopOrder,
        deliveryNotes:  driverNotes,
        items:          data.items,
        status:         "scheduled"
      };

      const docId = await saveDeliveryToFirestore(record);
      this.currentDeliveryId = docId;

      // Send scheduled SMS
      const smsBody = smsScheduled(data.name, displayDate, timeWindow);
      await sendSMS(phone || data.phone, smsBody);

      // Update strip on invoice view
      this._showDeliveryStrip(record, displayDate);

      saveBtn.disabled = false;
      saveBtn.textContent = "🚚 Schedule & Notify Customer";
      this.closeModal();

      // Toast
      if (window.showToast) {
        window.showToast(`✅ Delivery scheduled for ${displayDate}${phone ? " — customer notified by text" : ""}`, "#2d6a30");
      } else {
        alert(`✅ Delivery scheduled for ${displayDate}!`);
      }
    },

    _showDeliveryStrip(record, displayDate) {
      const strip = getOrCreateStrip();
      const driverLabel = DRIVERS.find(d => d.id === record.driverId)?.label || record.driverId;
      document.getElementById("dlv-strip-title").textContent = `Delivery Scheduled — ${displayDate}`;
      document.getElementById("dlv-strip-detail").textContent =
        `Driver: ${driverLabel}${record.deliveryWindow ? "  ·  " + record.deliveryWindow : ""}`;
      strip.classList.add("show");

      // Also update the schedule button to show scheduled state
      const btn = document.getElementById("schedule-delivery-btn");
      if (btn) {
        btn.textContent = "✅ Delivery Scheduled";
        btn.style.background = "#2d6a30";
        btn.onclick = () => NWDelivery.openModal(); // still allow rescheduling
      }
    }
  };

  // ── WATCH FOR INVOICE VIEW BECOMING VISIBLE ───────────────────────────────
  // index.html uses showView() / class toggling to switch views.
  // We watch for invoice-view becoming visible and inject the button then.
  const observer = new MutationObserver(() => {
    const invView = document.getElementById("invoice-view");
    if (invView && !invView.classList.contains("hidden") && invView.style.display !== "none") {
      injectButton();
      getOrCreateStrip();
    }
  });

  // Observe the main content area
  const mainEl = document.querySelector(".main") || document.body;
  observer.observe(mainEl, { attributes: true, childList: true, subtree: true });

  // Also try injecting immediately in case invoice is already visible
  window.addEventListener("DOMContentLoaded", () => {
    injectButton();
    getOrCreateStrip();
  });
  // Try right now too
  setTimeout(() => { injectButton(); getOrCreateStrip(); }, 500);

})();
