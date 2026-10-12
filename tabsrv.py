#!/usr/bin/env python3
"""tabsrv.py - booking server for the visible QA browser tabs (stdlib only, port 5297).

N tabs, one FIFO wait queue. A waiter at the head gets the first free tab; each holder owns exactly one tab.
  holder lease: dropped if not renewed for HOLD_TTL s (a crashed agent frees its tab)
  waiter entry: dropped if not seen for WAIT_TTL s (a dead agent leaves the queue)
Endpoints (GET): /book?who=&note=  /wait?who=&timeout=  /renew?who=  /release?who=  /status
  admin: /addtab?tab=&win=   (add a tab, or update its CGWindowID)   /rmtab?tab=   /settab?tab= (legacy: replace tab list)
Replies carry "tab": the caller's tab when it holds one, else the first tab (legacy field), and "tabs": [{tab, win, holder}].
"""
import json, os, threading, time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("TABSRV_PORT", 5297))
HOLD_TTL = 300
WAIT_TTL = 120
LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tabsrv.log")

cv = threading.Condition()
tabs = []      # [{"tab": str, "win": str}]
holders = {}   # tab -> entry
waiters = []   # FIFO of entries
for spec in filter(None, os.environ.get("QA_TABS", "").split(",")):
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
            if not who:
                return self.reply({"error": "who required"}, 400)
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
