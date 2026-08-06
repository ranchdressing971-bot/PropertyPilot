#!/bin/bash
cd "$(dirname "$0")"
APP="Nova.app"
if [ ! -d "$APP" ]; then
  osascript -e 'display alert "Nova.app not found" message "Keep this Fix script in the same folder as Nova.app."'
  exit 1
fi
xattr -cr "$APP" 2>/dev/null
codesign --force --deep --sign - "$APP" 2>/dev/null
open "$APP"
