import os
import base64
import hashlib
import sqlite3
from typing import Optional

# Authenticated symmetric encryption (AES-128-CBC + HMAC-SHA256) via cryptography.fernet
try:
    from cryptography.fernet import Fernet, InvalidToken
    _HAS_CRYPTO = True
except ImportError:
    _HAS_CRYPTO = False
    InvalidToken = Exception

SECRET_ENV_VARS = ["VAULT_MASTER_KEY", "EMPIRE_SECRET_KEY"]
SECRET_FILE = ".empire_vault.key"

def derive_fernet_key(raw_input: str) -> bytes:
    """Derives a deterministic 32-byte URL-safe base64 Fernet key from any string."""
    clean = raw_input.strip()
    # If already a valid 44-character urlsafe base64 Fernet key, use directly
    if len(clean) == 44:
        try:
            base64.urlsafe_b64decode(clean.encode())
            return clean.encode()
        except Exception:
            pass
    # Otherwise derive using SHA-256
    digest = hashlib.sha256(clean.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)

def is_production() -> bool:
    env = os.environ.get("ENVIRONMENT", os.environ.get("NODE_ENV", "development")).lower().strip()
    return env in ["production", "prod"]

def validate_production_key_configuration() -> None:
    """
    Enforces production security invariants:
    1. An explicit VAULT_MASTER_KEY or EMPIRE_SECRET_KEY must be provided (>=16 chars, no placeholders).
    2. An explicit EMPIRE_API_KEY must be provided (>=16 chars, no placeholders) to enforce the access boundary.
    Ephemeral key generation is strictly forbidden in production.
    """
    if is_production():
        # 1. Master Vault Encryption Key
        has_vault_key = any(bool(os.environ.get(var, "").strip()) for var in SECRET_ENV_VARS)
        if not has_vault_key:
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: "
                "In production (ENVIRONMENT=production), you must set 'VAULT_MASTER_KEY' or "
                "'EMPIRE_SECRET_KEY' in the environment. Ephemeral key generation is strictly disallowed."
            )
        vault_val = next(os.environ.get(var, "").strip() for var in SECRET_ENV_VARS if os.environ.get(var, "").strip())
        if vault_val.startswith("REPLACE_WITH") or len(vault_val) < 16:
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: "
                "Production VAULT_MASTER_KEY is using an insecure template placeholder or is shorter than 16 characters."
            )

        # 2. Operator Access Boundary API Key
        api_key = os.environ.get("EMPIRE_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: "
                "In production (ENVIRONMENT=production), you must set 'EMPIRE_API_KEY' in the environment "
                "to enforce the deployment access boundary."
            )
        if api_key.startswith("REPLACE_WITH") or len(api_key) < 16:
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: "
                "Production EMPIRE_API_KEY is using an insecure template placeholder or is shorter than 16 characters."
            )

def _get_or_create_key() -> bytes:
    # 1. Check production requirement
    validate_production_key_configuration()

    # 2. Check environment variables
    for var in SECRET_ENV_VARS:
        val = os.environ.get(var)
        if val and val.strip():
            return derive_fernet_key(val)

    # 3. Check local key file (development only)
    if os.path.exists(SECRET_FILE):
        try:
            with open(SECRET_FILE, "rb") as f:
                content = f.read().strip()
                if len(content) == 44:
                    return content
        except Exception:
            pass

    # 4. Generate local key (development fallback)
    if _HAS_CRYPTO:
        new_key = Fernet.generate_key()
    else:
        new_key = base64.urlsafe_b64encode(os.urandom(32))

    try:
        with open(SECRET_FILE, "wb") as f:
            f.write(new_key)
    except Exception:
        pass

    return new_key

_FERNET_KEY = _get_or_create_key()

def get_active_fernet_key() -> bytes:
    return _FERNET_KEY

def encrypt_secret(raw: Optional[str], custom_key: Optional[bytes] = None) -> str:
    """Encrypts a sensitive string (such as an API key) for secure storage at rest."""
    if not raw or not raw.strip():
        return ""
    clean = raw.strip()
    if clean.startswith("vault:v1:"):
        return clean

    key = custom_key or _FERNET_KEY
    if _HAS_CRYPTO:
        f = Fernet(key)
        encrypted = f.encrypt(clean.encode()).decode()
        return f"vault:v1:{encrypted}"
    else:
        encoded = base64.b64encode(clean.encode()).decode()
        return f"vault:v0:{encoded}"

def decrypt_secret(stored: Optional[str], custom_key: Optional[bytes] = None) -> str:
    """Decrypts a stored secret string into raw plaintext for outbound provider calls."""
    if not stored or not stored.strip():
        return ""
    clean = stored.strip()

    if clean.startswith("vault:v1:"):
        token = clean[len("vault:v1:"):]
        key = custom_key or _FERNET_KEY
        if _HAS_CRYPTO:
            try:
                f = Fernet(key)
                return f.decrypt(token.encode()).decode()
            except Exception:
                return ""
        return ""

    if clean.startswith("vault:v0:"):
        token = clean[len("vault:v0:"):]
        try:
            return base64.b64decode(token.encode()).decode()
        except Exception:
            return ""

    return clean

def mask_secret(raw_or_stored: Optional[str]) -> str:
    """Safely masks a secret string so raw credentials are never sent to the browser."""
    plaintext = decrypt_secret(raw_or_stored) if raw_or_stored and raw_or_stored.startswith("vault:") else (raw_or_stored or "")
    if not plaintext:
        return ""
    if len(plaintext) <= 8:
        return "•" * len(plaintext)
    return plaintext[:4] + "•" * (len(plaintext) - 8) + plaintext[-4:]

def rotate_vault_keys(db_path: str, old_key_input: str, new_key_input: str) -> int:
    """
    Rotates all encrypted credentials stored in provider_settings:
    1. Pre-validates that ALL existing credentials can be decrypted with old_key.
    2. Aborts immediately without modifying data if old_key is invalid.
    3. Re-encrypts with new_key inside an atomic database transaction.
    Returns the number of rotated credential entries.
    """
    old_key = derive_fernet_key(old_key_input)
    new_key = derive_fernet_key(new_key_input)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT id, api_key FROM provider_settings WHERE api_key IS NOT NULL AND api_key != ''")
    rows = cursor.fetchall()
    rotated_count = 0

    if not rows:
        conn.close()
        return 0

    # Pre-validation: ensure every record can be decrypted before touching database
    decrypted_records = []
    for r in rows:
        encrypted_val = r["api_key"]
        if encrypted_val and str(encrypted_val).startswith("vault:"):
            decrypted = decrypt_secret(encrypted_val, custom_key=old_key)
            if not decrypted:
                conn.close()
                raise ValueError(
                    f"Invalid old key: failed to decrypt stored credentials for provider '{r['id']}'. Key rotation aborted."
                )
            decrypted_records.append((r["id"], decrypted))

    with conn:
        for prov_id, plaintext in decrypted_records:
            new_encrypted = encrypt_secret(plaintext, custom_key=new_key)
            cursor.execute(
                "UPDATE provider_settings SET api_key = ? WHERE id = ?",
                (new_encrypted, prov_id)
            )
            rotated_count += 1

    conn.close()
    return rotated_count
