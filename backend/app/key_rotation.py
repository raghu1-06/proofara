#!/usr/bin/env python3
"""
Empire Arena — Vault Master Key Rotation Utility
------------------------------------------------
Rotates encrypted credentials in the database from an old master key to a new master key.
Usage:
    python -m backend.app.key_rotation --db empire_arena.db --old-key <OLD> --new-key <NEW>
"""

import sys
import os
import argparse
from backend.app.security import rotate_vault_keys, derive_fernet_key

def main():
    parser = argparse.ArgumentParser(description="Empire Arena Master Key Rotation CLI")
    parser.add_argument("--db", default=os.environ.get("DATABASE_PATH", "empire_arena.db"), help="Path to SQLite database")
    parser.add_argument("--old-key", default=os.environ.get("OLD_MASTER_KEY"), help="Existing encryption master key")
    parser.add_argument("--new-key", default=os.environ.get("NEW_MASTER_KEY"), help="New encryption master key")

    args = parser.parse_args()

    if not args.old_key or not args.new_key:
        print("[ERROR] Both --old-key and --new-key must be provided (or set in environment as OLD_MASTER_KEY / NEW_MASTER_KEY).", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(args.db):
        print(f"[ERROR] Database file not found at '{args.db}'", file=sys.stderr)
        sys.exit(1)

    print(f"[*] Starting key rotation for database: {args.db}")
    try:
        rotated = rotate_vault_keys(args.db, args.old_key, args.new_key)
        print(f"[SUCCESS] Successfully rotated {rotated} encrypted credential records.")
        print(f"[*] Remember to update VAULT_MASTER_KEY / EMPIRE_SECRET_KEY in your production environment.")
    except Exception as e:
        print(f"[FAILED] Key rotation failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
