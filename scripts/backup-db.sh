#!/bin/bash
# pg_dump → gzip → Cloudflare R2 (S3-compatible)
# 필요: rclone 설정 (rclone config → r2 remote)
# cron 예시: 0 3 * * * /home/ubuntu/football/scripts/backup-db.sh >> /var/log/db-backup.log 2>&1

set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="/tmp/football_${TIMESTAMP}.sql.gz"
R2_BUCKET="${R2_BUCKET:-football-backups}"
R2_REMOTE="${R2_REMOTE:-r2}"
RETAIN_DAYS="${RETAIN_DAYS:-30}"

echo "[$(date)] DB 백업 시작"

# pg_dump (Docker 컨테이너 내부 DB)
docker exec football-db-1 pg_dump \
  -U "${POSTGRES_USER:-postgres}" \
  "${POSTGRES_DB:-football}" \
  | gzip > "$BACKUP_FILE"

echo "[$(date)] 백업 완료: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"

# Cloudflare R2 업로드
rclone copy "$BACKUP_FILE" "${R2_REMOTE}:${R2_BUCKET}/daily/" --s3-no-check-bucket
echo "[$(date)] R2 업로드 완료"

# 로컬 임시파일 삭제
rm -f "$BACKUP_FILE"

# R2에서 30일 지난 백업 삭제
rclone delete "${R2_REMOTE}:${R2_BUCKET}/daily/" \
  --min-age "${RETAIN_DAYS}d" --s3-no-check-bucket
echo "[$(date)] 오래된 백업 정리 완료 (${RETAIN_DAYS}일 초과)"
