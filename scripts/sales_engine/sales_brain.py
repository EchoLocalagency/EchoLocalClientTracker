"""
Sales Brain
============
Builds a prompt from the call transcript, sends to `claude -p`,
and parses the JSON analysis response.

Same subprocess pattern as seo_engine/brain.py.
"""

import json
import subprocess
import sys
from datetime import date
from pathlib import Path


def _build_call_prompt(call_data, recent_analyses=None):
    """Build the prompt for analyzing a single call."""

    transcript = call_data.get("call_transcript", "")
    summary = call_data.get("call_summary", "")
    duration = call_data.get("call_duration", "unknown")
    call_status = call_data.get("call_status", "unknown")
    contact_name = call_data.get("contact_name", "Unknown")
    company_name = call_data.get("company_name", "Unknown")

    prompt = f"""You are Jordan Belfort's protege. You eat, sleep, and breathe sales. You've closed millions in deals and you coach closers for a living. You talk like Belfort. Direct. Intense. No fluff. You don't care about feelings, you care about results.

You're analyzing a cold call for Brian Egan, who owns Echo Local, a digital consulting agency that builds automated growth systems (SEO + AI + GBP automation) for home service businesses. Brian is cold calling home service business owners and selling them a compounding system, not "SEO services." The offer is: no upfront cost, first month free as a case study, they only pay if they want to keep it running.

Your job is to rip this call apart. Tell Brian exactly what he did wrong, what he did right, and what he needs to change on the NEXT call to close the deal. Don't be nice about it. Be specific. Reference exact moments in the transcript. If he's talking too much, tell him. If his opener sucks, give him a better one. If he missed a buying signal, call it out. If he handled an objection well, acknowledge it. You're building a killer closer, not babysitting.

CALLER: Brian Egan, owner of Echo Local
PROSPECT: {contact_name} at {company_name}
CALL STATUS: {call_status}
DURATION: {duration}
DATE: {date.today()}

"""

    if summary:
        prompt += f"""== GHL CALL SUMMARY ==
{summary}

"""

    if transcript:
        prompt += f"""== FULL TRANSCRIPT ==
{transcript}

"""
    else:
        prompt += """== NO TRANSCRIPT AVAILABLE ==
Call may have been too short, voicemail, or no answer.

"""

    # Show recent patterns if available
    if recent_analyses:
        prompt += "== RECENT CALL PATTERNS (last 5 calls) ==\n"
        for a in recent_analyses[:5]:
            prompt += f"- {a['outcome']}: score {a.get('score', '?')}/10"
            if a.get('objections'):
                objs = [o.get('type', o) if isinstance(o, dict) else o for o in a['objections'][:3]]
                prompt += f" | objections: {', '.join(objs)}"
            prompt += "\n"
        prompt += "\n"

    prompt += """== YOUR ANALYSIS ==

Analyze this call and return a JSON object with EXACTLY these fields:

{
    "outcome": "<one of: no_answer, voicemail, gatekeeper, not_interested, conversation, follow_up, meeting_booked, closed>",
    "objections": [
        {"type": "<category>", "exact_quote": "<what they said>", "response_quality": "<good/weak/missed>", "better_response": "<what to say next time>"}
    ],
    "score": <1-10 overall call quality>,
    "talk_ratio": <0.0-1.0 estimated percentage of time Brian talked vs listened>,
    "energy_score": <1-10 energy/enthusiasm level>,
    "opener_used": "<the opening line or approach used>",
    "strengths": ["<specific thing done well. Include [N] refs to key_moments, e.g. 'Great use of the student angle at [1]'>", "..."],
    "improvements": ["<specific actionable improvement. Include [N] refs to key_moments, e.g. 'At [3] you should have pivoted to pricing instead of rambling'>", "..."],
    "coaching_notes": "<2-3 sentences of direct, honest coaching. Include [N] refs to key_moments. E.g. 'You lost control at [2] and just kept pitching through [3]. But the close attempt at [5] was solid.'>",
    "key_moments": [
        {"id": 1, "quote": "<exact words from the transcript>", "moment": "<what happened>", "impact": "<positive/negative/neutral>"}
    ],
    "callback_priority": "<one of: hot_lead, follow_up, callback, no_action>",
    "caller_details": {
        "contact_person": "<name of person who answered, if known>",
        "role": "<their role if mentioned -- owner, receptionist, manager, etc.>",
        "interest_level": "<hot, warm, cold, unknown>",
        "situation": "<1-2 sentence summary of their current situation mentioned in the call -- existing provider, pain points, size of business, etc.>",
        "key_info": ["<any useful facts learned: they have 3 trucks, they spend $X on ads, they just lost their SEO guy, etc.>"],
        "next_step": "<specific recommended next action: call back Tuesday, send case study, follow up in 1 week, etc.>",
        "best_time_to_call": "<if they mentioned a better time, or based on when they answered>"
    }
}

RULES:
1. Be brutally honest. Sugarcoating helps nobody.
2. Score 1-3 = bad call (fumbled, lost control, no value delivered). 4-6 = average (some good moments, room to improve). 7-9 = strong call. 10 = perfect close.
3. For objections, categorize as: price, timing, already_have_provider, not_interested, need_to_think, too_busy, no_budget, trust, distrust_ai, or other.
4. Talk ratio: <0.3 = great (prospect talked mostly), 0.3-0.5 = good, >0.5 = talking too much.
5. If no transcript (no_answer/voicemail), still return the JSON with outcome and nulls for analysis fields.
6. The opener matters most. Did Brian hook them in the first 10 seconds?
7. Number your key_moments starting at 1. Each must have an "id" (integer) and "quote" (exact words from the transcript). Use [N] in coaching_notes, strengths, and improvements to reference them by id.
8. For key_moments, flag: objection handling, tonality shifts, commitment questions, value props that landed, and missed closes.
9. callback_priority: hot_lead = they showed real interest or asked questions about the offer. follow_up = conversation happened, worth trying again. callback = voicemail left or gatekeeper, try again later. no_action = wrong number, not interested, dead lead.
10. caller_details: Extract EVERYTHING useful from the transcript. Even small details matter for the callback.

Return ONLY the JSON object, no markdown fences, no explanation."""

    return prompt


