'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthPage() {
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref') ?? '';
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSignIn() {
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { full_name: fullName, referral_code: refCode || undefined },
      },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="max-w-sm mx-auto px-4 py-24 text-center">
        <div className="text-4xl mb-3">📩</div>
        <h1 className="font-bold text-slate-800">Kiểm tra email của bạn</h1>
        <p className="text-sm text-slate-500 mt-1">Chúng tôi đã gửi liên kết đăng nhập tới {email}.</p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Đăng nhập / Đăng ký</h1>
      <p className="text-slate-500 mb-6 text-sm">Không cần mật khẩu — chỉ cần email, chúng tôi gửi liên kết an toàn.</p>

      {refCode && (
        <p className="text-xs bg-brand-50 text-brand-700 rounded-lg p-2 mb-4">
          🎉 Bạn được giới thiệu bởi mã <strong>{refCode}</strong>
        </p>
      )}

      <div className="space-y-3">
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Họ và tên" className="w-full border border-slate-200 rounded-lg p-3 text-sm" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="w-full border border-slate-200 rounded-lg p-3 text-sm" />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button onClick={handleSignIn} className="btn-primary w-full">Gửi liên kết đăng nhập</button>
      </div>
    </div>
  );
}
