#!/usr/bin/env python3
"""tabsrv.py - booking server for the visible QA browser tabs (stdlib only, port 5297).

N tabs (QA_TABS="tab:win^top;..." with one Chrome window per tab, so a 390 px resize touches only that tab; win@x,y,w,h is the split-view form), one FIFO wait queue. A waiter at the head gets the first free tab; each holder owns exactly one tab.
  holder lease: dropped if not renewed for HOLD_TTL s (a crashed agent frees its tab)
  waiter entry: dropped if not seen for WAIT_TTL s (a dead agent leaves the queue)
Endpoints (GET): /book?who=&note=  /wait?who=&timeout=  /renew?who=  /release?who=  /status
  admin: /addtab?tab=&win=   (add a tab, or update its CGWindowID)   /rmtab?tab=   /settab?tab= (legacy: replace tab list)
Chat (agents working in parallel share insights, questions, findings): /say?who=&msg=  (@name tags someone, @all everyone)
  /read?who=&all=&wait=  unread messages for `who` (tagged or @all; all=1 also untagged), advances who's cursor; wait= long-polls up to 100 s
  /chat?n=  last n messages. Messages persist in chat.jsonl next to this file.
Replies carry "tab": the caller's tab when it holds one, else the first tab (legacy field), and "tabs": [{tab, win, holder}].
"""
import json, os, re, threading, time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("TABSRV_PORT", 5297))
HOLD_TTL = 300
WAIT_TTL = 120
LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tabsrv.log")
CHAT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chat.jsonl")

cv = threading.Condition()
tabs = []      # [{"tab": str, "win": str}]
holders = {}   # tab -> entry
waiters = []   # FIFO of entries
msgs = []     # [{"id", "t", "who", "to": [names], "msg"}]
cursors = {}  # who -> last read id
if os.path.exists(CHAT):
    with open(CHAT) as f: msgs = [json.loads(l) for l in f if l.strip()]
for spec in filter(None, os.environ.get("QA_TABS", "").split(";")):
    t, _, w = spec.partition(":"); tabs.append({"tab": t, "win": w})


def log(msg):
    with open(LOG, "a") as f:
        f.write(time.strftime("%H:%M:%S ") + msg + "\n")


def find(who):
    for t, e in holders.items():
        if e["who"] == who: return e
    return next((e for e in waiters if e["who"] == who), None)


def prune(now):
    changed = False
    for t, e in list(holders.items()):
        if now - e["seen"] > HOLD_TTL or t not in [x["tab"] for x in tabs]:
            log(f"expire holder {e['who']} on {t}"); del holders[t]; changed = True
    for e in list(waiters):
        if now - e["seen"] > WAIT_TTL:
            log(f"expire waiter {e['who']}"); waiters.remove(e); changed = True
    for x in tabs:
        if x["tab"] not in holders and waiters:
            e = waiters.pop(0); e["granted"] = e["seen"] = now; e["tab"] = x["tab"]; holders[x["tab"]] = e
            log(f"grant {e['who']} tab {x['tab']}"); changed = True
    if changed:
        cv.notify_all()


def view(who=None):
    now = time.time()
    first = next(iter(holders.values()), None)
    out = {"tab": tabs[0]["tab"] if tabs else "",
           "tabs": [{"tab": x["tab"], "win": x["win"], "holder": holders[x["tab"]]["who"] if x["tab"] in holders else None,
                     "held_s": round(now - holders[x["tab"]]["granted"]) if x["tab"] in holders else None} for x in tabs],
           "holder": ",".join(e["who"] for e in holders.values()) or None,
           "held_s": round(now - first["granted"]) if first else None,
           "queue": [e["who"] for e in waiters]}
    if who:
        e = find(who)
        if e and e.get("tab"):
            out["you"] = "holder"; out["tab"] = e["tab"]
            out["win"] = next((x["win"] for x in tabs if x["tab"] == e["tab"]), "")
        else:
            out["you"] = f"queued #{waiters.index(e) + 1}" if e else "none"
    return out


