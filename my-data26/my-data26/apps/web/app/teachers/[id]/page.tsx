'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatVnd } from '@daylaixe/shared';

export default function TeacherDetailPage() {
  const params = useParams<{ id: string }>();
  const [teacher, setTeacher] = useState<any>(null);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [contact, setContact] = useState<{ phone: string; address_text: string } | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase
        .from('teachers')
        .select('*, profiles(full_name)')
        .eq('id', params.id)
        .single();
      setTeacher(t);

      const { data: offs } = await supabase
        .from('teacher_offerings')
        .select('*')
        .eq('teacher_id', params.id);
      setOfferings(offs ?? []);

      const { data: rv } = await supabase
        .from('reviews')
        .select('*, profiles(full_name)')
        .eq('teacher_id', params.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setReviews(rv ?? []);

      // Nếu đã unlock trước đó, RLS sẽ trả về dòng contact — nếu chưa, trả rỗng
      const { data: c } = await supabase
        .from('teacher_contact_info')
        .select('*')
        .eq('teacher_id', params.id)
        .maybeSingle();
      setContact(c);
    })();
  }, [params.id]);

  async function handleUnlockContact() {
    setUnlocking(true);
    setError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        setError('Vui lòng đăng nhập trước khi mở khoá thông tin liên hệ.');
        return;
      }

      // Gọi Edge Function tạo link thanh toán VNPay 10.000đ
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({ kind: 'contact_unlock', teacher_id: params.id }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      // Chuyển hướng sang cổng thanh toán VNPay — sau khi thanh toán xong,
      // VNPay gọi payment-webhook để mở khoá, người dùng quay lại trang này.
      window.location.href = json.payment_url;
    } catch (e: any) {
      setError(e.message ?? 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setUnlocking(false);
    }
  }

  if (!teacher) return <div className="max-w-3xl mx-auto px-4 py-16 text-slate-400">Đang tải...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="card p-6 flex gap-5">
        <div className="w-20 h-20 rounded-full bg-brand-50 text-brand-700 font-bold text-2xl grid place-items-center shrink-0">
          {teacher.profiles?.full_name?.charAt(0)}
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{teacher.profiles?.full_name}</h1>
          <p className="text-slate-500 mt-1">{teacher.headline}</p>
          <div className="flex gap-4 mt-3 text-sm text-slate-500">
            <span>⭐ {teacher.avg_rating?.toFixed(1)} ({teacher.rating_count} đánh giá)</span>
            <span>🎓 {teacher.years_experience} năm kinh nghiệm</span>
            <span>👥 {teacher.students_trained_public}+ học viên</span>
          </div>
        </div>
      </div>

      <section className="mt-6 card p-6">
        <h2 className="font-bold text-slate-800 mb-3">Học phí theo hạng bằng</h2>
        <div className="grid gap-2">
          {offerings.map((o) => (
            <div key={o.id} className="flex justify-between items-center border-b border-slate-50 pb-2">
              <div>
                <span className="font-semibold text-slate-700">{o.license_class}</span>
                {o.promo_note && <p className="text-xs text-accent-600 mt-0.5">{o.promo_note}</p>}
              </div>
              <span className="font-bold text-brand-700">{formatVnd(o.full_course_price)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 card p-6">
        <h2 className="font-bold text-slate-800 mb-3">Thông tin liên hệ</h2>
        {contact ? (
          <div className="text-sm text-slate-700 space-y-1">
            <p>📞 {contact.phone}</p>
            <p>📍 {contact.address_text}</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate-500 mb-3">
              Trả {formatVnd(10000)} để xem số điện thoại và địa chỉ dạy của giáo viên này.
            </p>
            <button onClick={handleUnlockContact} disabled={unlocking} className="btn-primary">
              {unlocking ? 'Đang xử lý...' : `Mở khoá liên hệ — ${formatVnd(10000)}`}
            </button>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-bold text-slate-800 mb-3">Đánh giá từ học viên</h2>
        <div className="grid gap-3">
          {reviews.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex justify-between">
                <span className="font-semibold text-sm text-slate-700">{r.profiles?.full_name}</span>
                <span className="text-accent-600 text-sm">{'⭐'.repeat(r.rating)}</span>
              </div>
              {r.comment && <p className="text-sm text-slate-500 mt-1">{r.comment}</p>}
            </div>
          ))}
          {reviews.length === 0 && <p className="text-sm text-slate-400">Chưa có đánh giá nào.</p>}
        </div>
      </section>
    </div>
  );
}
