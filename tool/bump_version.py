#!/usr/bin/env python3
"""Naikkan versi Flutter pada pubspec.yaml secara deterministik."""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path


VERSION_PATTERN = re.compile(
    r"^(?P<prefix>version:\s*)(?P<major>\d+)\.(?P<minor>\d+)\.(?P<patch>\d+)\+(?P<build>\d+)(?P<suffix>\s*)$",
    re.MULTILINE,
)
VALID_BUMPS = {"major", "minor", "patch", "build", "none"}


def main() -> int:
    bump = sys.argv[1] if len(sys.argv) > 1 else "patch"
    if bump not in VALID_BUMPS:
        choices = ", ".join(sorted(VALID_BUMPS))
        raise SystemExit(f"BUMP tidak valid: {bump}. Gunakan salah satu: {choices}.")

    pubspec = Path(os.environ.get("PUBSPEC_FILE", "pubspec.yaml"))
    try:
        source = pubspec.read_text(encoding="utf-8")
    except OSError as error:
        raise SystemExit(f"Tidak dapat membaca {pubspec}: {error}") from error

    matches = list(VERSION_PATTERN.finditer(source))
    if len(matches) != 1:
        raise SystemExit(
            f"Harus ada tepat satu versi dengan format version: x.y.z+build di {pubspec}."
        )

    match = matches[0]
    major = int(match.group("major"))
    minor = int(match.group("minor"))
    patch = int(match.group("patch"))
    build = int(match.group("build"))

    if bump == "major":
        major, minor, patch, build = major + 1, 0, 0, build + 1
    elif bump == "minor":
        minor, patch, build = minor + 1, 0, build + 1
    elif bump == "patch":
        patch, build = patch + 1, build + 1
    elif bump == "build":
        build += 1

    version = f"{major}.{minor}.{patch}+{build}"
    if bump != "none":
        replacement = f'{match.group("prefix")}{version}{match.group("suffix")}'
        updated = source[: match.start()] + replacement + source[match.end() :]
        temporary = pubspec.with_suffix(pubspec.suffix + ".tmp")
        temporary.write_text(updated, encoding="utf-8")
        temporary.replace(pubspec)

    print(version)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
