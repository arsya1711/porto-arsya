#!/usr/bin/env bash

set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$project_dir/.env"
version_name="${1:-}"
build_number="${2:-}"

if [[ ! -f "$env_file" ]]; then
  echo "Error: .env tidak ditemukan. Salin .env.example menjadi .env lalu isi konfigurasinya." >&2
  exit 1
fi

for required_key in SUPABASE_URL SUPABASE_ANON_KEY; do
  if ! grep -Eq "^${required_key}=.+$" "$env_file"; then
    echo "Error: ${required_key} belum terisi di .env." >&2
    exit 1
  fi
done

if [[ -n "$version_name" || -n "$build_number" ]]; then
  if [[ -z "$version_name" || -z "$build_number" ]]; then
    echo "Error: VERSION dan BUILD harus diberikan bersamaan." >&2
    echo "Contoh: make release VERSION=1.0.1 BUILD=2" >&2
    exit 1
  fi

  if [[ ! "$version_name" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: VERSION harus memakai format seperti 1.0.1." >&2
    exit 1
  fi

  if [[ ! "$build_number" =~ ^[1-9][0-9]*$ ]]; then
    echo "Error: BUILD harus berupa bilangan bulat positif." >&2
    exit 1
  fi
fi

cd "$project_dir"

build_args=(
  appbundle
  --release
  --dart-define-from-file="$env_file"
)

if [[ -n "$version_name" ]]; then
  build_args+=(
    --build-name="$version_name"
    --build-number="$build_number"
  )
fi

echo "Membangun AAB release dengan konfigurasi dari .env..."
flutter build "${build_args[@]}"

echo
echo "Selesai: $project_dir/build/app/outputs/bundle/release/app-release.aab"
