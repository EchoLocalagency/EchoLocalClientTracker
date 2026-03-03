'use client';

import { useState, useEffect, useRef } from 'react';

// ── Data ──

const OPENING = [
  {
    id: 1,
    title: 'The Opener',
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', // layers
    content: `"Hey [NAME], this is Brian. I know you're probably busy so I'll keep this quick. I'm a local student out here at Cal State San Marcos -- I built a system that helps turf [or whatever trade] companies get more jobs through Google without paying for ads. I'm looking for a few businesses to try it out with completely free. Got 60 seconds for me to explain how it works?"

If they say yes, go to The Pitch.
If they say "I'm busy": "Totally get it. When's a better time for a 2 minute call? I'll be quick, I promise."
If they say "not interested": "No worries at all. Just out of curiosity, are you getting most of your jobs from Google right now or is it mostly word of mouth?"`,
  },
  {
    id: 2,
    title: 'The Pitch',
    icon: 'M13 2L3 14h9l-1 10 10-12h-9l1-10', // lightning bolt
    content: `"So here's the deal. You know your Google Business Profile, the thing that shows up when someone searches for [TRADE] near them? Most businesses set it up once and never touch it again. Google sees that and pushes you down. The businesses getting the most calls are the ones that are active on there every single day.

That's what my system does. It automatically posts your job photos to your GBP, responds to every single review so Google sees you're engaged, seeds Q&A with the questions your customers are actually asking. All without you doing anything.

But here's where it gets good. The system also watches what's working and what's not, 24/7. If a keyword is close to ranking, it adjusts your site to push it over. If a certain type of post is getting more views, it makes more of those. It's a constant feedback loop between your GBP and your website, always improving, always learning what gets you showing up higher.

And then on top of that, it builds out pages for every city you serve. So instead of only showing up in [THEIR CITY], you're showing up in [NEARBY CITY 1], [NEARBY CITY 2], [NEARBY CITY 3]. Every page is another net in the water catching jobs.

The whole thing runs automatically, every single day. More visibility, more calls, more jobs. And right now I'm testing it with a handful of businesses completely free. No cost, no contract, no catch. I just need real businesses to build case studies with."`,
  },
];

const OBJECTIONS = [
  {
    id: 3,
    title: "What's the catch?",
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', // shield
    content: `"Honestly, there isn't one. I'm a college kid who built something that works and I need businesses to prove it. You're doing me the favor by letting me test it on your business. Worst case, you get a free month of work and we part ways."`,
  },
  {
    id: 4,
    title: 'Already have a guy',
    icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', // users
    content: `"That's great, are you happy with the results? [Let them answer.] The thing that makes this different is it runs every single day automatically. Most agencies set it and forget it. This system is checking what's ranking, what's not, and adjusting daily. And since it's free to try, it's not like you're replacing anything. Think of it as a second opinion."`,
  },
  {
    id: 5,
    title: "Don't need more work",
    icon: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3', // check-circle
    content: `"That's a great problem to have. But let me ask you this -- are you busy because you're booked solid, or busy because you're running around doing everything yourself? Most guys I talk to are busy but they're not turning down jobs. And the ones that are, they want to be able to pick and choose the higher paying ones. That's what more visibility gets you."`,
  },
  {
    id: 6,
    title: 'Prove it works',
    icon: 'M18 20V10M12 20V4M6 20v-6', // bar-chart
    content: `"I've got a turf cleaning client who went from basically invisible on Google to the number one result for their main keyword in under 60 days. Same system, same approach. I can show you the data if you want."`,
  },
  {
    id: 7,
    title: 'Need to think about it',
    icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2', // clock
    content: `"Totally fair. But just so you know, there's nothing to think about cost-wise because it's free. The only question is whether you want more people finding you on Google. Can I send you a quick email breaking down exactly what we'd do for your business? That way you can look at it on your own time."`,
  },
  {
    id: 8,
    title: 'Send me info',
    icon: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6', // mail
    content: `"For sure. What's your email? I'll send over a breakdown of where your business stands online right now and exactly what the system would do for you. Fair warning, I'm going to follow up in a couple days to see what you think."`,
  },
  {
    id: 9,
    title: 'How much after free?',
    icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', // dollar
    content: `"Depends on the scope but we're talking a few hundred a month. Way less than ads, and unlike ads it keeps working even between payments. But let's not even worry about that right now. Let me just show you what the system does first and you can decide if the results are worth it."`,
  },
];

