#!/bin/bash
# Daily runner for EchoLocalClientTracker report pipeline
# Called by launchd at 7:00 AM every day

set -e

SCRIPT_DIR="/Users/brianegan/EchoLocalClientTracker"
LOG="$SCRIPT_DIR/logs/run_reports.log"

echo "========================================" >> "$LOG"
echo "Run started: $(date)" >> "$LOG"

cd "$SCRIPT_DIR"
/usr/bin/python3 scripts/run_reports.py >> "$LOG" 2>&1

echo "Run finished: $(date)" >> "$LOG"
