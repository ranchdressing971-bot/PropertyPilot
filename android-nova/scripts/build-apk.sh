#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP="$ROOT/android-nova"
TOOLS="$ROOT/.tools"
JAVA_HOME="${JAVA_HOME:-$TOOLS/jdk17/Contents/Home}"
ANDROID_HOME="${ANDROID_HOME:-$TOOLS/android-sdk}"

export JAVA_HOME ANDROID_HOME
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

if [[ ! -x "$JAVA_HOME/bin/java" ]]; then
  echo "Java not found at $JAVA_HOME"
  exit 1
fi
if [[ ! -d "$ANDROID_HOME/platforms/android-34" ]]; then
  echo "Android SDK platform 34 missing under $ANDROID_HOME"
  exit 1
fi

cd "$APP"
if [[ ! -f ./gradlew ]]; then
  echo "gradlew missing — run gradle wrapper setup first"
  exit 1
fi

chmod +x ./gradlew
./gradlew assembleDebug --no-daemon

mkdir -p "$ROOT/public/downloads"
cp -f "$APP/app/build/outputs/apk/debug/app-debug.apk" "$ROOT/public/downloads/nova.apk"
ls -lh "$ROOT/public/downloads/nova.apk"
echo "Ready: /downloads/nova.apk"
