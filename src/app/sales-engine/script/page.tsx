'use client';

import { useState, useEffect, useRef } from 'react';

// ── Data ──

const OPENING = [
  {
    id: 1,
    title: 'The Opener',
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    content: `"Hey, is this [BUSINESS NAME]? ... Great. My name's Brian, I'm a student over at Cal State San Marcos. I had a quick question -- where are most of your jobs coming from right now? Is it Google, word of mouth, or something else?"

THEN SHUT UP AND LISTEN. Whatever they say, dig deeper:

If "word of mouth": "Nice, that's solid. So when someone does Google [TRADE] in [AREA], are you showing up? Have you looked?"
If "Google/ads": "Cool, what are you running? Ads, or are you getting organic calls too?"
If "we're busy enough": "That's great. Are you picking and choosing your jobs, or just taking everything that comes in?"
If "I'm busy right now": "Totally get it. When's a better 2 minutes for you -- morning or end of day?"
If "not interested": "No worries. Just curious -- you guys been around a while?"

THE GOAL: Get them talking about their business for 30+ seconds before you say anything about yours.`,
  },
  {
    id: 15,
    title: 'Voicemail',
    icon: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
    content: `"Hey [NAME], it's Brian. I'm a student at Cal State San Marcos -- had a quick question about your [TRADE] business. If you get a sec, shoot me a text at [PHONE]. Again, it's Brian, [PHONE]."

Keep it under 12 seconds. Don't pitch. Don't explain the system. The only goal is curiosity -- "quick question" makes them wonder what it is. "Shoot me a text" is lower friction than calling back. Always repeat the number. No details = they have to call back to find out.`,
  },
  {
    id: 2,
    title: 'Discovery Questions',
    icon: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
    content: `Ask these BEFORE pitching. Pick 2-3 based on the conversation:

"How long have you guys been in business?"
"How many trucks/crews you running right now?"
"Are you trying to grow or are you pretty comfortable where you're at?"
"What does your average job run, price-wise?"
"Have you ever worked with a marketing company before? How'd that go?"
"If I searched [TRADE] [CITY] right now, where do you think you'd show up?"
"What's the main thing holding you back from getting more jobs?"

LISTEN FOR: pain points, current marketing spend, growth ambition, bad past experiences, number of competitors. Use what they say to frame your pitch.

RULE: Do not pitch until you've asked at least 2 questions and they've talked for 30+ seconds total.`,
  },
  {
    id: 20,
    title: 'The Pitch',
    icon: 'M13 2L3 14h9l-1 10 10-12h-9l1-10',
    content: `Only pitch AFTER discovery. Reference what they told you:

SHORT VERSION (30 sec):
"So based on what you're telling me -- [REFERENCE THEIR SITUATION] -- I built a system that would help with exactly that. It works on your website and your Google profile every single day to get you showing up more. And right now I'm testing it with a few businesses for free. No cost, no contract. Can I show you what it would look like for [BUSINESS NAME]?"

EXAMPLE:
"So you said most of your jobs are word of mouth and you've never really tried the Google side -- that's actually perfect. I built a system that gets [TRADE] companies showing up when people search in [AREA]. It runs every day on its own. I'm testing it with one business in your area for free right now. Would you be open to seeing what it'd look like for you guys?"

RULES:
- Keep it under 30 seconds
- Reference something THEY said
- End with a question, not a statement
- Don't explain features unless they ask`,
  },
];