def say(who, msg, now):
    m = {"id": len(msgs) + 1, "t": time.strftime("%H:%M:%S", time.localtime(now)), "who": who,
         "to": sorted(set(re.findall(r"@([\w.-]+)", msg))), "msg": msg}
    msgs.append(m)
    with open(CHAT, "a") as f: f.write(json.dumps(m) + "\n")
    cv.notify_all(); return m


def unread(who, everything):
    after = cursors.get(who, 0)
    return [m for m in msgs[after:] if m["who"] != who and (everything or who in m["to"] or "all" in m["to"])]


def join(who, note, now):
    e = {"who": who, "note": note, "joined": now, "seen": now, "granted": None, "tab": None}
    waiters.append(e); log(f"book {who}"); prune(now)


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def reply(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def do_GET(self):
        u = urlparse(self.path); q = {k: v[0] for k, v in parse_qs(u.query).items()}
        who = q.get("who", "").strip()
        with cv:
            now = time.time(); prune(now)
            if u.path == "/status":
                return self.reply(view())
            if u.path in ("/addtab", "/settab"):
                t = q.get("tab", "")
                if u.path == "/settab": tabs[:] = [x for x in tabs if x["tab"] == t]
                x = next((x for x in tabs if x["tab"] == t), None)
                if x: x["win"] = q.get("win", x["win"])
                elif t: tabs.append({"tab": t, "win": q.get("win", "")})
                log(f"{u.path[1:]} {t} win={q.get('win', '')}"); prune(now); return self.reply(view())
            if u.path == "/rmtab":
                tabs[:] = [x for x in tabs if x["tab"] != q.get("tab")]; log(f"rmtab {q.get('tab')}"); prune(now); return self.reply(view())
            if u.path == "/chat":
                return self.reply({"messages": msgs[-int(q.get("n", 30)):]})
            if not who:
                return self.reply({"error": "who required"}, 400)
            if u.path == "/say":
                if not q.get("msg", "").strip(): return self.reply({"error": "msg required"}, 400)
                return self.reply(say(who, q["msg"].strip(), now))
            if u.path == "/read":
                everything = q.get("all") == "1"; deadline = now + min(float(q.get("wait", 0)), 100)
                while not unread(who, everything) and time.time() < deadline:
                    cv.wait(min(deadline - time.time(), 5))
                out = unread(who, everything); cursors[who] = len(msgs)
                return self.reply({"messages": out})
            e = find(who)
            if u.path == "/book":
                if not e: join(who, q.get("note", ""), now)
                else: e["seen"] = now
                return self.reply(view(who))
            if u.path == "/renew":
                if e: e["seen"] = now
                return self.reply(view(who))
            if u.path == "/release":
                if e:
                    if e.get("tab"): holders.pop(e["tab"], None)
                    else: waiters.remove(e)
                    log(f"release {who}"); prune(now)
                return self.reply(view(who))
            if u.path == "/wait":
                if not e: join(who, q.get("note", ""), now)
                deadline = now + min(float(q.get("timeout", 60)), 100)
                while True:
                    e = find(who)
                    if not e or e.get("tab"):
                        return self.reply(view(who))
                    e["seen"] = time.time()
                    left = deadline - time.time()
                    if left <= 0:
                        return self.reply(view(who))
                    cv.wait(min(left, 5)); prune(time.time())
        self.reply({"error": "unknown"}, 404)


if __name__ == "__main__":
    # SEED='{"holder": "...", "queue": [...]}' carries the old server's state across a restart
    seed = json.loads(os.environ.get("SEED", "{}")); now = time.time()
    if seed.get("holder") and tabs:
        holders[tabs[0]["tab"]] = {"who": seed["holder"], "note": "", "joined": now, "seen": now, "granted": now - (seed.get("held_s") or 0), "tab": tabs[0]["tab"]}
    for w in seed.get("queue", []):
        waiters.append({"who": w, "note": "", "joined": now, "seen": now, "granted": None, "tab": None})
    log(f"start :{PORT} tabs={tabs} seed={seed}")
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
