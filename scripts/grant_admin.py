#!/usr/bin/env python
"""Grant or revoke the `admin` Firebase Auth custom claim on a user.

Usage:
  uv run python scripts/grant_admin.py <uid> --grant
  uv run python scripts/grant_admin.py <uid> --revoke

Requires gcloud ADC for the target project.
"""

from __future__ import annotations

import argparse
import sys

import firebase_admin
from firebase_admin import auth


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("uid")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--grant", action="store_true")
    group.add_argument("--revoke", action="store_true")
    parser.add_argument("--project", default="english-cafe-496209")
    args = parser.parse_args()

    firebase_admin.initialize_app(options={"projectId": args.project})

    existing = auth.get_user(args.uid)
    current_claims = existing.custom_claims or {}
    new_claims = {**current_claims, "admin": args.grant}
    auth.set_custom_user_claims(args.uid, new_claims)
    print(f"Updated {args.uid}: admin={args.grant}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
