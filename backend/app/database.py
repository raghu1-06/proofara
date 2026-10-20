import os
import sqlite3
import json
from typing import List, Dict, Any
from .security import encrypt_secret, decrypt_secret

DB_PATH = os.environ.get("DATABASE_PATH", "empire_arena.db")

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn

def init_db():
    conn = get_db_connection()
    with conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS experiments (
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

        CREATE TABLE IF NOT EXISTS test_cases (
            id TEXT PRIMARY KEY,
            experiment_id TEXT NOT NULL,
            name TEXT NOT NULL,
            input_prompt TEXT NOT NULL,
            expected_output TEXT NOT NULL,
            evaluation_method TEXT NOT NULL DEFAULT 'Exact match',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS evaluation_runs (
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

        CREATE TABLE IF NOT EXISTS test_results (
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
            FOREIGN KEY (run_id) REFERENCES evaluation_runs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS provider_settings (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            provider_type TEXT NOT NULL,
            api_key TEXT DEFAULT '',
            base_url TEXT DEFAULT '',
            is_enabled BOOLEAN NOT NULL DEFAULT 0,
            models_json TEXT NOT NULL DEFAULT '[]',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS revoked_sessions (
            nonce TEXT PRIMARY KEY,
            revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        cursor = conn.cursor()

        # Migrations for evaluation_runs
        cursor.execute("PRAGMA table_info(evaluation_runs)")
        eval_cols = [row[1] for row in cursor.fetchall()]
        if "provider_type" not in eval_cols:
            cursor.execute("ALTER TABLE evaluation_runs ADD COLUMN provider_type TEXT NOT NULL DEFAULT 'builtin'")
        if "is_simulation" not in eval_cols:
            cursor.execute("ALTER TABLE evaluation_runs ADD COLUMN is_simulation BOOLEAN NOT NULL DEFAULT 1")
        if "snapshot_json" not in eval_cols:
            cursor.execute("ALTER TABLE evaluation_runs ADD COLUMN snapshot_json TEXT DEFAULT '{}'")

        # Migrations for test_results
        cursor.execute("PRAGMA table_info(test_results)")
        res_cols = [row[1] for row in cursor.fetchall()]
        if "latency_ms" not in res_cols:
            cursor.execute("ALTER TABLE test_results ADD COLUMN latency_ms INTEGER DEFAULT 0")
        if "tokens_used" not in res_cols:
            cursor.execute("ALTER TABLE test_results ADD COLUMN tokens_used INTEGER DEFAULT 0")
        if "is_simulation" not in res_cols:
            cursor.execute("ALTER TABLE test_results ADD COLUMN is_simulation BOOLEAN NOT NULL DEFAULT 1")

        # Initialize default providers if not already present
        default_providers = [
            ("openai", "OpenAI", "openai", "https://api.openai.com/v1", json.dumps(["gpt-4o-mini", "gpt-4o", "o3-mini"])),
            ("gemini", "Google Gemini", "gemini", "https://generativelanguage.googleapis.com/v1beta", json.dumps(["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"])),
            ("groq", "Groq (High Speed)", "groq", "https://api.groq.com/openai/v1", json.dumps(["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"])),
            ("anthropic", "Anthropic Claude", "anthropic", "https://api.anthropic.com/v1", json.dumps(["claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"])),
            ("ollama", "Ollama (Local LLM)", "ollama", "http://localhost:11434", json.dumps(["llama3.2", "llama3.1", "mistral", "qwen2.5"])),
            ("custom", "Custom OpenAI-Compatible", "custom", "http://localhost:8000/v1", json.dumps(["custom-model-1"]))
        ]
        for p_id, p_name, p_type, base_url, models_json in default_providers:
            cursor.execute(
                """
                INSERT OR IGNORE INTO provider_settings (id, name, provider_type, api_key, base_url, is_enabled, models_json)
                VALUES (?, ?, ?, '', ?, 0, ?)
                """,
                (p_id, p_name, p_type, base_url, models_json)
            )

        # Ensure any existing unencrypted keys in provider_settings are encrypted at rest
        cursor.execute("SELECT id, api_key FROM provider_settings WHERE api_key != ''")
        for row in cursor.fetchall():
            k = row["api_key"]
            if k and not k.startswith("vault:"):
                enc_key = encrypt_secret(k)
                cursor.execute("UPDATE provider_settings SET api_key = ? WHERE id = ?", (enc_key, row["id"]))

    conn.close()