const CLOSING = [
  {
    id: 10,
    title: 'Warm Close',
    icon: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z', // feather/rocket
    content: `"Cool, so what I'll do is put together a quick breakdown of your online presence right now -- where you're showing up, where you're not, and what the system would do in the first 30 days. Can we hop on a quick call [TOMORROW/THURSDAY/FRIDAY] so I can walk you through it? Takes about 10 minutes."`,
  },
  {
    id: 11,
    title: 'Email Close',
    icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', // message-square
    content: `"No problem. I'll send that over today. What's the best email? And is [THEIR NAME] the best person to talk to about this?"`,
  },
  {
    id: 12,
    title: 'Graceful No',
    icon: 'M14 9V5a3 3 0 0 0-6 0v4M5 9h14l1 12H4L5 9z', // shopping-bag (gift/goodbye)
    content: `"No worries at all, I appreciate your time. If anything changes, I'm easy to find. Have a good one, [NAME]."`,
  },
  {
    id: 13,
    title: 'Key Rules',
    icon: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z', // book-open
    content: `1. Don't say "SEO." Say "getting found on Google" or "showing up when people search." SEO sounds like a sales pitch. The other sounds like a result.
2. Don't say "services." Say "system." It's one system that does everything automatically. That's the differentiator.
3. Lead with the student angle. It's disarming. People want to help students. It also explains why it's free without sounding sketchy.
4. Ask questions, don't lecture. The more they talk, the more you learn, and the more bought in they get.
5. Always get the next step. Never hang up without either a meeting booked, an email to send, or a follow-up time set.
6. Match their energy. If they're chill, be chill. If they're direct, be direct. Don't be the overly enthusiastic salesman.
7. It's free. Remind them. When they hesitate, the answer is always "there's zero risk because it's free."`,
  },
];

const ACCENT = '#E8FF00';
const BG = '#0A0F1E';
const SURFACE = '#0E1325';

// ── SVG Icon ──

