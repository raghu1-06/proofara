import os
import sqlite3
import datetime
import time
from typing import List, Dict, Any, Optional

DEFAULT_BACKUP_DIR = os.environ.get("BACKUP_DIR", "backups")

def ensure_backup_dir(backup_dir: str = DEFAULT_BACKUP_DIR) -> str:
    """Ensures the backup directory exists outside the build/static directories."""
    abs_path = os.path.abspath(backup_dir)
    os.makedirs(abs_path, exist_ok=True)
    return abs_path

def create_database_backup(
    db_path: str,
    backup_dir: str = DEFAULT_BACKUP_DIR,
    filename: Optional[str] = None
) -> str:
    """
    Creates an atomic, consistent online backup of the SQLite database
    using SQLite's native Online Backup API (conn.backup).
    This safely snapshots the database without blocking active readers or writers.
    """
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Source database not found at '{db_path}'")

    abs_dir = ensure_backup_dir(backup_dir)
    if not filename:
        ts = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"empire_arena_backup_{ts}.db"

    dest_path = os.path.join(abs_dir, filename)

    # Use native online backup API
    source_conn = sqlite3.connect(db_path, timeout=30.0)
    dest_conn = sqlite3.connect(dest_path)

    try:
        source_conn.backup(dest_conn)
    finally:
        source_conn.close()
        dest_conn.close()

    # Verify integrity and foreign keys of newly created backup
    verify_conn = sqlite3.connect(dest_path)
    try:
        integrity = verify_conn.execute("PRAGMA integrity_check;").fetchone()
        if not integrity or integrity[0] != "ok":
            raise RuntimeError(f"Backup verification failed integrity check: {integrity}")
        fk_check = verify_conn.execute("PRAGMA foreign_key_check;").fetchall()
        if fk_check:
            raise RuntimeError(f"Backup failed foreign key verification: {fk_check}")
    finally:
        verify_conn.close()

    return dest_path

def restore_database_backup(
    backup_file: str,
    target_db_path: str
) -> Dict[str, Any]:
    """
    Restores a verified SQLite backup into a target database path
    using the atomic Online Backup API with safe rollback protection.
    
    If the backup is corrupt or restoration fails verification,
    the current database is left completely unharmed and restored to its prior state.
    """
    if not os.path.exists(backup_file):
        raise FileNotFoundError(f"Backup file not found at '{backup_file}'")

    if os.path.getsize(backup_file) == 0:
        raise RuntimeError("Source backup file is 0 bytes (empty). Cannot restore.")

    # 1. Pre-flight verification of source backup before touching target database
    try:
        backup_conn = sqlite3.connect(backup_file)
        try:
            check = backup_conn.execute("PRAGMA integrity_check;").fetchone()
            if not check or check[0] != "ok":
                raise RuntimeError(f"Source backup is corrupt: {check}")
            
            fk_violations = backup_conn.execute("PRAGMA foreign_key_check;").fetchall()
            if fk_violations:
                raise RuntimeError(f"Source backup has foreign key constraint violations: {fk_violations}")

            # Verify required schema tables exist
            tables_res = backup_conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table';"
            ).fetchall()
            table_names = {r[0] for r in tables_res}
            required_tables = {"experiments", "test_cases", "evaluation_runs", "test_results", "provider_settings"}
            missing = required_tables - table_names
            if missing:
                raise RuntimeError(f"Source backup is missing core tables: {missing}")
        finally:
            backup_conn.close()
    except (sqlite3.DatabaseError, RuntimeError) as e:
        raise RuntimeError(f"Source backup is corrupt or not a valid SQLite database: {e}")

    # 2. Create safety rollback snapshot of target database if it exists
    rollback_file = f"{target_db_path}.prerestore_{int(time.time() if 'time' in globals() else 1)}.bak"
    has_existing_target = os.path.exists(target_db_path)
    if has_existing_target:
        try:
            curr_conn = sqlite3.connect(target_db_path, timeout=30.0)
            roll_conn = sqlite3.connect(rollback_file)
            curr_conn.backup(roll_conn)
            curr_conn.close()
            roll_conn.close()
        except Exception as e:
            raise RuntimeError(f"Failed to create pre-restore safety rollback snapshot: {e}")

    # 3. Atomic restore to target database
    try:
        source_conn = sqlite3.connect(backup_file)
        dest_conn = sqlite3.connect(target_db_path, timeout=30.0)
        try:
            source_conn.backup(dest_conn)
        finally:
            source_conn.close()
            dest_conn.close()

        # 4. Post-restore verification of target database
        restored_conn = sqlite3.connect(target_db_path)
        restored_conn.row_factory = sqlite3.Row
        try:
            integrity = restored_conn.execute("PRAGMA integrity_check;").fetchone()[0]
            if integrity != "ok":
                raise RuntimeError(f"Restored database failed integrity check: {integrity}")

            fk_check = restored_conn.execute("PRAGMA foreign_key_check;").fetchall()
            if fk_check:
                raise RuntimeError(f"Restored database failed foreign key check: {fk_check}")

            # Collect verification statistics
            stats = {}
            for tbl in ["experiments", "test_cases", "evaluation_runs", "test_results", "provider_settings"]:
                try:
                    count = restored_conn.execute(f"SELECT COUNT(*) FROM {tbl};").fetchone()[0]
                    stats[tbl] = count
                except Exception:
                    stats[tbl] = 0

            stats["integrity"] = integrity
            stats["restored_at"] = datetime.datetime.utcnow().isoformat()
            stats["target_path"] = os.path.abspath(target_db_path)

            # Cleanup rollback copy on success
            if os.path.exists(rollback_file):
                try:
                    os.remove(rollback_file)
                except Exception:
                    pass

            return stats
        finally:
            restored_conn.close()

    except Exception as restore_err:
        # 5. Safe Rollback on any failure
        if has_existing_target and os.path.exists(rollback_file):
            try:
                roll_conn = sqlite3.connect(rollback_file)
                dest_conn = sqlite3.connect(target_db_path, timeout=30.0)
                roll_conn.backup(dest_conn)
                roll_conn.close()
                dest_conn.close()
                os.remove(rollback_file)
            except Exception as rollback_err:
                raise RuntimeError(
                    f"Restore failed ({restore_err}) AND rollback failed ({rollback_err}). Rollback file at {rollback_file}"
                )
        raise RuntimeError(f"Restoration failed and was safely rolled back: {restore_err}")

def list_backups(backup_dir: str = DEFAULT_BACKUP_DIR) -> List[Dict[str, Any]]:
    """Lists available backups with metadata and verification status."""
    abs_dir = ensure_backup_dir(backup_dir)
    results = []

    for f in sorted(os.listdir(abs_dir), reverse=True):
        if f.endswith(".db"):
            fpath = os.path.join(abs_dir, f)
            size = os.path.getsize(fpath)
            mtime = datetime.datetime.fromtimestamp(os.path.getmtime(fpath)).isoformat()
            
            # Quick check
            is_valid = False
            try:
                c = sqlite3.connect(fpath)
                res = c.execute("PRAGMA quick_check;").fetchone()
                is_valid = bool(res and res[0] == "ok")
                c.close()
            except Exception:
                is_valid = False

            results.append({
                "filename": f,
                "path": fpath,
                "size_bytes": size,
                "created_at": mtime,
                "is_valid": is_valid
            })

    return results
