#!/usr/bin/env python3
"""Upload AAB dan tempatkan versionCode baru pada track Google Play."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import httplib2
from google.oauth2 import service_account
from google_auth_httplib2 import AuthorizedHttp
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload


SCOPE = "https://www.googleapis.com/auth/androidpublisher"
VERSION_PATTERN = re.compile(r"^version:\s*(\d+\.\d+\.\d+)\+(\d+)\s*$", re.MULTILINE)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload AAB ke track Google Play.")
    parser.add_argument("--track", default="internal", help="Track tujuan, misalnya internal atau production.")
    parser.add_argument("--status", choices=("completed", "draft"), default="completed")
    return parser.parse_args()


def release_name() -> str:
    override = os.environ.get("RELEASE_NAME")
    if override:
        return override

    pubspec = Path(os.environ.get("PUBSPEC_FILE", "pubspec.yaml"))
    match = VERSION_PATTERN.search(pubspec.read_text(encoding="utf-8"))
    if not match:
        raise RuntimeError(f"Versi tidak ditemukan di {pubspec}.")
    return f"AWExam {match.group(1)} ({match.group(2)})"


def api_error_message(error: HttpError) -> str:
    try:
        payload = json.loads(error.content.decode("utf-8"))
        detail = payload.get("error", {})
        return str(detail.get("message") or detail)
    except (AttributeError, UnicodeDecodeError, json.JSONDecodeError):
        return str(error)


def main() -> int:
    args = parse_args()
    credentials_path = Path(os.environ.get("PLAY_JSON", "android/play-service-account.json"))
    aab_path = Path(os.environ.get("AAB_PATH", "build/app/outputs/bundle/release/app-release.aab"))
    package_name = os.environ.get("PLAY_PACKAGE", "awexam.com")

    if not credentials_path.is_file():
        raise SystemExit(f"Kredensial service account tidak ditemukan: {credentials_path}")
    if not aab_path.is_file() or aab_path.stat().st_size == 0:
        raise SystemExit(f"AAB tidak ditemukan atau kosong: {aab_path}")

    credentials = service_account.Credentials.from_service_account_file(
        credentials_path,
        scopes=[SCOPE],
    )
    authorized_http = AuthorizedHttp(credentials, http=httplib2.Http(timeout=180))
    publisher = build(
        "androidpublisher",
        "v3",
        http=authorized_http,
        cache_discovery=False,
    )

    edit_id: str | None = None
    committed = False
    try:
        edit: dict[str, Any] = publisher.edits().insert(
            packageName=package_name,
            body={},
        ).execute()
        edit_id = str(edit["id"])

        bundle: dict[str, Any] = publisher.edits().bundles().upload(
            packageName=package_name,
            editId=edit_id,
            media_body=MediaFileUpload(
                str(aab_path),
                mimetype="application/octet-stream",
                resumable=True,
            ),
        ).execute()
        version_code = str(bundle["versionCode"])
        print(f"  AAB terunggah dengan versionCode {version_code}.")

        release: dict[str, Any] = {
            "name": release_name(),
            "versionCodes": [version_code],
            "status": args.status,
        }
        notes = os.environ.get("RELEASE_NOTES", "").strip()
        if notes:
            release["releaseNotes"] = [
                {
                    "language": os.environ.get("RELEASE_NOTES_LANGUAGE", "id-ID"),
                    "text": notes,
                }
            ]

        publisher.edits().tracks().update(
            packageName=package_name,
            editId=edit_id,
            track=args.track,
            body={"track": args.track, "releases": [release]},
        ).execute()

        publisher.edits().commit(
            packageName=package_name,
            editId=edit_id,
        ).execute()
        committed = True
        print(f"  Edit Google Play berhasil di-commit ke track {args.track}.")
        return 0
    except HttpError as error:
        status = getattr(error.resp, "status", "unknown")
        print(f"Google Play API gagal (HTTP {status}): {api_error_message(error)}", file=sys.stderr)
        return 1
    finally:
        if edit_id and not committed:
            try:
                publisher.edits().delete(packageName=package_name, editId=edit_id).execute()
            except Exception:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