function Icon({ path, size = 20, color = ACCENT }: { path: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

// ── Expandable Card ──

function Card({
  item,
  isOpen,
  onToggle,
  big,
}: {
  item: { id: number; title: string; icon: string; content: string };
  isOpen: boolean;
  onToggle: () => void;
  big?: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [isOpen]);

  return (
    <div
      style={{
        position: 'relative',
        zIndex: isOpen ? 50 : 1,
        gridColumn: big ? 'span 1' : undefined,
      }}
    >
      {/* The clickable tile */}
      <button
        onClick={onToggle}
        className="script-card"
        data-active={isOpen || undefined}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: big ? 14 : 10,
          padding: big ? '14px 20px' : '10px 14px',
          background: isOpen ? `${ACCENT}14` : `${ACCENT}06`,
          border: `1px solid ${isOpen ? ACCENT + '55' : ACCENT + '18'}`,
          borderRadius: isOpen ? '10px 10px 0 0' : 10,
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          height: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Icon emblem */}
        <div style={{
          width: big ? 40 : 32,
          height: big ? 40 : 32,
          borderRadius: 8,
          background: isOpen ? `${ACCENT}22` : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isOpen ? ACCENT + '44' : 'rgba(255,255,255,0.06)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <Icon path={item.icon} size={big ? 20 : 16} color={isOpen ? ACCENT : 'rgba(255,255,255,0.45)'} />
        </div>

        {/* Title */}
        <span style={{
          fontSize: big ? 15 : 13,
          fontWeight: 600,
          color: isOpen ? ACCENT : '#E8EAED',
          flex: 1,
          lineHeight: 1.2,
          transition: 'color 0.2s ease',
        }}>
          {item.title}
        </span>

        {/* Expand indicator */}
        <svg
          width={14} height={14} viewBox="0 0 24 24" fill="none"
          stroke={isOpen ? ACCENT : 'rgba(255,255,255,0.25)'}
          strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          style={{
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown content */}
      <div style={{
        overflow: 'hidden',
        maxHeight: isOpen ? contentHeight : 0,
        opacity: isOpen ? 1 : 0,
        transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease',
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        zIndex: 50,
      }}>
        <div
          ref={contentRef}
          style={{
            background: SURFACE,
            border: `1px solid ${ACCENT}33`,
            borderTop: 'none',
            borderRadius: '0 0 10px 10px',
            padding: '16px 20px',
            fontSize: 15,
            lineHeight: 1.65,
            color: 'rgba(255,255,255,0.8)',
            whiteSpace: 'pre-wrap',
            boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${ACCENT}08`,
            maxHeight: '50vh',
            overflowY: 'auto',
          }}
        >
          {item.content}
        </div>
      </div>
    </div>
  );
}

// ── Section Header ──

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '0 4px',
      flexShrink: 0,
    }}>
      <div style={{
        width: 3,
        height: 14,
        borderRadius: 2,
        background: ACCENT,
      }} />
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: 'rgba(255,255,255,0.35)',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-mono, monospace)',
      }}>
        {label}
      </span>
      <div style={{
        flex: 1,
        height: 1,
        background: 'rgba(255,255,255,0.06)',
      }} />
    </div>
  );
}

// ── Main Page ──

export default function ScriptPage() {
  const [openId, setOpenId] = useState<number | null>(null);

  const toggle = (id: number) => {
    setOpenId(prev => prev === id ? null : id);
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        setOpenId(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      {/* Keyframe animations + hover styles */}
      <style>{`
        .script-card:hover {
          background: ${ACCENT}10 !important;
          border-color: ${ACCENT}40 !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(232, 255, 0, 0.06);
        }
        .script-card[data-active]:hover {
          transform: none;
          box-shadow: none;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .script-page-enter {
          animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .script-card {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
      `}</style>

      <div className="script-page-enter" style={{
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: BG,
        color: '#E8EAED',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 20px',
          borderBottom: `1px solid ${ACCENT}15`,
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: ACCENT,
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.06em',
          }}>
            CALL SCRIPT
          </div>
          <a
            href="/sales-engine"
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono, monospace)',
              color: 'rgba(255,255,255,0.35)',
              textDecoration: 'none',
              padding: '5px 12px',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              transition: 'all 0.15s ease',
            }}
          >
            &#8249; Sales Engine
          </a>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '12px 16px',
          minHeight: 0,
          overflow: 'hidden',
        }}>

          {/* OPENING */}
          <SectionLabel label="Opening" />
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            flex: '1.4 1 0%',
            minHeight: 0,
          }}>
            {OPENING.map(item => (
              <Card key={item.id} item={item} isOpen={openId === item.id} onToggle={() => toggle(item.id)} big />
            ))}
          </div>

          {/* OBJECTIONS */}
          <SectionLabel label="Objections" />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gridTemplateRows: '1fr 1fr',
            gap: 6,
            flex: '2 1 0%',
            minHeight: 0,
          }}>
            {/* Row 1: 4 objections */}
            {OBJECTIONS.slice(0, 4).map(item => (
              <Card key={item.id} item={item} isOpen={openId === item.id} onToggle={() => toggle(item.id)} />
            ))}
            {/* Row 2: 3 objections, centered-ish by spanning middle */}
            <div />
            {OBJECTIONS.slice(4).map(item => (
              <Card key={item.id} item={item} isOpen={openId === item.id} onToggle={() => toggle(item.id)} />
            ))}
          </div>

          {/* CLOSING */}
          <SectionLabel label="Closing" />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            flex: '1 1 0%',
            minHeight: 0,
          }}>
            {CLOSING.map(item => (
              <Card key={item.id} item={item} isOpen={openId === item.id} onToggle={() => toggle(item.id)} />
            ))}
          </div>
        </div>
      </div>

      {/* Click-away layer when a dropdown is open */}
      {openId != null && (
        <div
          onClick={() => setOpenId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10,
            background: 'transparent',
          }}
        />
      )}
    </>
  );
}
