#!/usr/bin/env python3
"""Generate trust-strip chart PNGs for echolocalagency.com PPC landing pages.

Pulls 90 days of GSC data for Mr Green Turf Clean + Integrity Pro Washers
from Supabase `reports`, smooths with a 7-day rolling average, and renders
four GSC-styled PNGs into ~/Echo-local-website/assets/.

Charts produced:
  - chart-mg-impressions.png    Mr Green daily GSC impressions, 7d avg
  - chart-mg-clicks.png          Mr Green daily GSC clicks, 7d avg
  - chart-ip-impressions.png    Integrity Pro daily GSC impressions, 7d avg
  - chart-ip-clicks.png          Integrity Pro daily GSC clicks, 7d avg

Per feedback_growth_story_screenshots.md: only Mr Green + IP are used for
visual proof. Arcadian's chart is flat (established business) and would
undercut the growth story.

Usage:
    python3 scripts/generate_trust_charts.py
"""

import os
from datetime import date, timedelta
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
from dotenv import load_dotenv
from supabase import create_client


SITE_ASSETS = Path.home() / "Echo-local-website" / "assets"
GSC_BLUE = "#4285F4"
GSC_GREEN = "#34A853"
GRID = "#E8EAED"
AXIS = "#5F6368"


def fetch(client_slug, supa):
    today = date.today()
    start = today - timedelta(days=120)
    res = (
        supa.table("reports")
        .select("run_date,gsc_impressions,gsc_clicks,gsc_avg_position")
        .eq("client_id", _client_id(client_slug, supa))
        .gte("run_date", start.isoformat())
        .order("run_date")
        .execute()
    )
    rows = [r for r in res.data if r["gsc_impressions"] or r["gsc_clicks"]]
    dates = [date.fromisoformat(r["run_date"]) for r in rows]
    impr = [r["gsc_impressions"] or 0 for r in rows]
    clks = [r["gsc_clicks"] or 0 for r in rows]
    pos = [r["gsc_avg_position"] or 0 for r in rows]
    return dates, impr, clks, pos


def _client_id(slug, supa):
    res = supa.table("clients").select("id").eq("slug", slug).single().execute()
    return res.data["id"]


def rolling(values, window=7):
    out = []
    for i in range(len(values)):
        lo = max(0, i - window + 1)
        window_vals = values[lo : i + 1]
        out.append(sum(window_vals) / len(window_vals))
    return out


def render(dates, values, color, ylabel, out_path, invert=False):
    fig, ax = plt.subplots(figsize=(8, 4), dpi=150)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")

    smoothed = rolling(values, window=7)
    ax.fill_between(dates, smoothed, color=color, alpha=0.12)
    ax.plot(dates, smoothed, color=color, linewidth=2.5)

    ax.set_ylabel(ylabel, fontsize=11, color=AXIS)
    ax.tick_params(axis="both", colors=AXIS, labelsize=10)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    for spine in ("left", "bottom"):
        ax.spines[spine].set_color(GRID)
    ax.grid(True, axis="y", color=GRID, linestyle="-", linewidth=0.7)
    ax.set_axisbelow(True)

    ax.xaxis.set_major_locator(mdates.MonthLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
    if invert:
        ax.invert_yaxis()
    else:
        ax.set_ylim(bottom=0)

    plt.tight_layout()
    plt.savefig(out_path, dpi=150, facecolor="white", bbox_inches="tight")
    plt.close(fig)
    print(f"wrote {out_path} ({values[-1] if values else 0} most recent)")


def main():
    load_dotenv(Path.home() / "EchoLocalClientTracker" / ".env")
    supa = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    SITE_ASSETS.mkdir(parents=True, exist_ok=True)

    for slug, prefix in (("mr-green-turf-clean", "mg"), ("integrity-pro-washers", "ip")):
        dates, impr, clks, pos = fetch(slug, supa)
        if not dates:
            print(f"no data for {slug}")
            continue
        render(dates, impr, GSC_BLUE, "Impressions", SITE_ASSETS / f"chart-{prefix}-impressions.png")
        render(dates, clks, GSC_GREEN, "Clicks", SITE_ASSETS / f"chart-{prefix}-clicks.png")
        render(dates, pos, "#EA4335", "Average Position (lower = better)",
               SITE_ASSETS / f"chart-{prefix}-position.png", invert=True)


if __name__ == "__main__":
    main()
