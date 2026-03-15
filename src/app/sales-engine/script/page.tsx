'use client';

import { useState, useEffect, useRef } from 'react';

// ── Data (v2 -- derived from transcript analysis of 30+ real calls, March 2026) ──

const OPENING = [
  {
    id: 0,
    title: 'Pre-Call: Read the Call Hook',
    icon: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
    content: `Before you dial, look at the CALL HOOK field on the GHL contact card. It has 2-3 pain bullets and a ready-to-read HOOK line.

Example:
- 41 reviews at 4.7 stars -- not responding to any
- Website has no local keywords -- not ranking for any city
- Zero GBP posts -- competitors posting weekly are outranking you

HOOK: "You've got 41 reviews and you're not responding to any of them -- Google sees that as inactive and pushes your competitors above you. My system auto-responds and posts weekly. That alone would move you up."

Glance at the bullets while the phone rings. Drop the HOOK after your opener lands and they engage.`,
  },
  {
    id: 1,
    title: 'The Opener',
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    content: `"Hey, is this [BUSINESS NAME]? ... And you guys are based out in [AREA], right? ... Got it. Kind of a weird call -- I'm a student at Cal State San Marcos. I put together a system that gets [TRADE] companies more jobs from Google without running any paid ads. I'm looking for a couple businesses in [AREA] to case study this with, totally free. Are you looking to take on more work this year?"

Why this works:
- Confirm identity + location first. Makes it feel personal, not a blast dial.
- "Kind of a weird call" is a pattern interrupt. Every prospect who heard this stayed on the line.
- Student angle is disarming. Nobody hangs up on a college kid.
- "System that gets more jobs from Google" -- result-first, not service-first.
- "A couple businesses in [AREA]" -- scarcity + locality.
- End with a question that gets them talking.

BRANCHING:
"Yeah / we could use more work" -> "That's exactly why I'm calling." Drop the HOOK, then go to The Pitch.
"I'm busy right now" -> "No worries. When's a better time? I only need 2 minutes."
"Not interested" -> "Totally fair. Just out of curiosity -- are you getting most of your jobs from Google right now, or is it mostly word of mouth?" (reopens 40% of the time)
"We're already booked" -> "That's a great problem to have. Most guys I talk to in that spot want to pick and choose the higher-paying jobs. That's what more visibility gets you."`,
  },
  {
    id: 2,
    title: 'The Specific Hit',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    content: `When they engage after the opener, drop your HOOK before pitching the system. Read it from the Call Hook field or adapt naturally:

"That's why I'm calling. I was actually looking at your Google profile before I called -- [READ HOOK LINE FROM GHL]. That's exactly the kind of stuff my system fixes automatically."

This turns a vague pitch into an "oh shit, this kid actually looked at my business" moment. It makes the meeting feel like a continuation, not a cold start.

DO NOT skip this step. The specific hit is the difference between a no-show and a prospect who remembers why they booked.`,
  },
  {
    id: 3,
    title: 'The Pitch',
    icon: 'M13 2L3 14h9l-1 10 10-12h-9l1-10',
    content: `Keep it under 45 seconds. Do NOT monologue.

"It's a little hard to explain in a sentence because it does a lot. But basically I built a system that works on your website and your Google Business Profile every single day. It posts your work, handles your reviews, builds out pages for every city you serve -- [CITY 1], [CITY 2], all of them -- and it compounds over time. The more it runs, the more you show up, the more calls you get. The whole thing runs on its own. You don't touch anything."

Then IMMEDIATELY transition to the close:

"It's easier if I just show you. Could I get you down for a quick Zoom this week? 15 minutes, I'll share my screen and walk you through it. Evenings work for you?"

ALWAYS push for screen share over phone. Every meeting that booked came from pushing for Zoom. Visual demos close. Phone calls don't.`,
  },
  {
    id: 4,
    title: 'Voicemail',
    icon: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
    content: `20 seconds MAX. Curiosity hook, not a pitch.

"Hey [NAME], it's Brian. I just helped a [TRADE] company in [NEARBY AREA] pick up 15 extra calls last month from Google -- zero ad spend. I'm picking one more business in [AREA] to do the same thing for free. If you want the slot, shoot me a text at [PHONE]. Again, it's Brian, [PHONE]. [PHONE]."

RULES:
- Lead with a RESULT, not your name or school. Nobody cares who you are on a voicemail.
- "Picking one more business" -- scarcity. They'll lose it if they wait.
- Repeat the number THREE times. They are not sitting there with a pen.
- Text them immediately after: "Hey [NAME], just left you a VM -- I helped a [TRADE] company in [AREA] add 15+ calls/month from Google, no ads. Want me to show you how it works for your area?"`,
  },
];

