import os
import hmac
import hashlib
import time
import secrets
import sqlite3
from typing import Optional, Tuple, Dict, List
from .security import get_active_fernet_key, is_production

SESSION_COOKIE_NAME = "empire_session"
SESSION_MAX_AGE_SECONDS = 86400  # 24 hours
LOGIN_MAX_FAILED_ATTEMPTS = 5
LOGIN_LOCKOUT_WINDOW_SECONDS = 60

# In-memory tracking for fast lookups
_REVOKED_NONCES = set()
_SESSIONS_INVALIDATED_BEFORE = 0.0
_LOGIN_FAILURES: Dict[str, List[float]] = {}

def get_configured_empire_key() -> str:
    """Returns the configured single-tenant operator key."""
    return os.environ.get("EMPIRE_API_KEY", "").strip()

def is_auth_required() -> bool:
    """Authentication is required if EMPIRE_API_KEY is configured or in production mode."""
    if is_production():
        return True
    return bool(get_configured_empire_key())

def validate_operator_key(candidate: Optional[str]) -> bool:
    """
    Validates a submitted operator key using constant-time comparison
    to prevent timing side-channel attacks.
    """
    configured = get_configured_empire_key()
    if not configured:
        # If no key is configured and not in production, open access
        return not is_production()
    if not candidate:
        return False
    return hmac.compare_digest(candidate.strip(), configured)

def _get_signing_secret() -> bytes:
    configured = get_configured_empire_key()
    if configured:
        return hashlib.sha256(configured.encode()).digest()
    return get_active_fernet_key()

def create_session_token() -> str:
    """
    Generates a cryptographically signed session token:
    format: timestamp:nonce:signature
    """
    timestamp = str(int(time.time()))
    nonce = secrets.token_hex(16)
    payload = f"{timestamp}:{nonce}"
    signature = hmac.new(_get_signing_secret(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{signature}"

def revoke_session_token(token: Optional[str], db_path: Optional[str] = None) -> bool:
    """
    Explicitly revokes a session token so it cannot be reused after logout.
    Stores the revoked nonce in memory and in the database.
    """
    if not token or not token.strip():
        return False
    parts = token.strip().split(":")
    if len(parts) != 3:
        return False

    _, nonce, _ = parts
    _REVOKED_NONCES.add(nonce)

    # Persist to database if available
    target_db = db_path or os.environ.get("DATABASE_PATH", "empire_arena.db")
    if os.path.exists(target_db):
        try:
            conn = sqlite3.connect(target_db, timeout=5.0)
            with conn:
                conn.execute("INSERT OR IGNORE INTO revoked_sessions (nonce) VALUES (?)", (nonce,))
            conn.close()
        except Exception:
            pass
    return True

def revoke_all_sessions() -> None:
    """Globally invalidates all sessions issued prior to current timestamp."""
    global _SESSIONS_INVALIDATED_BEFORE
    _SESSIONS_INVALIDATED_BEFORE = time.time()
    _REVOKED_NONCES.clear()

def is_token_revoked(nonce: str, ts: int, db_path: Optional[str] = None) -> bool:
    """Checks whether a token has been explicitly revoked or globally invalidated."""
    if float(ts) < _SESSIONS_INVALIDATED_BEFORE:
        return True
    if nonce in _REVOKED_NONCES:
        return True

    # Check database persistence
    target_db = db_path or os.environ.get("DATABASE_PATH", "empire_arena.db")
    if os.path.exists(target_db):
        try:
            conn = sqlite3.connect(target_db, timeout=5.0)
            row = conn.execute("SELECT 1 FROM revoked_sessions WHERE nonce = ?", (nonce,)).fetchone()
            conn.close()
            if row:
                _REVOKED_NONCES.add(nonce)
                return True
        except Exception:
            pass
    return False

def verify_session_token(token: Optional[str], db_path: Optional[str] = None) -> bool:
    """
    Verifies the integrity, signature, expiration, and revocation status of a session token.
    Returns True if the token is authentic, unexpired, and unrevoked.
    """
    if not token or not token.strip():
        return False
    parts = token.strip().split(":")
    if len(parts) != 3:
        return False

    ts_str, nonce, signature = parts
    try:
        ts = int(ts_str)
    except ValueError:
        return False

    # Check expiration (24h) and future clock skew (5m max)
    now = int(time.time())
    if now - ts > SESSION_MAX_AGE_SECONDS or ts > now + 300:
        return False

    # Check revocation status
    if is_token_revoked(nonce, ts, db_path=db_path):
        return False

    payload = f"{ts_str}:{nonce}"
    expected_sig = hmac.new(_get_signing_secret(), payload.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected_sig)

# ----------------- LOGIN BRUTE-FORCE RATE LIMITING ----------------- #

def check_login_rate_limit(client_ip: str) -> Tuple[bool, int]:
    """
    Checks if client IP has exceeded the allowed failed login attempt threshold.
    Returns (is_allowed, wait_seconds).
    """
    now = time.time()
    failures = _LOGIN_FAILURES.get(client_ip, [])
    # Filter failures within lockout window
    recent = [t for t in failures if now - t < LOGIN_LOCKOUT_WINDOW_SECONDS]
    _LOGIN_FAILURES[client_ip] = recent

    if len(recent) >= LOGIN_MAX_FAILED_ATTEMPTS:
        oldest_relevant = min(recent)
        wait_seconds = max(1, int(LOGIN_LOCKOUT_WINDOW_SECONDS - (now - oldest_relevant)))
        return False, wait_seconds
    return True, 0

def record_login_failure(client_ip: str) -> None:
    """Records a failed login attempt for an IP address."""
    now = time.time()
    if client_ip not in _LOGIN_FAILURES:
        _LOGIN_FAILURES[client_ip] = []
    _LOGIN_FAILURES[client_ip].append(now)

def reset_login_failures(client_ip: str) -> None:
    """Resets failed attempt records upon a successful login."""
    _LOGIN_FAILURES.pop(client_ip, None)
