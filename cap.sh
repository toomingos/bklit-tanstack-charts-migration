#!/bin/sh
# cap.sh <name> [tab-id]  ->  captures that QA tab's page viewport (real pixels, 1x) to captures/<name>.png (gitignored)
# Pass the tab id tab.py gave you. Tabs are registered with tabsrv as win=<CGWindowID>[@x,y,w,h] (the pane's
# viewport rect inside the window, for split view). With a rect the image IS the viewport: image x,y == page clientX,clientY.
# With win=<id>^<top> (one window per tab, the preferred setup) the top <top> image px of browser chrome are cut, so a resized window still captures its viewport.
# Without either the image is the whole window and the viewport is its bottom innerHeight px.
D=$(cd "$(dirname "$0")" && pwd)/captures; mkdir -p "$D"
W=$(curl -s 127.0.0.1:5297/status | python3 -c "import json,sys; t=json.load(sys.stdin)['tabs']; a='$2'; print(next((x['win'] for x in t if x['tab']==a), t[0]['win'] if t and not a else ''))" 2>/dev/null)
[ -z "$W" ] && { echo "no window registered for tab '$2' (pass the tab id tab.py gave you)"; exit 1; }
ID=${W%%[@^]*}
# sips --cropOffset fails silently on this macOS, so crop with PIL; w/h 0 = to the right/bottom edge
crop() { python3 -c "import sys; from PIL import Image; p,x,y,w,h=sys.argv[1],*map(int,sys.argv[2:]); i=Image.open(p); i.crop((x,y,x+w if w else i.width,y+h if h else i.height)).save(p)" "$@"; }
# a capture is activity: renew the lease of whoever holds this tab
H=$(curl -s 127.0.0.1:5297/status | python3 -c "import json,sys; t=json.load(sys.stdin)['tabs']; a='$2'; print(next((x['holder'] or '' for x in t if x['tab']==a), ''))" 2>/dev/null)
[ -n "$H" ] && curl -s "127.0.0.1:5297/renew?who=$H" >/dev/null
screencapture -x -o -l "$ID" "$D/$1.png" || { echo "capture of window $ID failed (window closed or off screen?)"; exit 1; }
case "$W" in *@*)
  R=${W#*@}; X=$(echo $R | cut -d, -f1); Y=$(echo $R | cut -d, -f2); RW=$(echo $R | cut -d, -f3); RH=$(echo $R | cut -d, -f4)
  crop "$D/$1.png" "$X" "$Y" "$RW" "$RH" ;;
*^*)
  crop "$D/$1.png" 0 "${W#*^}" 0 0 ;;
esac
echo "$D/$1.png $(sips -g pixelWidth -g pixelHeight "$D/$1.png" | awk '/pixel/{printf "%s ", $2}')"
