'use client';

import { ReactNode } from 'react';

interface SeoEngineLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  sidebarWidth: number;
}

export default function SeoEngineLayout({ sidebar, children, sidebarWidth }: SeoEngineLayoutProps) {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
    }}>
      {sidebar}
      <main style={{
        flex: 1,
        marginLeft: sidebarWidth,
        transition: 'margin-left 0.2s ease',
      }}>
        {children}
      </main>
    </div>
  );
}
