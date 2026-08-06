'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatVnd } from '@daylaixe/shared';

const TX_LABEL: Record<string, string> = {
  referral_student_commission: '🎁 Hoa hồng giới thiệu học viên mới (10%)',
  referral_enrollment_bonus: '🎉 Thưởng giới thiệu học viên đăng ký (100.000đ)',
  teacher_referral_credit: '⏱️ Giới thiệu giáo viên mới (quy đổi thời gian gia hạn)',
  contact_unlock_payment: '🔓 Mở khoá thông tin liên hệ giáo viên',
  withdrawal: '💸 Yêu cầu rút tiền',
};

export default function WalletPage() {
  const [profile, setProfile] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const { data: p } = await supabase.from('profiles').select('*').eq('id', auth.user.id).single();
      setProfile(p);

      const { data: w } = await supabase.from('wallets').select('*').eq('owner_id', auth.user.id).maybeSingle();
      setWallet(w ?? { balance: 0, credit_minutes_balance: 0 });

      const { data: t } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_owner_id', auth.user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      setTxs(t ?? []);
    })();
  }, []);

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-slate-500">
        Vui lòng đăng nhập để xem ví của bạn.
      </div>
    );
  }

  const referralLink = `https://daylaixegannban.vn/r/${profile.referral_code}`;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold text-slate-900 mb-6">Ví của tôi</h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card p-5">
          <p className="text-xs text-slate-400 mb-1">Số dư khả dụng</p>
          <p className="text-2xl font-extrabold text-brand-700">{formatVnd(wallet?.balance ?? 0)}</p>
        </div>
        {profile.role === 'teacher' && (
          <div className="card p-5">
            <p className="text-xs text-slate-400 mb-1">Thời gian gia hạn (giới thiệu GV)</p>
            <p className="text-2xl font-extrabold text-accent-600">
              {Math.floor((wallet?.credit_minutes_balance ?? 0) / (60 * 24))} ngày
            </p>
          </div>
        )}
      </div>

      <div className="card p-5 mb-6">
        <p className="text-sm font-semibold text-slate-700 mb-2">Mã giới thiệu của bạn</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-slate-50 px-3 py-2 rounded-lg text-sm text-slate-600 truncate">
            {referralLink}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(referralLink)}
            className="btn-outline text-sm"
          >
            Sao chép
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Giới thiệu bạn bè đăng ký app: nhận 10% hoa hồng khi họ đăng ký học + 100.000đ khi giáo viên
          xác nhận đã thu học phí.
        </p>
      </div>

      <h2 className="font-bold text-slate-800 mb-3">Lịch sử giao dịch</h2>
      <div className="grid gap-2">
        {txs.map((tx) => (
          <div key={tx.id} className="card p-4 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-slate-700">{TX_LABEL[tx.type] ?? tx.type}</p>
              <p className="text-xs text-slate-400">{new Date(tx.created_at).toLocaleString('vi-VN')}</p>
            </div>
            <span className={`font-bold ${tx.amount >= 0 ? 'text-brand-600' : 'text-red-500'}`}>
              {tx.amount >= 0 ? '+' : ''}{formatVnd(tx.amount)}
            </span>
          </div>
        ))}
        {txs.length === 0 && <p className="text-sm text-slate-400">Chưa có giao dịch nào.</p>}
      </div>
    </div>
  );
}
