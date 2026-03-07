#!/bin/bash
set -e
SCRIPT_DIR="/Users/brianegan/EchoLocalClientTracker"
LOG="$SCRIPT_DIR/logs/seo_loop.log"
mkdir -p "$SCRIPT_DIR/logs"
echo "========================================" >> "$LOG"
echo "SEO Loop started: $(date)" >> "$LOG"
cd "$SCRIPT_DIR"
export PATH="/Users/brianegan/.nvm/versions/node/v24.13.0/bin:$PATH"
# TEMP: skip integrity-pro while GBP is suspended (revert after reinstatement)
/usr/bin/python3 -m scripts.seo_engine.seo_loop --live --client mr-green-turf-clean >> "$LOG" 2>&1
echo "SEO Loop finished: $(date)" >> "$LOG"
