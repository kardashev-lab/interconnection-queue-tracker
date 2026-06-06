#!/bin/sh
set -eu

# Run once on container start, then daily at 06:00 UTC.
SCHEDULE="${FETCH_CRON:-0 6 * * *}"
LOG=/var/log/fetcher-cron.log

log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*" | tee -a "$LOG"
}

run_fetch() {
  log "Starting queue fetch (markets=${FETCH_MARKETS:-all})"
  if python /app/fetch.py >> "$LOG" 2>&1; then
    log "Fetch completed successfully"
  else
    log "Fetch failed with exit code $?"
    return 1
  fi
}

log "Fetcher cron starting (schedule=${SCHEDULE})"
run_fetch || true

{
  echo "SHELL=/bin/sh"
  echo "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  echo "${SCHEDULE} root cd /app && /usr/local/bin/python fetch.py >> ${LOG} 2>&1"
  echo ""
} > /etc/cron.d/fetcher

chmod 0644 /etc/cron.d/fetcher

log "Cron installed; waiting for next scheduled run"
exec cron -f