def _build_daily_prompt(todays_calls, todays_analyses):
    """Build the prompt for end-of-day coaching report."""

    total = len(todays_calls)
    analyzed = [a for a in todays_analyses if a.get("outcome")]

    outcomes = {}
    for a in analyzed:
        o = a.get("outcome", "unknown")
        outcomes[o] = outcomes.get(o, 0) + 1

    scores = [a["score"] for a in analyzed if a.get("score")]
    avg_score = sum(scores) / len(scores) if scores else 0

    ratios = [a["talk_ratio"] for a in analyzed if a.get("talk_ratio")]
    avg_ratio = sum(ratios) / len(ratios) if ratios else 0

    energies = [a["energy_score"] for a in analyzed if a.get("energy_score")]
    avg_energy = sum(energies) / len(energies) if energies else 0

    all_objections = []
    for a in analyzed:
        for obj in (a.get("objections") or []):
            if isinstance(obj, dict):
                all_objections.append(obj.get("type", "other"))
            elif isinstance(obj, str):
                all_objections.append(obj)

    objection_counts = {}
    for o in all_objections:
        objection_counts[o] = objection_counts.get(o, 0) + 1

    prompt = f"""You are Jordan Belfort doing an end-of-day debrief. You talk like him. Direct, intense, no sugarcoating. You're coaching Brian Egan, owner of Echo Local (automated growth systems for home service businesses). Brian is cold calling business owners and selling a compounding system with a free first month. Rip into the patterns you see. Call out the wins hard so he knows what's working. Call out the losses harder so he fixes them tomorrow. This is a locker room talk, not a therapy session.

TODAY: {date.today()}
TOTAL CALLS: {total}
OUTCOMES: {json.dumps(outcomes)}
AVG CALL SCORE: {avg_score:.1f}/10
AVG TALK RATIO: {avg_ratio:.0%}
AVG ENERGY: {avg_energy:.1f}/10
OBJECTION BREAKDOWN: {json.dumps(objection_counts)}

== INDIVIDUAL CALL SUMMARIES ==
"""

    for i, (call, analysis) in enumerate(zip(todays_calls, todays_analyses), 1):
        contact = call.get("contact_name", "Unknown")
        company = call.get("company_name", "")
        outcome = analysis.get("outcome", "unknown")
        score = analysis.get("score", "?")
        coaching = analysis.get("coaching_notes", "")
        prompt += f"\nCall {i}: {contact}"
        if company:
            prompt += f" ({company})"
        prompt += f" | {outcome} | {score}/10"
        if coaching:
            prompt += f"\n  Notes: {coaching}"
        prompt += "\n"

    prompt += """

== YOUR END-OF-DAY REPORT ==

Return a JSON object:

{
    "daily_coaching": "<3-5 paragraphs. Start with what went well today. Then the patterns you see. Then the #1 thing to change tomorrow. Be specific -- reference actual calls. End with a mindset note for tomorrow's session.>",
    "win_patterns": "<What's working across calls? Specific openers, value props, objection handles that landed.>",
    "loss_patterns": "<What's costing deals? Repeated mistakes, missed opportunities, bad habits.>",
    "top_objections": [{"type": "<category>", "count": <n>, "best_handle": "<the best response used today or a recommended one>"}],
    "tomorrow_focus": "<The ONE thing to focus on tomorrow to improve the most>",
    "script_adjustments": ["<specific change to the sales script based on today's data>"]
}

RULES:
1. Be direct and specific. Reference actual calls by name.
2. Identify patterns, not just individual issues.
3. The daily_coaching should feel like a locker room talk -- honest, motivating, actionable.
4. Script adjustments should be concrete: "Change the opener from X to Y" not "improve your opener."

Return ONLY the JSON object."""

    return prompt


