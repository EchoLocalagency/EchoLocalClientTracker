'use client';

import { useState, useEffect, useRef } from 'react';

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

const SECTION_COLORS = [
  '#00CED1', '#E8FF00', '#FF3D57', '#00E676', '#FF9F43',
  '#A78BFA', '#38BDF8', '#F472B6', '#34D399', '#FBBF24',
  '#818CF8', '#FB7185', '#00CED1',
];

export default function ScriptPage() {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([1]));
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const toggleSection = (id: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const scrollToSection = (id: number) => {
    setExpandedSections(prev => new Set(prev).add(id));
    setTimeout(() => {
      const el = sectionRefs.current[id];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key;
      if (key >= '1' && key <= '9') {
        scrollToSection(parseInt(key, 10));
      } else if (key === '0') {
        scrollToSection(10);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0A0F1E', color: '#E8EAED', display: 'flex' }}>
      {/* Sidebar: section pills */}
      <nav style={{
        position: 'sticky',
        top: 0,
        height: '100vh',
        width: 64,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 80,
        gap: 8,
        borderRight: '1px solid rgba(255,255,255,0.08)',
      }}>
        {SCRIPT_SECTIONS.map((s, i) => {
          const isOpen = expandedSections.has(s.id);
          return (
            <button
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              title={`${s.id}. ${s.title}`}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: 'none',
                background: isOpen ? SECTION_COLORS[i] : 'rgba(255,255,255,0.06)',
                color: isOpen ? '#0A0F1E' : 'rgba(255,255,255,0.5)',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'var(--font-mono, monospace)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {s.id}
            </button>
          );
        })}
      </nav>

      {/* Main content */}
      <div style={{ flex: 1, maxWidth: 800, margin: '0 auto', padding: '0 40px 80px' }}>
        {/* Sticky header */}
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#0A0F1E',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '20px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Call Script</h1>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontFamily: 'var(--font-mono, monospace)' }}>
              Press 1-9 / 0 to jump to sections
            </div>
          </div>
          <a
            href="/sales-engine"
            style={{
              fontSize: 13,
              fontFamily: 'var(--font-mono, monospace)',
              color: 'rgba(255,255,255,0.5)',
              textDecoration: 'none',
              padding: '8px 16px',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6,
            }}
          >
            &#8249; Sales Engine
          </a>
        </header>

        {/* Sections */}
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SCRIPT_SECTIONS.map((section, i) => {
            const isOpen = expandedSections.has(section.id);
            const color = SECTION_COLORS[i];
            return (
              <div
                key={section.id}
                ref={el => { sectionRefs.current[section.id] = el; }}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${isOpen ? color + '44' : 'rgba(255,255,255,0.06)'}`,
                  background: isOpen ? `${color}08` : 'transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                <button
                  onClick={() => toggleSection(section.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    width: '100%',
                    padding: '16px 20px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: isOpen ? color : 'rgba(255,255,255,0.06)',
                    color: isOpen ? '#0A0F1E' : 'rgba(255,255,255,0.5)',
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono, monospace)',
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                  }}>
                    {section.id}
                  </span>
                  <span style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: '#E8EAED',
                    flex: 1,
                  }}>
                    {section.title}
                  </span>
                  <span style={{
                    fontSize: 14,
                    color: 'rgba(255,255,255,0.3)',
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}>
                    &#9654;
                  </span>
                </button>
                {isOpen && (
                  <div style={{
                    padding: '0 20px 20px 66px',
                    color: 'rgba(255,255,255,0.75)',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    fontSize: 16,
                  }}>
                    {section.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
