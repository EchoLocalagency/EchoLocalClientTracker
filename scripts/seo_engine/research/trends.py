"""
Google Trends via pytrends
==========================
Pulls seasonal interest, rising queries, and peak months for target keywords.
Free, no API key needed.

Install: pip install pytrends
"""

from pytrends.request import TrendReq


def pull_trends(keywords, geo="US-CA-825"):
    """Pull Google Trends data for a list of keywords.

    Args:
        keywords: List of keywords to check (max 5 per request).
        geo: Google Trends geo code. US-CA-825 = San Diego DMA.

    Returns:
        dict with seasonal_interest, rising_queries, and peak_months.
    """
    pytrends = TrendReq(hl="en-US", tz=480)  # PST

    result = {
        "seasonal_interest": {},
        "rising_queries": [],
        "peak_months": {},
    }

    # Process in batches of 5 (pytrends limit)
    for i in range(0, len(keywords), 5):
        batch = keywords[i:i + 5]
        try:
            pytrends.build_payload(batch, cat=0, timeframe="today 12-m", geo=geo)

            # Interest over time (current level)
            interest = pytrends.interest_over_time()
            if not interest.empty:
                for kw in batch:
                    if kw in interest.columns:
                        # Current interest = last available value
                        result["seasonal_interest"][kw] = int(interest[kw].iloc[-1])

                        # Peak months (months where interest > 70% of max)
                        monthly = interest[kw].groupby(interest.index.month).mean()
                        max_val = monthly.max()
                        if max_val > 0:
                            peaks = [m for m, v in monthly.items() if v >= max_val * 0.7]
                            result["peak_months"][kw] = peaks

            # Related queries (rising)
            related = pytrends.related_queries()
            for kw in batch:
                if kw in related and related[kw].get("rising") is not None:
                    rising_df = related[kw]["rising"]
                    if not rising_df.empty:
                        rising_queries = rising_df["query"].tolist()[:5]
                        result["rising_queries"].extend(rising_queries)

        except Exception as e:
            print(f"  [trends] Error for batch {batch}: {e}")
            continue

    # Deduplicate rising queries
    result["rising_queries"] = list(dict.fromkeys(result["rising_queries"]))[:15]

    return result
