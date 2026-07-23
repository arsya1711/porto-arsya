#!/usr/bin/env bash
#
# Rilis ke Google Play dari terminal: build AAB + upload + rilis ke track.
#
# Pemakaian:
#   ./release.sh                     # build + rilis ke track "internal"
#   ./release.sh production          # rilis ke production
#   ./release.sh production draft    # buat draft di production
#
# Versi dinaikkan otomatis sebelum build. Atur lewat environment:
#   BUMP=build ./release.sh           # naikkan versionCode saja
#   BUMP=minor ./release.sh           # 1.1.6 -> 1.2.0
#   BUMP=major ./release.sh           # 1.1.6 -> 2.0.0
#   BUMP=none ./release.sh            # gunakan versi pubspec apa adanya
#
# Prasyarat sekali saja:
#   - Taruh service account di android/play-service-account.json.
#   - Beri service account akses rilis pada Google Play Console.
#   - Aplikasi sudah pernah dirilis manual sekali melalui Play Console.

set -euo pipefail
cd "$(dirname "$0")"

TRACK="${1:-internal}"
STATUS="${2:-completed}"
BUMP="${BUMP:-patch}"
VENV="${VENV:-tool/.venv}"
JSON="${PLAY_JSON:-android/play-service-account.json}"
ENV_FILE="${ENV_FILE:-.env}"

case "$STATUS" in
  completed|draft) ;;
  *)
    echo "✗ Status tidak didukung: $STATUS"
    echo "  Gunakan completed atau draft."
    exit 1
    ;;
esac

if ! printf '%s' "$TRACK" | grep -Eq '^[A-Za-z0-9._:-]+$'; then
  echo "✗ Nama track tidak valid: $TRACK"
  exit 1
fi

case "$BUMP" in
  patch|minor|major|build|none) ;;
  *)
    echo "✗ Nilai BUMP tidak valid: $BUMP"
    echo "  Gunakan patch, minor, major, build, atau none."
    exit 1
    ;;
esac

# Flutter mengompilasi pasangan key/value ini melalui --dart-define-from-file.
# Nilainya sengaja tidak pernah dicetak ke log.
if [ ! -f "$ENV_FILE" ]; then
  echo "✗ File environment aplikasi tidak ada: $ENV_FILE"
  echo "  Salin .env.example ke .env, lalu isi nilainya."
  exit 1
fi

for key in SUPABASE_URL SUPABASE_ANON_KEY; do
  if ! awk -v wanted="$key" '
    /^[[:space:]]*(#|$)/ { next }
    {
      line = $0
      sub(/^[[:space:]]*/, "", line)
      split(line, pair, "=")
      name = pair[1]
      gsub(/[[:space:]]/, "", name)
      if (name != wanted) next

      sub(/^[^=]*=/, "", line)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
      if (line != "" && line != "\"\"" && line != "\047\047") found = 1
    }
    END { exit(found ? 0 : 1) }
  ' "$ENV_FILE"; then
    echo "✗ $key belum diisi di $ENV_FILE"
    exit 1
  fi
done

echo "• Environment aplikasi: $ENV_FILE (key wajib tersedia)"

if [ ! -f "$JSON" ]; then
  echo "✗ Kunci service account tidak ada: $JSON"
  echo "  Taruh file JSON dari Google Cloud di sana, lalu ulangi."
  exit 1
fi

if [ ! -f android/key.properties ]; then
  echo "✗ Konfigurasi upload key tidak ada: android/key.properties"
  echo "  Salin android/key.properties.example dan isi kredensial signing."
  exit 1
fi

python3 - "$JSON" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
try:
    payload = json.loads(path.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError) as error:
    raise SystemExit(f"✗ Service account JSON tidak valid: {error}")

if payload.get("type") != "service_account" or not payload.get("client_email") or not payload.get("private_key"):
    raise SystemExit("✗ File PLAY_JSON bukan kredensial service account yang lengkap.")
PY

# Dependency uploader disimpan lokal dan hanya dipasang pada penggunaan pertama.
if [ ! -x "$VENV/bin/python" ]; then
  echo "• Menyiapkan environment Python (sekali saja)..."
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --upgrade pip
  "$VENV/bin/pip" install --quiet -r tool/requirements.txt
fi

# versionCode wajib unik dan meningkat pada setiap upload Play Store.
NEW_VERSION="$(python3 tool/bump_version.py "$BUMP")"
echo "• Versi rilis: $NEW_VERSION (bump: $BUMP)"

release_failed() {
  exit_code=$?
  echo
  echo "✗ Rilis gagal setelah versi disiapkan."
  echo "  Setelah penyebabnya diperbaiki, ulangi dengan BUMP=none agar versi tidak naik dua kali."
  exit "$exit_code"
}
trap release_failed ERR

echo "• Mengambil dependency Flutter..."
flutter pub get

echo "• Build AAB release + environment..."
flutter build appbundle --release --dart-define-from-file="$ENV_FILE"

AAB_PATH="${AAB_PATH:-build/app/outputs/bundle/release/app-release.aab}"
if [ ! -s "$AAB_PATH" ]; then
  echo "✗ AAB hasil build tidak ditemukan: $AAB_PATH"
  exit 1
fi

echo "• Upload ke Google Play (track: $TRACK, status: $STATUS)..."
PLAY_JSON="$JSON" \
PLAY_PACKAGE="${PLAY_PACKAGE:-awexam.com}" \
AAB_PATH="$AAB_PATH" \
  "$VENV/bin/python" tool/play_upload.py --track "$TRACK" --status "$STATUS"

trap - ERR
echo "✓ Selesai. Versi $NEW_VERSION dikirim ke track $TRACK dengan status $STATUS."
