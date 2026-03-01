'use client';

import { useState } from 'react';
import { Report } from '@/lib/types';
import { generateSummary } from '@/lib/generateSummary';

interface SummaryTabProps {
  latestReport: Report | null;
  firstReport: Report | null;
  clientName: string;
}

export default function SummaryTab({ latestReport, firstReport, clientName }: SummaryTabProps) {
  const [copied, setCopied] = useState(false);

  if (!latestReport) {
    return <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center' }}>No data yet. Run your first report to generate a summary.</div>;
  }

  const summary = generateSummary(latestReport, firstReport, clientName);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = summary;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Client-Ready Summary</div>
        <button
          onClick={handleCopy}
          style={{
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            background: copied ? 'var(--success)' : 'var(--accent)',
            color: '#000',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {copied ? 'Copied!' : 'Copy for email'}
        </button>
      </div>

      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: '24px 28px',
      }}>
        <pre style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          lineHeight: 1.7,
          color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap',
          margin: 0,
        }}>
          {summary}
        </pre>
      </div>
    </div>
  );
}
