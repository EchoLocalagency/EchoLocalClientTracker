'use client';

import { supabase } from '@/lib/supabase';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get('error');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoginError(error.message);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0B1120',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      <form onSubmit={handleLogin} style={{
        width: 360,
        padding: '48px 36px',
        background: '#111827',
        border: '1px solid #1E293B',
        borderRadius: 10,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="/echo-local-logo.png"
            alt="Echo Local"
            style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 16, display: 'inline-block' }}
          />
          <div style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9' }}>Echo Local</div>
          <div style={{
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            color: '#94A3B8',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginTop: 4,
          }}>
            Client Tracker
          </div>
        </div>

        {(error === 'unauthorized' || loginError) && (
          <div style={{
            background: 'rgba(255, 61, 87, 0.1)',
            border: '1px solid rgba(255, 61, 87, 0.3)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
            fontSize: 13,
            color: '#FF3D57',
          }}>
            {error === 'unauthorized' ? 'Access restricted to authorized accounts.' : loginError}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block',
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            color: '#94A3B8',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 6,
          }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              background: '#0B1120',
              border: '1px solid #1E293B',
              borderRadius: 6,
              color: '#F1F5F9',
              fontSize: 14,
              fontFamily: "'Space Grotesk', sans-serif",
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: 'block',
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            color: '#94A3B8',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 6,
          }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              background: '#0B1120',
              border: '1px solid #1E293B',
              borderRadius: 6,
              color: '#F1F5F9',
              fontSize: 14,
              fontFamily: "'Space Grotesk', sans-serif",
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            background: loading ? '#64748B' : '#06B6D4',
            color: '#FFF',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "'Space Grotesk', sans-serif",
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0B1120' }} />}>
      <LoginForm />
    </Suspense>
  );
}
