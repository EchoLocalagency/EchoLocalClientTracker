"""
Content Cluster Manager
=======================
Manages content clusters (topic silos) in Supabase.
Tracks pillar pages, supporting posts, gap topics.
Brain uses this to plan blog posts as part of topical silos.
"""

import os
from datetime import datetime

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()


def _get_sb():
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


def get_clusters(client_id, status="active"):
    """Get all content clusters for a client.

    Returns list of cluster dicts with supporting post counts.
    """
    sb = _get_sb()
    resp = (
        sb.table("seo_content_clusters")
        .select("*")
        .eq("client_id", client_id)
        .eq("status", status)
        .order("created_at")
        .execute()
    )
    clusters = resp.data or []

    # Add computed fields for the brain
    for c in clusters:
        c["supporting_count"] = len(c.get("supporting_posts") or [])
        c["gap_count"] = len(c.get("gap_topics") or [])

    return clusters


def create_cluster(client_id, cluster_name, pillar_page=None,
                   target_keywords=None, gap_topics=None):
    """Create a new content cluster.

    Args:
        client_id: Supabase client UUID
        cluster_name: e.g. "Turf Cleaning Guide"
        pillar_page: Path to pillar content (e.g. "services.html")
        target_keywords: List of keywords this cluster targets
        gap_topics: List of subtopics that need content
    """
    sb = _get_sb()
    row = {
        "client_id": client_id,
        "cluster_name": cluster_name,
        "pillar_page": pillar_page or "",
        "target_keywords": target_keywords or [],
        "gap_topics": gap_topics or [],
        "supporting_posts": [],
        "status": "active",
    }
    resp = sb.table("seo_content_clusters").insert(row).execute()
    if resp.data:
        print(f"  [cluster_manager] Created cluster: {cluster_name}")
        return resp.data[0]
    return None


def update_cluster(cluster_id, **kwargs):
    """Update a cluster's fields.

    Accepts: cluster_name, pillar_page, target_keywords, gap_topics, status
    """
    sb = _get_sb()
    kwargs["updated_at"] = datetime.utcnow().isoformat()
    resp = (
        sb.table("seo_content_clusters")
        .update(kwargs)
        .eq("id", cluster_id)
        .execute()
    )
    return resp.data[0] if resp.data else None


def add_supporting_post(cluster_id, post_path):
    """Add a blog post to a cluster's supporting_posts array."""
    sb = _get_sb()

    # Get current posts
    resp = (
        sb.table("seo_content_clusters")
        .select("supporting_posts")
        .eq("id", cluster_id)
        .execute()
    )
    if not resp.data:
        return

    current = resp.data[0].get("supporting_posts") or []
    if post_path not in current:
        current.append(post_path)

    sb.table("seo_content_clusters").update({
        "supporting_posts": current,
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", cluster_id).execute()

    print(f"  [cluster_manager] Added {post_path} to cluster")


def remove_gap_topic(cluster_id, topic):
    """Remove a topic from the gap_topics list (it's been covered)."""
    sb = _get_sb()

    resp = (
        sb.table("seo_content_clusters")
        .select("gap_topics")
        .eq("id", cluster_id)
        .execute()
    )
    if not resp.data:
        return

    gaps = resp.data[0].get("gap_topics") or []
    if topic in gaps:
        gaps.remove(topic)

    sb.table("seo_content_clusters").update({
        "gap_topics": gaps,
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", cluster_id).execute()


def suggest_cluster_gaps(client_id):
    """Identify clusters with the most gaps for the brain to prioritize.

    Returns list of dicts sorted by gap count descending:
        [{"cluster_name": "...", "gap_topics": [...], "gap_count": 5}, ...]
    """
    clusters = get_clusters(client_id)
    gaps = []

    for c in clusters:
        gap_topics = c.get("gap_topics") or []
        if gap_topics:
            gaps.append({
                "cluster_id": c["id"],
                "cluster_name": c["cluster_name"],
                "pillar_page": c.get("pillar_page", ""),
                "gap_topics": gap_topics,
                "gap_count": len(gap_topics),
                "supporting_count": c.get("supporting_count", 0),
                "target_keywords": c.get("target_keywords", []),
            })

    gaps.sort(key=lambda x: x["gap_count"], reverse=True)
    return gaps


def auto_update_cluster_after_post(client_id, post_path, target_keywords):
    """Called after a blog_post action to update relevant clusters.

    Finds clusters whose target_keywords overlap with the post's keywords,
    adds the post as a supporting post, and removes matching gap topics.
    """
    clusters = get_clusters(client_id)
    post_kws = set(kw.lower() for kw in target_keywords)

    for cluster in clusters:
        cluster_kws = set(kw.lower() for kw in (cluster.get("target_keywords") or []))

        # Check for keyword overlap
        overlap = post_kws & cluster_kws
        if not overlap:
            # Also check if any post keyword appears in gap topics
            gap_topics = [g.lower() for g in (cluster.get("gap_topics") or [])]
            topic_overlap = any(kw in " ".join(gap_topics) for kw in post_kws)
            if not topic_overlap:
                continue

        # Add as supporting post
        add_supporting_post(cluster["id"], post_path)

        # Remove matching gap topics
        for gap in list(cluster.get("gap_topics") or []):
            if any(kw in gap.lower() for kw in post_kws):
                remove_gap_topic(cluster["id"], gap)
                print(f"  [cluster_manager] Filled gap topic: {gap}")