def analyze_call(call_data, recent_analyses=None, dry_run=False):
    """Analyze a single call transcript with Claude."""

    prompt = _build_call_prompt(call_data, recent_analyses)

    if dry_run:
        Path("/Users/brianegan/EchoLocalClientTracker/reports") \
            .mkdir(parents=True, exist_ok=True)
        Path("/Users/brianegan/EchoLocalClientTracker/reports/last_sales_prompt.txt") \
            .write_text(prompt)
        print(f"  [DRY RUN] Prompt saved ({len(prompt)} chars)")
        return None

    try:
        result = subprocess.run(
            ["claude", "-p", prompt, "--output-format", "json",
             "--disable-slash-commands",
             "--setting-sources", ""],
            capture_output=True, text=True, timeout=120,
            cwd="/tmp",
        )
        if result.returncode != 0:
            print(f"  Claude error: {result.stderr[:200]}")
            return None

        outer = json.loads(result.stdout)
        text = outer.get("result", result.stdout)

        # Strip markdown fences if present
        if "```" in text:
            text = text.split("```json")[-1].split("```")[0].strip()
            if not text:
                text = outer.get("result", "")
                text = text.split("```")[-2].strip() if "```" in text else text

        return json.loads(text)

    except subprocess.TimeoutExpired:
        print("  Claude timed out")
        return None
    except (json.JSONDecodeError, KeyError) as e:
        print(f"  Parse error: {e}")
        return None


def generate_daily_report(todays_calls, todays_analyses, dry_run=False):
    """Generate end-of-day coaching report with Claude."""

    prompt = _build_daily_prompt(todays_calls, todays_analyses)

    if dry_run:
        Path("/Users/brianegan/EchoLocalClientTracker/reports") \
            .mkdir(parents=True, exist_ok=True)
        Path("/Users/brianegan/EchoLocalClientTracker/reports/last_daily_sales_prompt.txt") \
            .write_text(prompt)
        print(f"  [DRY RUN] Daily prompt saved ({len(prompt)} chars)")
        return None

    try:
        result = subprocess.run(
            ["claude", "-p", prompt, "--output-format", "json",
             "--disable-slash-commands",
             "--setting-sources", ""],
            capture_output=True, text=True, timeout=180,
            cwd="/tmp",
        )
        if result.returncode != 0:
            print(f"  Claude error: {result.stderr[:200]}")
            return None

        outer = json.loads(result.stdout)
        text = outer.get("result", result.stdout)

        if "```" in text:
            text = text.split("```json")[-1].split("```")[0].strip()
            if not text:
                text = outer.get("result", "")
                text = text.split("```")[-2].strip() if "```" in text else text

        return json.loads(text)

    except subprocess.TimeoutExpired:
        print("  Claude timed out")
        return None
    except (json.JSONDecodeError, KeyError) as e:
        print(f"  Parse error: {e}")
        return None
