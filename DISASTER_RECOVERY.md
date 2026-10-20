# Empire Arena — Disaster Recovery & Backup Runbook

## 1. Overview & Architecture

Empire Arena persists experiments, test cases, evaluation runs, test results, and encrypted provider settings in a local SQLite database with Write-Ahead Logging (`WAL` mode) enabled.

Backups are created using SQLite's native **Online Backup API** (`conn.backup`), providing consistent, non-blocking snapshots without locking readers or writers.

## 2. Backup Schedule & Automation

### Recommended Automation Schedule
- **Frequency:** Every 6 hours (or daily at 02:00 UTC).
- **Execution Method (Host Cronjob or Systemd Timer):**
```bash
# Add to crontab (crontab -e)
0 2 * * * curl -fsS -X POST http://127.0.0.1:8000/api/system/backup \
  -H "X-Empire-Key: $EMPIRE_API_KEY" \
  -H "Content-Type: application/json" >> /var/log/empire_backup.log 2>&1
```

## 3. Retention Policy

Follow a **Grandfather-Father-Son (GFS)** retention schedule:
- **Daily Snapshots:** Retain for 7 days.
- **Weekly Snapshots:** Retain for 4 weeks.
- **Monthly Snapshots:** Retain for 12 months.

### Automated Pruning Script
```bash
# Keep only snapshots from the last 30 days in local backup directory
find /app/data/backups/ -name "empire_arena_backup_*.db" -type f -mtime +30 -delete
```

## 4. Offsite Storage Replication

To protect against host-level failures, sync local snapshots to offsite cloud storage (Cloudflare R2, AWS S3, or Backblaze B2):
```bash
# Using AWS CLI / S3-compatible API
aws s3 sync /app/data/backups/ s3://my-empire-arena-backups/ \
  --sse AES256 \
  --storage-class STANDARD_IA
```

## 5. Restoration Runbook

### Method A: Verified API Restoration (Online)
If the backend application is running and accessible:
```bash
# 1. List available snapshots
curl -s http://127.0.0.1:8000/api/system/backups -H "X-Empire-Key: $EMPIRE_API_KEY"

# 2. Trigger restore
curl -X POST http://127.0.0.1:8000/api/system/restore \
  -H "X-Empire-Key: $EMPIRE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"backup_filename": "empire_arena_backup_20261020_073005.db"}'
```
*Safety Guarantee:* The restoration engine performs pre-flight verification on the source snapshot (`PRAGMA integrity_check`, `PRAGMA foreign_key_check`, and schema validation). If the snapshot is invalid or corrupted, the existing database is left unharmed. If an error occurs during restore, an automatic rollback snapshot restores the prior state immediately.

### Method B: Manual Offline Cold Restoration (Disaster Scenario)
In the event of total server replacement or cold recovery:
1. Stop the application container:
   ```bash
   docker compose down
   ```
2. Download the verified backup snapshot from offsite storage:
   ```bash
   aws s3 cp s3://my-empire-arena-backups/empire_arena_backup_LATEST.db /tmp/restore.db
   ```
3. Verify snapshot integrity before deployment:
   ```bash
   sqlite3 /tmp/restore.db "PRAGMA integrity_check;"
   sqlite3 /tmp/restore.db "PRAGMA foreign_key_check;"
   ```
4. Copy the verified snapshot into the persistent data volume:
   ```bash
   cp /tmp/restore.db /var/lib/docker/volumes/empire-data/_data/empire_arena.db
   ```
5. Ensure correct file ownership for the container's unprivileged user:
   ```bash
   chown 10001:10001 /var/lib/docker/volumes/empire-data/_data/empire_arena.db
   chmod 640 /var/lib/docker/volumes/empire-data/_data/empire_arena.db
   ```
6. Restart the application container:
   ```bash
   docker compose up -d
   ```
7. Verify application health:
   ```bash
   curl -f http://127.0.0.1:8000/api/health
   ```
