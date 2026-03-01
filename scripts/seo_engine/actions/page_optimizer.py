"""
Page Optimizer
==============
Applies text edits to existing HTML pages.
Stores original content for rollback.
"""

import re
import subprocess
from pathlib import Path


# Pages that are off-limits to the optimizer
PROTECTED_PAGES = {"index.html"}


def optimize_page(website_path, filename, edits, action_id=None, dry_run=True):
    """Apply edits to an existing HTML page.

    Args:
        website_path: Path to website root
        filename: Relative path to the HTML file (e.g. "services.html")
        edits: List of dicts with "old_text" and "new_text" keys
        action_id: seo_actions ID for commit traceability
        dry_run: If True, validates edits but doesn't save

    Returns:
        dict with original_content (for rollback) and status
    """
    website_path = Path(website_path)
    file_path = website_path / filename

    # Safety check: never edit protected pages
    if filename in PROTECTED_PAGES:
        print(f"  [page_optimizer] BLOCKED: {filename} is protected")
        return {"status": "blocked", "reason": f"{filename} is protected"}

    if not file_path.exists():
        print(f"  [page_optimizer] File not found: {file_path}")
        return {"status": "error", "reason": "file not found"}

    original_content = file_path.read_text()
    content = original_content

    applied = []
    failed = []

    for edit in edits:
        old_text = edit.get("old_text", "")
        new_text = edit.get("new_text", "")

        if not old_text:
            failed.append({"edit": edit, "reason": "empty old_text"})
            continue

        if old_text not in content:
            failed.append({"edit": edit, "reason": "old_text not found in file"})
            continue

        # Apply the edit (first occurrence only)
        content = content.replace(old_text, new_text, 1)
        applied.append(edit)

    if not applied:
        print(f"  [page_optimizer] No edits applied to {filename}")
        return {"status": "no_changes", "failed": failed}

    result = {
        "status": "applied" if not dry_run else "dry_run",
        "file_path": str(file_path),
        "edits_applied": len(applied),
        "edits_failed": len(failed),
        "original_content": original_content,
        "failed_details": failed,
    }

    if dry_run:
        print(f"  [page_optimizer] DRY RUN - {len(applied)} edits validated for {filename}")
        return result

    # Write the updated file
    file_path.write_text(content)
    print(f"  [page_optimizer] Applied {len(applied)} edits to {filename}")

    # Git commit + push
    commit_sha = _git_commit_push(
        website_path,
        f"[SEO-AUTO] Optimize {filename}",
        action_id,
    )
    result["commit_sha"] = commit_sha

    return result


def _git_commit_push(website_path, message, action_id=None):
    """Git add, commit, push."""
    if action_id:
        message += f"\n\nAction ID: {action_id}"

    try:
        subprocess.run(["git", "add", "-A"], cwd=website_path, check=True, capture_output=True)
        result = subprocess.run(
            ["git", "commit", "-m", message],
            cwd=website_path, check=True, capture_output=True, text=True,
        )
        import re as _re
        sha_match = _re.search(r"\[[\w/-]+ ([a-f0-9]+)\]", result.stdout)
        commit_sha = sha_match.group(1) if sha_match else ""

        subprocess.run(
            ["git", "push", "origin", "main"],
            cwd=website_path, check=True, capture_output=True,
        )
        print(f"  [page_optimizer] Committed + pushed: {commit_sha}")
        return commit_sha
    except subprocess.CalledProcessError as e:
        print(f"  [page_optimizer] Git error: {e.stderr[:200] if e.stderr else str(e)}")
        return ""
