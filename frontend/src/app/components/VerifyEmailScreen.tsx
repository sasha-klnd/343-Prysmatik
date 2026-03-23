import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader, Zap } from 'lucide-react';
import { apiFetch } from '@/api/client';

interface VerifyEmailScreenProps {
  onDone: () => void;
  /** Called immediately after the backend confirms verification — App.tsx uses this to refresh userData */
  onVerified?: () => void;
}

export function VerifyEmailScreen({ onDone, onVerified }: VerifyEmailScreenProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Token is in the hash: /#/verify-email/TOKEN
    const hash = window.location.hash; // e.g. #/verify-email/abc123
    const token = hash.split('/verify-email/')[1]?.split('?')[0]?.trim();

    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the URL.');
      return;
    }

    apiFetch(`/auth/verify-email/${token}`, { method: 'POST' })
      .then(() => {
        onVerified?.(); // Tell App.tsx to re-fetch /auth/me immediately
        setStatus('success');
        setMessage('Your email has been verified! You now have full access to UrbiX.');
      })
      .catch((e: any) => {
        setStatus('error');
        setMessage(e?.message || 'This verification link is invalid or has already been used.');
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0b0d] via-[#0f1012] to-[#141518] flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        {/* Logo */}
        <div className="inline-flex items-center gap-3 mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl blur-lg opacity-50" />
            <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 p-2.5 rounded-xl">
              <Zap className="w-6 h-6 text-white" />
            </div>
          </div>
          <span className="text-2xl font-bold gradient-text">UrbiX</span>
        </div>

        <div className="glass-effect rounded-3xl p-8 border border-white/10 shadow-2xl">
          {status === 'loading' && (
            <>
              <Loader className="w-12 h-12 text-indigo-400 mx-auto mb-4 animate-spin" />
              <h2 className="text-xl font-bold text-white mb-2">Verifying your email…</h2>
              <p className="text-sm text-gray-400">This will only take a moment.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Email verified! ✓</h2>
              <p className="text-sm text-gray-400 mb-6">{message}</p>
              <button
                onClick={onDone}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:opacity-90 transition-all"
              >
                Start planning
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Verification failed</h2>
              <p className="text-sm text-gray-400 mb-6">{message}</p>
              <button
                onClick={onDone}
                className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
              >
                Go to app
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
