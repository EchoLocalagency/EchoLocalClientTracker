#!/bin/bash
# Daily health check for tracker data integrity
# Called by launchd at 7:30 AM (30 min after run_reports)

set -e

SCRIPT_DIR="/Users/brianegan/EchoLocalClientTracker"
LOG="$SCRIPT_DIR/logs/health_check.log"

echo "========================================" >> "$LOG"
echo "Health check started: $(date)" >> "$LOG"

cd "$SCRIPT_DIR"
/usr/bin/python3 scripts/health_check.py >> "$LOG" 2>&1
EXIT_CODE=$?

echo "Health check finished: $(date) (exit: $EXIT_CODE)" >> "$LOG"

# If issues found, also log via the agent runner for Supabase visibility
if [ "$EXIT_CODE" -ne 0 ]; then
  ISSUES=$(tail -20 "$LOG")
  echo "ISSUES DETECTED -- logged to $LOG" >> "$LOG"
fi

exit $EXIT_CODE