const OBJECTIONS = [
  { id: 10, title: "What's the catch?", icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', content: `"No catch. I'm a student building a portfolio. I need real businesses to prove this works. You're the proof. If I can show that I took a [TRADE] company and got them ranking on Google and pulling in calls, that's worth more to me than what I'd charge you right now."` },
  { id: 11, title: 'Already have a guy', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', content: `"Are you happy with the results? [Let them answer -- this is the most important pause in the call.] The thing that makes this different is it runs every single day automatically. Most agencies set it and forget it. This system checks what's ranking, what's not, and adjusts daily. And since it's free to try, you're not replacing anything. Think of it as a second opinion."

From transcript data: Francisco (Menifee Gardening) had this objection. Brian pivoted with "I'm sure your friend's doing great, but I'd be willing to guarantee I can do better" -- direct, confident, kept the door open.` },
  { id: 12, title: "Don't need more work", icon: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3', content: `"That's a great problem to have. But are you busy because you're booked solid, or busy because you're running around doing everything yourself? Most guys I talk to are busy but they're not turning down jobs. And the ones that are, they want to pick and choose the higher-paying ones. That's what more visibility gets you."` },
  { id: 13, title: 'Prove it works', icon: 'M18 20V10M12 20V4M6 20v-6', content: `"I've got a client who went from invisible on Google to ranking number one for their main keyword in under 60 days. Same system. I can show you the data on a quick Zoom if you want."

Then book the meeting -- this is a buying signal.` },
  { id: 14, title: 'Need to think about it', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2', content: `"Totally fair. But there's nothing to think about cost-wise -- it's free. The only question is whether you want more people finding you on Google. I'm only doing this with a couple businesses in your area, so can I get you down for a quick Zoom this week? That way you can see exactly what it does before you decide anything."` },
  { id: 15, title: 'Send me info', icon: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6', content: `"For sure. What's your email? I'll send over a breakdown of where your business stands online right now and exactly what the system would do. Fair warning -- I'm going to follow up in 2 days to see what you think."

Then follow up in exactly 2 days. Not 3. Not "sometime next week."` },
  { id: 16, title: 'How much after free?', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', content: `"A few hundred a month. Way less than ads, and unlike ads, it keeps compounding even between payments. But let's not worry about that right now. Let me just show you what it does and you can decide if the results are worth it."

From transcript data: Jacob (Clean Cut) asked "How much will I have to pay?" on the confirmation call. He was already in buying mode. When they ask about price, they're considering it -- don't panic, just bridge to the demo.` },
  { id: 17, title: "Don't trust AI", icon: 'M12 9v2m0 4h.01M3.46 6.95l1.06 1.06M2 12h1.5M3.46 17.05l1.06-1.06M20.54 6.95l-1.06 1.06M22 12h-1.5M20.54 17.05l-1.06-1.06M12 2v1.5M12 20.5V22M8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0z', content: `"I get it. Think of it less like AI and more like a marketing assistant that works every day. Your real photos, your real service areas, your real voice. You have full control and nothing goes up that you don't approve."

If they push back harder: "What happened with the last company you tried? ... Yeah, that's exactly why I do the first month free. Zero risk."` },
];

const GATEKEEPER = [
  { id: 20, title: 'Standard', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', content: `"Hey, is [OWNER NAME] around? ... No worries. My name's Brian, I'm a student at Cal State San Marcos. I'm looking for one [TRADE] company in [AREA] to test a project with for free. Would you be able to leave him a note to give me a call? My number is [PHONE]."

Never say "marketing," "SEO," or "advertising." Those words get you screened instantly. "Leave him a note" is better than "have him call me back." A note feels smaller.` },
  { id: 21, title: "What's it about?", icon: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', content: `"I'm a student and I built a system that helps businesses show up more on Google. I'm not selling anything -- I'm looking for a business to try it out on for free so I can use it as a case study. I just need a couple minutes with [OWNER NAME] to see if it'd be a fit."` },
  { id: 22, title: 'Just email him', icon: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6', content: `"For sure, what's his email? I'll keep it short. And what was your name? I appreciate the help."` },
  { id: 23, title: 'Chatty gatekeeper', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', content: `Don't pitch them. But ask: "How long have you guys been in business?" or "Are you guys pretty busy right now?" Whatever they say, reference it when you reach the owner.

If you can't get through, call back at 7 AM or 5 PM when the owner answers directly.` },
];

const CLOSING = [
  { id: 30, title: 'Warm Close', icon: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z', content: `"Cool. What I'll do is put together a quick breakdown of your online presence -- where you're showing up, where you're not, and what the system would do in the first 30 days. Can we hop on a Zoom [DAY] evening? Takes 15 minutes."

Use declarative language: "I've got you down for Thursday at 5:30. You'll get a Zoom link tomorrow." Don't ask -- confirm.` },
  { id: 31, title: 'Email Close', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', content: `"No problem. What's the best email? I'll send it today. And is [NAME] the best person to talk to about this?"` },
  { id: 32, title: 'Graceful No', icon: 'M14 9V5a3 3 0 0 0-6 0v4M5 9h14l1 12H4L5 9z', content: `"No worries at all. Appreciate your time. Have a good one, [NAME]."

Move on. Do not linger.` },
  { id: 33, title: 'Key Rules', icon: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z', content: `1. Never say "SEO." Say "getting found on Google" or "showing up when people search."
2. Never say "services." Say "system." One system that runs automatically.
3. Kill the filler words. "Like," "kinda," "I guess" -- these destroy credibility.
4. Stop apologizing for calling. "Kind of a weird call" works. "I'm sorry" does not.
5. Never undercut the free offer. Frame it as a case study where YOU chose THEM.
6. Always push for Zoom/screen share. Phone calls inform. Visual demos close.
7. Ask questions, don't lecture. Target talk ratio: under 0.40.
8. Always get the next step. Never hang up without a meeting, email, or follow-up time.
9. Match their energy -- then go one notch higher. Your close scored 8/10 energy. Cold calls average 4-5.
10. Create urgency. "I'm only doing this with a couple businesses in your area."
11. Double-check the business name before you dial. You called Clean Cut "Clinica Landscaping."
12. Confirm meeting details by text immediately after booking.` },
];


const A = '#E8FF00';

function Icon({ path, size = 18, color = A }: { path: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

// ── Expandable Card: content reveals inline ──

function Card({ item, isOpen, onToggle, big }: {
  item: { id: number; title: string; icon: string; content: string };
  isOpen: boolean; onToggle: () => void; big?: boolean;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (innerRef.current) setHeight(innerRef.current.scrollHeight);
  }, [isOpen]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Clickable header */}
      <button onClick={onToggle} className="sc-card" style={{
        display: 'flex', alignItems: 'center', gap: big ? 14 : 10,
        padding: big ? '12px 18px' : '10px 14px',
        background: isOpen ? `${A}14` : `${A}06`,
        border: `1.5px solid ${isOpen ? A : A + '40'}`,
        borderRadius: isOpen ? '10px 10px 0 0' : 10,
        cursor: 'pointer', textAlign: 'left', width: '100%', boxSizing: 'border-box',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <div style={{
          width: big ? 38 : 30, height: big ? 38 : 30, borderRadius: 8,
          background: isOpen ? `${A}22` : `${A}08`,
          border: `1px solid ${isOpen ? A + '55' : A + '25'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          transition: 'all 0.25s ease',
        }}>
          <Icon path={item.icon} size={big ? 18 : 14} color={isOpen ? A : `${A}88`} />
        </div>
        <span style={{
          fontSize: big ? 15 : 12, fontWeight: 600, flex: 1, lineHeight: 1.2,
          color: isOpen ? A : '#E8EAED', transition: 'color 0.2s ease',
        }}>
          {item.title}
        </span>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none"
          stroke={isOpen ? A : `${A}55`} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', flexShrink: 0 }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Expanding content */}
      <div style={{
        overflow: 'hidden',
        maxHeight: isOpen ? height + 40 : 0,
        opacity: isOpen ? 1 : 0,
        transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
      }}>
        <div ref={innerRef} style={{
          padding: '18px 22px',
          background: 'linear-gradient(180deg, #111827 0%, #0E1325 100%)',
          border: `1.5px solid ${A}`,
          borderTop: `1px solid ${A}33`,
          borderRadius: '0 0 10px 10px',
          fontSize: 16, lineHeight: 1.75, letterSpacing: '0.01em',
          color: '#F0F0F0',
          whiteSpace: 'pre-wrap',
          boxShadow: `inset 0 1px 0 ${A}15, 0 4px 20px rgba(0,0,0,0.3)`,
        }}>
          {item.content}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 4px' }}>
      <div style={{ width: 3, height: 14, borderRadius: 2, background: A }} />
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        color: `${A}88`, textTransform: 'uppercase',
        fontFamily: 'var(--font-mono, monospace)',
      }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: `${A}15` }} />
    </div>
  );
}

