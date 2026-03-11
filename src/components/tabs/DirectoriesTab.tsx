'use client';

import { SubmissionWithDirectory } from '@/lib/types';

interface DirectoriesTabProps {
  submissions: SubmissionWithDirectory[];
  seoEngineEnabled: boolean;
  isAdmin: boolean;
}

export default function DirectoriesTab({ submissions, seoEngineEnabled, isAdmin }: DirectoriesTabProps) {
  if (!seoEngineEnabled) {
    return (
      <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center' }}>
        Directory submissions are available with SEO Engine.
      </div>
    );
  }

  return (
    <div>
      <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center' }}>
        Directories tab placeholder - {submissions.length} submissions loaded
      </div>
    </div>
  );
}
