import os
import sqlite3
import pytest
from backend.app.backup import create_database_backup, restore_database_backup
from backend.app.security import encrypt_secret, decrypt_secret

def create_sample_database(db_path: str):
    if os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON;")
    with conn:
        conn.executescript("""
        CREATE TABLE experiments (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL,
            target_model TEXT NOT NULL,
            evaluation_criteria TEXT NOT NULL,
            pass_threshold REAL NOT NULL DEFAULT 80.0,
            status TEXT NOT NULL DEFAULT 'Draft',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE test_cases (
            id TEXT PRIMARY KEY,
            experiment_id TEXT NOT NULL,
            name TEXT NOT NULL,
            input_prompt TEXT NOT NULL,
            expected_output TEXT NOT NULL,
            evaluation_method TEXT NOT NULL DEFAULT 'Exact match',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
        );

        CREATE TABLE evaluation_runs (
            id TEXT PRIMARY KEY,
            experiment_id TEXT NOT NULL,
            model_id TEXT NOT NULL,
            model_name TEXT NOT NULL,
            provider_type TEXT NOT NULL DEFAULT 'builtin',
            is_simulation BOOLEAN NOT NULL DEFAULT 1,
            snapshot_json TEXT DEFAULT '{}',
            total_tests INTEGER NOT NULL DEFAULT 0,
            passed_tests INTEGER NOT NULL DEFAULT 0,
            pass_rate REAL NOT NULL DEFAULT 0.0,
            status TEXT NOT NULL DEFAULT 'Completed',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
        );

        CREATE TABLE test_results (
            id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL,
            test_case_id TEXT NOT NULL,
            model_id TEXT NOT NULL,
            input_prompt TEXT NOT NULL,
            expected_output TEXT NOT NULL,
            actual_output TEXT NOT NULL,
            passed BOOLEAN NOT NULL,
            evaluation_method TEXT NOT NULL,
            error_details TEXT,
            latency_ms INTEGER DEFAULT 0,
            tokens_used INTEGER DEFAULT 0,
            is_simulation BOOLEAN NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (run_id) REFERENCES evaluation_runs(id) ON DELETE CASCADE,
            FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
        );

        CREATE TABLE provider_settings (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            provider_type TEXT NOT NULL,
            api_key TEXT,
            base_url TEXT,
            is_enabled BOOLEAN NOT NULL DEFAULT 0,
            models_json TEXT DEFAULT '[]',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Insert valid test data
        conn.execute(
            "INSERT INTO experiments VALUES ('exp-dr-1', 'DR Test Exp', 'Testing recovery', 'General', 'Nova-7B', 'Exact match', 80.0, 'Draft', '2026-10-20', '2026-10-20')"
        )
        conn.execute(
            "INSERT INTO test_cases VALUES ('tc-dr-1', 'exp-dr-1', 'Test Case 1', 'Echo A', 'A', 'Exact match', '2026-10-20')"
        )
        conn.execute(
            "INSERT INTO evaluation_runs VALUES ('run-dr-1', 'exp-dr-1', 'Nova-7B', 'Nova-7B Fast', 'builtin', 1, '{\"snapshot\": true}', 1, 1, 100.0, 'Complete', 'Notes', '2026-10-20')"
        )
        conn.execute(
            "INSERT INTO test_results VALUES ('res-dr-1', 'run-dr-1', 'tc-dr-1', 'Nova-7B', 'Echo A', 'A', 'A', 1, 'Exact match', NULL, 120, 10, 1, '2026-10-20')"
        )
        # Encrypted credential
        encrypted_key = encrypt_secret("sk-test-secret-recovery-sample")
        conn.execute(
            "INSERT INTO provider_settings VALUES ('openai', 'OpenAI', 'openai', ?, 'https://api.openai.com/v1', 1, '[\"gpt-4o\"]', '2026-10-20')",
            (encrypted_key,)
        )
    conn.close()

def test_isolated_disaster_recovery_workflow(tmp_path):
    """
    Tests complete disaster recovery cycle:
    1. Source database creation with relationships and encrypted keys
    2. Online backup creation
    3. Isolated restoration into clean target
    4. Post-restore verification of integrity, FK constraints, and secret decryptability
    """
    src_db = str(tmp_path / "production_source.db")
    backup_dir = str(tmp_path / "backups")
    target_db = str(tmp_path / "restored_destination.db")

    create_sample_database(src_db)

    # 1. Create backup
    backup_file = create_database_backup(src_db, backup_dir=backup_dir)
    assert os.path.exists(backup_file)
    assert os.path.getsize(backup_file) > 0

    # 2. Restore into target database
    stats = restore_database_backup(backup_file, target_db)
    assert stats["integrity"] == "ok"
    assert stats["experiments"] == 1
    assert stats["test_cases"] == 1
    assert stats["evaluation_runs"] == 1
    assert stats["test_results"] == 1
    assert stats["provider_settings"] == 1

    # 3. Verify target database directly
    conn = sqlite3.connect(target_db)
    conn.execute("PRAGMA foreign_keys = ON;")
    
    # Check FK constraints
    fks = conn.execute("PRAGMA foreign_key_check;").fetchall()
    assert len(fks) == 0, f"Restored database has foreign key violations: {fks}"

    # Verify encrypted credential can be decrypted
    row = conn.execute("SELECT api_key FROM provider_settings WHERE id = 'openai'").fetchone()
    conn.close()
    assert row is not None
    decrypted = decrypt_secret(row[0])
    assert decrypted == "sk-test-secret-recovery-sample"

def test_corrupt_backup_leaves_existing_db_unharmed(tmp_path):
    """
    Verifies safety invariant:
    If an operator attempts to restore a corrupted backup file, the operation
    fails with an exception and leaves the existing target database completely unharmed.
    """
    valid_db = str(tmp_path / "active_production.db")
    corrupt_backup = str(tmp_path / "corrupted_snapshot.db")

    # Create active production database
    create_sample_database(valid_db)
    
    # Create corrupted backup (write garbage bytes)
    with open(corrupt_backup, "wb") as f:
        f.write(b"INVALID_SQLITE_GARBAGE_HEADER_DATA_1234567890")

    # Attempt restoration
    with pytest.raises(RuntimeError) as exc_info:
        restore_database_backup(corrupt_backup, valid_db)
    assert "corrupt" in str(exc_info.value).lower() or "failed" in str(exc_info.value).lower()

    # Verify active production database was NOT corrupted or overwritten
    conn = sqlite3.connect(valid_db)
    integrity = conn.execute("PRAGMA integrity_check;").fetchone()[0]
    exp_count = conn.execute("SELECT COUNT(*) FROM experiments;").fetchone()[0]
    conn.close()

    assert integrity == "ok", "Target database must remain fully intact after rejected restore"
    assert exp_count == 1, "Target database records must remain unharmed"

def test_empty_backup_rejection(tmp_path):
    """Verifies that an empty (0-byte) backup file is rejected immediately."""
    valid_db = str(tmp_path / "active_db.db")
    empty_backup = str(tmp_path / "empty.db")

    create_sample_database(valid_db)
    with open(empty_backup, "wb") as f:
        pass  # 0 bytes

    with pytest.raises(RuntimeError) as exc_info:
        restore_database_backup(empty_backup, valid_db)
    assert "empty" in str(exc_info.value).lower()

def test_restore_rejects_missing_required_tables(tmp_path):
    """
    Verifies that a valid SQLite database lacking Empire Arena required tables
    is rejected before modifying the target database.
    """
    valid_db = str(tmp_path / "target_live.db")
    incomplete_db = str(tmp_path / "incomplete_snapshot.db")

    create_sample_database(valid_db)

    # Create valid SQLite DB with only an unrelated table
    conn = sqlite3.connect(incomplete_db)
    conn.execute("CREATE TABLE some_random_table (id INT);")
    conn.commit()
    conn.close()

    with pytest.raises(RuntimeError) as exc_info:
        restore_database_backup(incomplete_db, valid_db)
    assert "missing core tables" in str(exc_info.value).lower()

    # Target DB preserved
    conn = sqlite3.connect(valid_db)
    assert conn.execute("SELECT COUNT(*) FROM experiments;").fetchone()[0] == 1
    conn.close()

def test_restore_rejects_foreign_key_violations(tmp_path):
    """
    Verifies that a backup with orphaned records violating foreign keys
    is rejected before restoration.
    """
    valid_db = str(tmp_path / "target_live.db")
    fk_broken_db = str(tmp_path / "broken_fk.db")

    create_sample_database(valid_db)
    create_sample_database(fk_broken_db)

    # Disable FK temporarily on source to inject an orphaned test_case
    conn = sqlite3.connect(fk_broken_db)
    conn.execute("PRAGMA foreign_keys = OFF;")
    conn.execute(
        "INSERT INTO test_cases (id, experiment_id, name, input_prompt, expected_output) VALUES ('orphan-tc', 'nonexistent-exp-id', 'Orphan', 'Hi', 'Hi')"
    )
    conn.commit()
    conn.close()

    with pytest.raises(RuntimeError) as exc_info:
        restore_database_backup(fk_broken_db, valid_db)
    assert "foreign key" in str(exc_info.value).lower()

    # Target DB preserved
    conn = sqlite3.connect(valid_db)
    assert conn.execute("SELECT COUNT(*) FROM experiments;").fetchone()[0] == 1
    conn.close()
