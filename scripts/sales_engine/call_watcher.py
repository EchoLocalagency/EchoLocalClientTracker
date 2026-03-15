"""
Sales Call Watcher
===================
Polls Supabase every 2 minutes for new unanalyzed calls.
Analyzes each one immediately so callback priorities show up in real time.

Daily report still runs at 8 PM via the existing analyze_calls.py launchd job.

Usage:
    python3 -m scripts.sales_engine.call_watcher
"""

import os
import sys
import time

# Unbuffer stdout for launchd logging
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

POLL_INTERVAL = 120  # seconds


def main():
    from .sales_brain import analyze_call
    from .analyze_calls import get_unanalyzed_calls, get_recent_analyses, store_analysis

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    print(f"[call_watcher] Started at {datetime.now().strftime('%H:%M:%S')}")
    print(f"[call_watcher] Polling every {POLL_INTERVAL}s for new calls\n")

    while True:
        try:
            calls = get_unanalyzed_calls(sb)

            if calls:
                recent = get_recent_analyses(sb)
                print(f"[{datetime.now().strftime('%H:%M:%S')}] {len(calls)} new call(s) to analyze")

                for call in calls:
                    contact = call.get("contact_name") or call.get("call_to") or "Unknown"
                    has_transcript = bool(call.get("call_transcript"))
                    print(f"  Analyzing: {contact}"
                          f" {'[has transcript]' if has_transcript else '[no transcript]'}")

                    analysis = analyze_call(call, recent, dry_run=False)

                    if analysis:
                        store_analysis(sb, call["id"], call, analysis)
                        outcome = analysis.get("outcome", "?")
                        score = analysis.get("score", "?")
                        priority = analysis.get("callback_priority", "?")
                        print(f"    -> {outcome} | score: {score}/10 | {priority}")

                        # Demo bridge: auto-book and personalize when meeting is booked
                        if outcome in ("meeting_booked", "closed"):
                            try:
                                from .demo_bridge import run_demo_bridge
                                run_demo_bridge(call, analysis)
                            except Exception as e:
                                print(f"    [demo_bridge] Error: {e}")

                        recent.insert(0, analysis)
                        recent = recent[:5]
                    else:
                        print(f"    -> analysis failed, will retry next poll")

        except KeyboardInterrupt:
            print("\n[call_watcher] Stopped.")
            break
        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Error: {e}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