const OBJECTIONS = [
  { id: 3, title: "What's the catch?", icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', content: `"Fair question. What would make this feel legit to you?"

[Let them answer -- they'll tell you exactly what they need to hear.]

Then: "Makes sense. Here's the deal -- I'm a college kid who built something that works and I need real businesses to prove it. You'd actually be doing me the favor. Worst case you get a free month of work and we part ways. Does that sound reasonable?"` },
  { id: 4, title: 'Already have a guy', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', content: `"Oh nice, how long have you been working with them? ... And are you happy with what you're seeing?"

[Let them answer. If they hesitate or say "it's okay":]
"What would you change about it if you could?"

[If they're genuinely happy:]
"That's awesome, sounds like you're in good hands. Since mine's free, would it hurt to have a second engine running alongside? Think of it like a free second opinion."

[If they're not happy:]
"Yeah, that's actually what I hear a lot. What if I showed you what the system would do differently -- takes 10 minutes and it's free. What do you have to lose?"` },
  { id: 5, title: "Don't need more work", icon: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3', content: `"That's great, congrats. Let me ask you this -- are you turning away jobs, or are you just slammed doing everything yourself?"

[If turning away jobs:]
"So if you could pick and choose only the higher-paying ones, would that change things?"

[If just busy:]
"Yeah, there's a difference between busy and profitable. What does your average job run?"

The goal isn't to convince them they need more work -- it's to find out if they want BETTER work. Higher ticket, closer to home, less headache.` },
  { id: 6, title: 'Prove it works', icon: 'M18 20V10M12 20V4M6 20v-6', content: `"100%. What would you need to see to believe it?"

[Let them tell you their standard of proof, then match it:]

If "show me results": "I've got a turf cleaning client who went from invisible to #1 on Google in under 60 days. Want me to send you the screenshots?"
If "I've heard this before": "What did the last company promise you? ... And what actually happened?"
If vague: "Would it help if I ran a free audit on your business and showed you exactly where you stand vs your competitors right now?"

Always end with: "Can I send that over to you? What's your email?"` },
  { id: 7, title: 'Need to think about it', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2', content: `"Totally fair. What's the main thing you'd want to think through?"

[SHUT UP. Let them tell you the real objection. "Need to think about it" is never the real reason. The real reason is hiding behind it.]

If it's money: Handle as pricing objection -- "It's free to start."
If it's trust: "What would help you feel more comfortable?"
If it's time: "What if I did all the setup and you just had to say yes or no after seeing it?"
If they won't say: "No pressure at all. Can I send you a quick breakdown by email so you have something to look at? What's your email?"` },
  { id: 8, title: 'Send me info', icon: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6', content: `"For sure. What specifically would you want to see in the email?"

[This tells you what they actually care about -- use it to personalize the email.]

Then: "Got it. What's the best email? And when I follow up in a couple days, is a call or text better for you?"

Always lock in the follow-up method AND timing before hanging up. "I'll follow up" is weak. "I'll text you Thursday morning" is a commitment.` },
  { id: 9, title: 'How much after free?', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', content: `"Great question. What are you spending on marketing right now?"

[Let them answer. This anchors the price against their current spend.]

If they spend nothing: "So right now you're getting jobs for free through word of mouth. This system would just add more of that, but from Google. After the free month, it's a few hundred a month -- but only if the results are worth it to you."
If they spend on ads: "How much are your ads running you? ... Yeah, this is way less than that, and unlike ads it keeps compounding. But let's not even worry about price -- let me show you what it does first and you tell me if the results would be worth a few hundred a month."` },
  { id: 14, title: "Don't trust AI / automation", icon: 'M12 9v2m0 4h.01M3.46 6.95l1.06 1.06M2 12h1.5M3.46 17.05l1.06-1.06M20.54 6.95l-1.06 1.06M22 12h-1.5M20.54 17.05l-1.06-1.06M12 2v1.5M12 20.5V22M8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0z', content: `"Honestly, what's your biggest concern with it?"

[Let them talk. They'll usually say one of:]
- "It sounds fake/spammy" -> "Have you seen AI content that turned you off? What was wrong with it?"
- "I want a real person" -> "Yeah me too. I'm the real person -- the system just handles the grunt work so I can focus on strategy. Nothing goes live without matching your business."
- "I've been burned before" -> "What happened? ... Yeah, that's exactly why I do the first month free. Zero risk."

Short version if they're not opening up:
"I get it. Think of it less like AI and more like a marketing assistant that works every day. Your real photos, your real service areas, your real voice. You have full control and nothing goes up that you don't approve."` },
];

const GATEKEEPER = [
  { id: 16, title: 'Standard', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', content: `"Hey, is [OWNER NAME] around? ... Oh no worries. My name's Brian, I'm a local college student at Cal State San Marcos. I'm working on a project that helps [TRADE] businesses get more jobs from Google and I'm looking for one company in [AREA] to test it with for free. Would you be able to leave him a note to give me a call back? My number is [PHONE]. I'd really appreciate it."` },
  { id: 17, title: 'What\'s it about?', icon: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', content: `"I'm a student and I built a system that helps businesses show up more on Google. I'm not selling anything -- I'm actually looking for a business to try it out on for free so I can use it as a case study for school. I just need a couple minutes with [OWNER NAME] to see if it'd be a fit."` },
  { id: 18, title: 'Just email him', icon: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6', content: `"For sure, what's his email? I'll keep it short. And what was your name? I appreciate the help."` },
  { id: 19, title: 'Chatty gatekeeper', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', content: `Don't pitch them. But ask: "How long have you guys been in business?" or "Are you guys pretty busy right now?" Whatever they say, reference it when you talk to the owner later: "Yeah, I spoke with [GATEKEEPER NAME] and she mentioned you've been around for 12 years -- that's awesome."

Never say "marketing," "SEO," or "advertising" to a gatekeeper -- those words get you screened out instantly. Use their name if you catch it. "Leave him a note" is better than "have him call me back" -- a note feels smaller. If you can't get through, call back at 7am or 5pm when the owner answers directly.` },
];

const CLOSING = [
  { id: 10, title: 'Warm Close', icon: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z', content: `"Cool, so what I'll do is put together a quick breakdown of your online presence right now -- where you're showing up, where you're not, and what the system would do in the first 30 days. Can we hop on a quick call [TOMORROW/THURSDAY/FRIDAY] so I can walk you through it? Takes about 10 minutes."` },
  { id: 11, title: 'Email Close', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', content: `"No problem. I'll send that over today. What's the best email? And is [THEIR NAME] the best person to talk to about this?"` },
  { id: 12, title: 'Graceful No', icon: 'M14 9V5a3 3 0 0 0-6 0v4M5 9h14l1 12H4L5 9z', content: `"No worries at all, I appreciate your time. If anything changes, I'm easy to find. Have a good one, [NAME]."` },
  { id: 13, title: 'Key Rules', icon: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z', content: `1. QUESTIONS FIRST. Every response starts with a question. No exceptions.\n2. Don\'t say "SEO." Say "getting found on Google" or "showing up when people search."\n3. Don\'t say "services." Say "system." One system that does everything automatically.\n4. Lead with the student angle. It\'s disarming and explains why it\'s free.\n5. Talk ratio: aim for 30% you, 70% them. If you\'re talking more than them, you\'re losing.\n6. Always get a SPECIFIC next step. Not "I\'ll follow up" -- "I\'ll text you Thursday at 10am."\n7. Match their energy. Chill if they\'re chill, direct if they\'re direct.\n8. Reference what THEY said in your pitch. "You mentioned..." is the most powerful phrase.\n9. Silence is your weapon. Ask a question, then shut up. Count to 5 if you have to.\n10. It\'s free. Remind them. "There\'s zero risk because it\'s free."` },
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
            CALL SCRIPT
          </span>
          <a href="/sales-engine" style={{
            fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: `${A}66`,
            textDecoration: 'none', padding: '5px 12px', border: `1px solid ${A}30`, borderRadius: 6,
          }}>&#8249; Sales Engine</a>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 14px' }}>
          {/* OPENING */}
          <SectionLabel label="Opening" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
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
