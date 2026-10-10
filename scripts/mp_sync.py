#!/usr/bin/env python3
"""Norwood Supply — push Facebook Marketplace threads into Firestore ns_mp_threads
(read by the Activity page: lance087-svg.github.io/norwood-tool/activity.html).

Usage:  python3 mp_sync.py threads.json
threads.json = a JSON list, one object per Marketplace thread you looked at this run:
  {
    "threadId": "1234567890",          # the number in facebook.com/messages/t/<id>/ ("" if unknown)
    "url": "https://www.facebook.com/messages/t/1234567890/",
    "buyer": "Kayla Smith",
    "listing": "1x6 T&G Pine Boards 14ft/16ft #3 Rustic",
    "price": "$12",
    "phone": "904-555-1212",           # only if the buyer gave it
    "status": "needs_lance" | "waiting_buyer" | "closed",
    "note": "one line: what's next / what Lance must do",
    "messages": [ {"from": "buyer"|"us", "text": "...", "at": "2026-10-10T09:51:00-04:00"} , ... ]
  }
Rules handled here (so the routine doesn't have to):
  - messages are merged with what's already stored (deduped on from+text), last 40 kept
  - a thread someone marked Done in the tool stays Done unless the buyer wrote again after it was marked
  - a placeholder "seed" doc for the same buyer is replaced by the real thread
"""
import json, re, sys, time, urllib.request, urllib.parse, datetime

KEY = "AIzaSyAf50oc1i0ec1hsD_pPQNjj_tqcpIt0Sig"
BASE = "https://firestore.googleapis.com/v1/projects/norwood-supply/databases/(default)/documents"


def tv(x):
    if x is None: return {"nullValue": None}
    if isinstance(x, bool): return {"booleanValue": x}
    if isinstance(x, int): return {"integerValue": str(x)}
    if isinstance(x, float): return {"doubleValue": x}
    if isinstance(x, str): return {"stringValue": x}
    if isinstance(x, list): return {"arrayValue": {"values": [tv(v) for v in x]}}
    return {"mapValue": {"fields": {k: tv(v) for k, v in x.items()}}}


def fv(v):
    for t in ("stringValue", "booleanValue", "doubleValue"):
        if t in v: return v[t]
    if "integerValue" in v: return int(v["integerValue"])
    if "nullValue" in v: return None
    if "mapValue" in v: return {k: fv(x) for k, x in v["mapValue"].get("fields", {}).items()}
    if "arrayValue" in v: return [fv(x) for x in v["arrayValue"].get("values", [])]
    return None


def req(method, path, body=None):
    url = BASE + "/" + path + ("&" if "?" in path else "?") + "key=" + KEY
    r = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                               headers={"Content-Type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(r, timeout=60))
    except urllib.error.HTTPError as e:
        if e.code == 404: return None
        raise


def get(doc_id):
    d = req("GET", "ns_mp_threads/" + doc_id)
    return {k: fv(v) for k, v in d.get("fields", {}).items()} if d else None


def put(doc_id, obj):
    req("PATCH", "ns_mp_threads/" + doc_id, {"fields": {k: tv(v) for k, v in obj.items()}})


def to_ms(x):
    if isinstance(x, (int, float)): return int(x if x > 1e11 else x * 1000)
    if not x: return 0
    try:
        return int(datetime.datetime.fromisoformat(str(x).replace("Z", "+00:00")).timestamp() * 1000)
    except Exception:
        return 0


def slug(s): return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def seeds_for(buyer):
    q = {"structuredQuery": {"from": [{"collectionId": "ns_mp_threads"}],
                             "where": {"compositeFilter": {"op": "AND", "filters": [
                                 {"fieldFilter": {"field": {"fieldPath": "seed"}, "op": "EQUAL", "value": {"booleanValue": True}}},
                                 {"fieldFilter": {"field": {"fieldPath": "buyerKey"}, "op": "EQUAL", "value": {"stringValue": slug(buyer)}}}]}}}}
    out = req("POST", ":runQuery", q) or []
    return [(x["document"]["name"].rsplit("/", 1)[1], {k: fv(v) for k, v in x["document"].get("fields", {}).items()})
            for x in out if "document" in x]


def main(path):
    threads = json.load(open(path))
    now = int(time.time() * 1000)
    wrote = 0
    for t in threads:
        tid = str(t.get("threadId") or "").strip()
        doc_id = ("t" + re.sub(r"\D", "", tid)) if re.sub(r"\D", "", tid) else ("s_" + slug(t.get("buyer")) + "_" + slug(t.get("listing"))[:24])
        old = get(doc_id) or {}
        # adopt a seed placeholder for this buyer
        carry = {}
        if tid:
            for sid, sd in seeds_for(t.get("buyer")):
                carry = sd
                req("DELETE", "ns_mp_threads/" + sid)
        base = dict(carry); base.update(old)
        msgs = list(base.get("messages") or [])
        seen = {(m.get("from"), (m.get("text") or "").strip()) for m in msgs}
        for m in t.get("messages") or []:
            k = (m.get("from"), (m.get("text") or "").strip())
            if not k[1] or k in seen: continue
            seen.add(k)
            msgs.append({"from": "us" if m.get("from") == "us" else "buyer", "text": k[1][:1500], "at": to_ms(m.get("at"))})
        msgs.sort(key=lambda m: m.get("at") or 0)
        msgs = msgs[-40:]
        last = msgs[-1] if msgs else {}
        last_buyer = max([m["at"] for m in msgs if m["from"] == "buyer"] or [0])
        status = t.get("status") or base.get("status") or "waiting_buyer"
        done, done_by, done_at = bool(base.get("done")), base.get("doneBy") or "", base.get("doneAt") or 0
        if done and last_buyer > (done_at or 0):          # buyer wrote again after it was closed → reopen
            done, done_by, done_at = False, "", 0
        if done: status = "closed"
        doc = {
            "buyer": t.get("buyer") or base.get("buyer") or "Buyer", "buyerKey": slug(t.get("buyer") or base.get("buyer")),
            "listing": t.get("listing") or base.get("listing") or "", "price": t.get("price") or base.get("price") or "",
            "url": t.get("url") or base.get("url") or ("https://www.facebook.com/messages/t/%s/" % re.sub(r"\D", "", tid) if tid else "https://www.facebook.com/messages/?folder=marketplace"),
            "threadId": re.sub(r"\D", "", tid) or base.get("threadId") or "",
            "phone": t.get("phone") or base.get("phone") or "",
            "status": status, "note": t.get("note") or base.get("note") or "",
            "messages": msgs, "lastAt": (last.get("at") if last else 0) or to_ms(t.get("lastAt")) or base.get("lastAt") or now,
            "lastFrom": last.get("from") or t.get("lastFrom") or base.get("lastFrom") or "buyer",
            "done": done, "doneBy": done_by, "doneAt": done_at,
            "seed": bool(t.get("seed")) and not tid, "source": t.get("source") or "marketplace-routine",
            "createdAt": base.get("createdAt") or now, "updatedAt": now, "syncedAt": now,
        }
        put(doc_id, doc)
        wrote += 1
        print(f"{doc_id}: {doc['buyer']} · {doc['status']} · {len(msgs)} msgs")
    print(json.dumps({"threads_written": wrote}))


if __name__ == "__main__":
    main(sys.argv[1])