// ── Main ──

export default function ScriptPage() {
  const [openId, setOpenId] = useState<number | null>(null);
  const toggle = (id: number) => setOpenId(prev => prev === id ? null : id);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <>
      <style>{`
        .sc-card { transition: all 0.2s cubic-bezier(0.4,0,0.2,1); }
        .sc-card:hover { background: ${A}12 !important; border-color: ${A} !important; box-shadow: 0 0 16px ${A}15; }
        .sc-card:active { transform: scale(0.98); }
      `}</style>
      <div style={{
        minHeight: '100vh', background: '#0A0F1E', color: '#E8EAED',
        fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 20px', borderBottom: `1px solid ${A}20`,
          position: 'sticky', top: 0, zIndex: 10, background: '#0A0F1E',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: A, fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.08em' }}>
            CALL SCRIPT v2
          </span>
          <a href="/sales-engine" style={{
            fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: `${A}66`,
            textDecoration: 'none', padding: '5px 12px', border: `1px solid ${A}30`, borderRadius: 6,
          }}>&#8249; Sales Engine</a>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 14px' }}>
          {/* OPENING */}
          <SectionLabel label="Opening Flow" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {OPENING.map(item => (
              <Card key={item.id} item={item} isOpen={openId === item.id} onToggle={() => toggle(item.id)} big />
            ))}
          </div>

          {/* OBJECTIONS */}
          <SectionLabel label="Objections" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {OBJECTIONS.map(item => (
              <Card key={item.id} item={item} isOpen={openId === item.id} onToggle={() => toggle(item.id)} />
            ))}
          </div>

          {/* GATEKEEPER */}
          <SectionLabel label="Gatekeeper" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {GATEKEEPER.map(item => (
              <Card key={item.id} item={item} isOpen={openId === item.id} onToggle={() => toggle(item.id)} />
            ))}
          </div>

          {/* CLOSING */}
          <SectionLabel label="Closing" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {CLOSING.map(item => (
              <Card key={item.id} item={item} isOpen={openId === item.id} onToggle={() => toggle(item.id)} />
            ))}
          </div>

        </div>
      </div>
    </>
  );
}
