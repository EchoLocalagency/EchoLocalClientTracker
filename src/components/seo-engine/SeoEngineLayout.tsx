'use client';

import { ReactNode } from 'react';
import { seo } from '@/lib/seo-theme';

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
      background: seo.bg,
      color: seo.text,
      fontFamily: seo.fontSans,
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
