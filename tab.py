#!/usr/bin/env python3
"""tab.py - client for tabsrv (the shared visible QA tab).

  tab.py book <who> [note]     join the queue, return immediately
  tab.py wait <who> [secs]     block until you hold a tab (it prints which: tab=<id>) (default 540s; exit 0 = holder, 2 = still queued)
  tab.py renew <who>           keep your hold alive (any call renews; lease 300s)
  tab.py release <who>         free the tab - do this BEFORE long analysis/coding
  tab.py status                who holds, for how long, who is queued
  tab.py watch <who>           for the Monitor tool: prints changes, "TURN <who>" + exits 0 when you hold the tab
"""
import json, sys, time, urllib.request, urllib.parse, urllib.error

BASE = "http://127.0.0.1:5297"


def _urlopen(url):
    for i in range(10):  # ride out a server restart
        try:
            return urllib.request.urlopen(url, timeout=120)
        except urllib.error.URLError:
            if i == 9: raise
            time.sleep(1)


def call(path, **q):
    with _urlopen(f"{BASE}{path}?{urllib.parse.urlencode(q)}") as r:
        return json.load(r)


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    cmd = sys.argv[1]; who = sys.argv[2] if len(sys.argv) > 2 else ""; extra = sys.argv[3] if len(sys.argv) > 3 else ""
    if cmd == "status":
        print(json.dumps(call("/status"))); return
    if not who:
        print("who required"); sys.exit(1)
    if cmd in ("book", "renew", "release"):
        print(json.dumps(call("/" + cmd, who=who, note=extra))); return
    if cmd == "wait":
        total = float(extra) if extra else 540
        t0 = time.time(); last = None
        while time.time() - t0 < total:
            v = call("/wait", who=who, timeout=min(60, total - (time.time() - t0)))
            if v.get("you") == "holder":
                print(f"acquired after {time.time() - t0:.0f}s tab={v['tab']}  (capture with: cap.sh <name> {v['tab']})"); return
            if v.get("you") != last:
                print(f"waiting: {v.get('you')} holder={v['holder']} ({v['held_s']}s) queue={v['queue']}", flush=True); last = v.get("you")
        print("STILL QUEUED (your place is kept while you keep polling)"); sys.exit(2)
    if cmd == "watch":
        call("/book", who=who, note=extra); last = None
        while True:
            v = call("/wait", who=who, timeout=60)
            if v.get("you") == "holder":
                print(f"TURN {who} tab={v['tab']}  (capture with: cap.sh <name> {v['tab']})", flush=True); return
            line = f"{v.get('you')} holder={v['holder']} ({v['held_s']}s) queue={v['queue']}"
            if line != last:
                print(line, flush=True); last = line
    print(__doc__); sys.exit(1)


if __name__ == "__main__":
    main()
