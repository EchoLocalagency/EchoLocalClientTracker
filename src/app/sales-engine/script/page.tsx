'use client';

import { useState, useEffect } from 'react';

const SCRIPT_SECTIONS = [
  {
    id: 1,
    title: 'The Opener',
    content: `"Hey [NAME], this is Brian. I know you're probably busy so I'll keep this quick. I'm a local student out here at Cal State San Marcos -- I built a system that helps turf [or whatever trade] companies get more jobs through Google without paying for ads. I'm looking for a few businesses to try it out with completely free. Got 60 seconds for me to explain how it works?"

If they say yes, go to The Pitch.
If they say "I'm busy": "Totally get it. When's a better time for a 2 minute call? I'll be quick, I promise."
If they say "not interested": "No worries at all. Just out of curiosity, are you getting most of your jobs from Google right now or is it mostly word of mouth?"`,
  },
  {
    id: 2,
    title: 'The Pitch',
    content: `"So here's the deal. You know your Google Business Profile, the thing that shows up when someone searches for [TRADE] near them? Most businesses set it up once and never touch it again. Google sees that and pushes you down. The businesses getting the most calls are the ones that are active on there every single day.

That's what my system does. It automatically posts your job photos to your GBP, responds to every single review so Google sees you're engaged, seeds Q&A with the questions your customers are actually asking. All without you doing anything.

But here's where it gets good. The system also watches what's working and what's not, 24/7. If a keyword is close to ranking, it adjusts your site to push it over. If a certain type of post is getting more views, it makes more of those. It's a constant feedback loop between your GBP and your website, always improving, always learning what gets you showing up higher.

And then on top of that, it builds out pages for every city you serve. So instead of only showing up in [THEIR CITY], you're showing up in [NEARBY CITY 1], [NEARBY CITY 2], [NEARBY CITY 3]. Every page is another net in the water catching jobs.

The whole thing runs automatically, every single day. More visibility, more calls, more jobs. And right now I'm testing it with a handful of businesses completely free. No cost, no contract, no catch. I just need real businesses to build case studies with."`,
  },
  {
    id: 3,
    title: "What's the catch?",
    content: `"Honestly, there isn't one. I'm a college kid who built something that works and I need businesses to prove it. You're doing me the favor by letting me test it on your business. Worst case, you get a free month of work and we part ways."`,
  },
  {
    id: 4,
    title: 'Already have an SEO guy',
    content: `"That's great, are you happy with the results? [Let them answer.] The thing that makes this different is it runs every single day automatically. Most agencies set it and forget it. This system is checking what's ranking, what's not, and adjusting daily. And since it's free to try, it's not like you're replacing anything. Think of it as a second opinion."`,
  },
  {
    id: 5,
    title: "I don't need more work",
    content: `"That's a great problem to have. But let me ask you this -- are you busy because you're booked solid, or busy because you're running around doing everything yourself? Most guys I talk to are busy but they're not turning down jobs. And the ones that are, they want to be able to pick and choose the higher paying ones. That's what more visibility gets you."`,
  },
  {
    id: 6,
    title: 'How do I know this works?',
    content: `"I've got a turf cleaning client who went from basically invisible on Google to the number one result for their main keyword in under 60 days. Same system, same approach. I can show you the data if you want."`,
  },
  {
    id: 7,
    title: 'I need to think about it',
    content: `"Totally fair. But just so you know, there's nothing to think about cost-wise because it's free. The only question is whether you want more people finding you on Google. Can I send you a quick email breaking down exactly what we'd do for your business? That way you can look at it on your own time."`,
  },
  {
    id: 8,
    title: 'Send me some info',
    content: `"For sure. What's your email? I'll send over a breakdown of where your business stands online right now and exactly what the system would do for you. Fair warning, I'm going to follow up in a couple days to see what you think."`,
  },
  {
    id: 9,
    title: 'How much after free month?',
    content: `"Depends on the scope but we're talking a few hundred a month. Way less than ads, and unlike ads it keeps working even between payments. But let's not even worry about that right now. Let me just show you what the system does first and you can decide if the results are worth it."`,
  },
  {
    id: 10,
    title: 'Closing - Warm',
    content: `"Cool, so what I'll do is put together a quick breakdown of your online presence right now -- where you're showing up, where you're not, and what the system would do in the first 30 days. Can we hop on a quick call [TOMORROW/THURSDAY/FRIDAY] so I can walk you through it? Takes about 10 minutes."`,
  },
  {
    id: 11,
    title: 'Closing - Email only',
    content: `"No problem. I'll send that over today. What's the best email? And is [THEIR NAME] the best person to talk to about this?"`,
  },
  {
    id: 12,
    title: 'Closing - No',
    content: `"No worries at all, I appreciate your time. If anything changes, I'm easy to find. Have a good one, [NAME]."`,
  },
  {
    id: 13,
    title: 'Key Rules',
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

export default function ScriptPage() {
  const [openSection, setOpenSection] = useState<number | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        setOpenSection(null);
        return;
      }
      if (e.key >= '1' && e.key <= '9') {
        setOpenSection(parseInt(e.key, 10));
      } else if (e.key === '0') {
        setOpenSection(10);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const open = openSection != null ? SCRIPT_SECTIONS.find(s => s.id === openSection) : null;

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: '#0A0F1E',
      color: '#E8EAED',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 20px',
        borderBottom: `1px solid ${ACCENT}22`,
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: ACCENT, fontFamily: 'var(--font-mono, monospace)' }}>
          CALL SCRIPT
        </div>
        <a
          href="/sales-engine"
          style={{
            fontSize: 12,
            fontFamily: 'var(--font-mono, monospace)',
            color: 'rgba(255,255,255,0.4)',
            textDecoration: 'none',
            padding: '5px 12px',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
          }}
        >
          &#8249; Sales Engine
        </a>
      </div>

      {/* Grid: fills remaining space */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gridTemplateRows: '2fr 1fr 1fr 1fr',
        gap: 6,
        padding: 6,
        minHeight: 0,
      }}>
        {/* Row 1: Opener (2 cols) + Pitch (2 cols) -- big boxes */}
        <GridBox id={1} title="The Opener" span={2} accent={ACCENT} onClick={() => setOpenSection(1)} />
        <GridBox id={2} title="The Pitch" span={2} accent={ACCENT} onClick={() => setOpenSection(2)} />

        {/* Row 2: Objections 3-6 */}
        <GridBox id={3} title="What's the catch?" accent={ACCENT} onClick={() => setOpenSection(3)} />
        <GridBox id={4} title="Already have an SEO guy" accent={ACCENT} onClick={() => setOpenSection(4)} />
        <GridBox id={5} title="Don't need more work" accent={ACCENT} onClick={() => setOpenSection(5)} />
        <GridBox id={6} title="How do I know it works?" accent={ACCENT} onClick={() => setOpenSection(6)} />

        {/* Row 3: Objections 7-9 + Key Rules */}
        <GridBox id={7} title="Need to think about it" accent={ACCENT} onClick={() => setOpenSection(7)} />
        <GridBox id={8} title="Send me some info" accent={ACCENT} onClick={() => setOpenSection(8)} />
        <GridBox id={9} title="How much after free?" accent={ACCENT} onClick={() => setOpenSection(9)} />
        <GridBox id={13} title="Key Rules" accent={ACCENT} onClick={() => setOpenSection(13)} />

        {/* Row 4: Closings */}
        <GridBox id={10} title="Closing - Warm" accent={ACCENT} onClick={() => setOpenSection(10)} />
        <GridBox id={11} title="Closing - Email" accent={ACCENT} onClick={() => setOpenSection(11)} />
        <GridBox id={12} title="Closing - No" accent={ACCENT} onClick={() => setOpenSection(12)} />
        <div /> {/* empty cell */}
      </div>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={() => setOpenSection(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 40,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0F1420',
              border: `1px solid ${ACCENT}44`,
              borderRadius: 14,
              maxWidth: 700,
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              padding: '32px 36px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: ACCENT,
                color: '#0A0F1E',
                fontSize: 16,
                fontWeight: 700,
                fontFamily: 'var(--font-mono, monospace)',
                flexShrink: 0,
              }}>
                {open.id}
              </span>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
                {open.title}
              </h2>
            </div>
            <div style={{
              fontSize: 17,
              lineHeight: 1.7,
              color: 'rgba(255,255,255,0.8)',
              whiteSpace: 'pre-wrap',
            }}>
              {open.content}
            </div>
            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <button
                onClick={() => setOpenSection(null)}
                style={{
                  fontSize: 13,
                  fontFamily: 'var(--font-mono, monospace)',
                  padding: '8px 20px',
                  borderRadius: 6,
                  border: `1px solid ${ACCENT}44`,
                  background: 'transparent',
                  color: ACCENT,
                  cursor: 'pointer',
                }}
              >
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GridBox({
  id,
  title,
  accent,
  span,
  onClick,
}: {
  id: number;
  title: string;
  accent: string;
  span?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        gridColumn: span ? `span ${span}` : undefined,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        background: 'rgba(232, 255, 0, 0.04)',
        border: `1px solid ${accent}22`,
        borderRadius: 10,
        cursor: 'pointer',
        padding: '12px 16px',
        transition: 'all 0.15s ease',
        minHeight: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(232, 255, 0, 0.10)';
        e.currentTarget.style.borderColor = `${accent}66`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(232, 255, 0, 0.04)';
        e.currentTarget.style.borderColor = `${accent}22`;
      }}
    >
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: span ? 40 : 32,
        height: span ? 40 : 32,
        borderRadius: '50%',
        background: accent,
        color: '#0A0F1E',
        fontSize: span ? 18 : 14,
        fontWeight: 700,
        fontFamily: 'var(--font-mono, monospace)',
        flexShrink: 0,
      }}>
        {id}
      </span>
      <span style={{
        fontSize: span ? 16 : 13,
        fontWeight: 600,
        color: '#E8EAED',
        textAlign: 'center',
        lineHeight: 1.3,
      }}>
        {title}
      </span>
    </button>
  );
}
