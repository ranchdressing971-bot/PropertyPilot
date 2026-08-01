# Nova Mac launcher

Small AppleScript app that opens `https://rideby.live/nova` in a Chrome/Edge
app window (Safari fallback).

## Rebuild

```bash
osacompile -o mac-nova/Nova.app mac-nova/Nova.applescript
# optional: refresh icon from public/logo.png → applet.icns
cd mac-nova && zip -r -y ../public/downloads/Nova-Mac.zip Nova.app
```

## Install (operator)

1. Download `/downloads/Nova-Mac.zip` from `/nova/download` (signed-in admin).
2. Unzip → open `Nova.app` (right-click → Open the first time).
