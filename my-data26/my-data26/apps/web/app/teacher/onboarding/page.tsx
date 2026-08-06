'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calcTeacherSubscription, LICENSE_CLASS_LABELS, type LicenseClass, type SubscriptionPeriod, formatVnd } from '@daylaixe/shared';

const PERIOD_LABEL: Record<SubscriptionPeriod, string> = {
  month: 'Theo tháng', quarter: 'Theo quý (giảm 5%)', half_year: '6 tháng (giảm 8%)', year: 'Theo năm (giảm 12%)',
};

export default function TeacherOnboardingPage() {
  const [step, setStep] = useState(1);
  const [headline, setHeadline] = useState('');
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certClass, setCertClass] = useState<LicenseClass>('B2');
  const [certYear, setCertYear] = useState(new Date().getFullYear() - 3);
  const [trainingCenter, setTrainingCenter] = useState('');
  const [offerClasses, setOfferClasses] = useState<{ class: LicenseClass; price: number }[]>([
    { class: 'B2', price: 8000000 },
  ]);
  const [period, setPeriod] = useState<SubscriptionPeriod>('month');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const quote = calcTeacherSubscription(period, true);

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Vui lòng đăng nhập trước.');
      if (!certFile) throw new Error('Vui lòng tải lên ảnh chứng chỉ dạy lái.');

      // 1. Upload ảnh chứng chỉ vào bucket riêng tư (chỉ admin đọc được qua signed URL)
      const path = `${auth.user.id}/${Date.now()}-${certFile.name}`;
      const { error: upErr } = await supabase.storage.from('teacher-certificates').upload(path, certFile);
      if (upErr) throw upErr;

      // 2. Tạo hồ sơ giáo viên (status = pending_review)
      await supabase.from('teachers').insert({
        id: auth.user.id,
        headline,
        status: 'pending_review',
      });

      // 3. Lưu thông tin riêng tư — chỉ admin xem được
      await supabase.from('teacher_private_profiles').insert({
        teacher_id: auth.user.id,
        certificate_image_url: path,
        certificate_license_class: certClass,
        certificate_issue_year: certYear,
        training_center_name: trainingCenter,
      });

      // 4. Lưu các hạng xe dạy + giá
      await supabase.from('teacher_offerings').insert(
        offerClasses.map((o) => ({ teacher_id: auth.user!.id, license_class: o.class, full_course_price: o.price }))
      );

      // 5. Tạo bản ghi phí thường niên (chờ thanh toán qua create-payment)
      await supabase.from('teacher_subscriptions').insert({
        teacher_id: auth.user.id,
        period,
        base_amount: quote.base,
        discount_percent: quote.discountPercent * 100,
        final_amount: quote.finalAmount,
        status: 'pending',
      });

      setDone(true);
    } catch (e: any) {
      setError(e.message ?? 'Có lỗi xảy ra.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-slate-900">Đã gửi hồ sơ thành công!</h1>
        <p className="text-slate-500 mt-2">
          Ban quản trị sẽ xét duyệt chứng chỉ của bạn trong 24-48h. Sau khi thanh toán phí thường niên
          và được duyệt, hồ sơ sẽ hiển thị công khai trên hệ thống.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Đăng ký làm giáo viên</h1>
      <p className="text-slate-500 mb-6">
        Bước {step}/3 — Thông tin chứng chỉ chỉ ban quản trị xem được, đảm bảo bảo mật cho bạn.
      </p>

      {step === 1 && (
        <div className="card p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-600">Mô tả ngắn về bạn (hiển thị công khai)</label>
            <textarea
              value={headline} onChange={(e) => setHeadline(e.target.value)}
              className="w-full mt-1 border border-slate-200 rounded-lg p-3 text-sm" rows={3}
              placeholder="VD: Giáo viên tận tâm, dạy thực hành nhiều, cam kết đậu bằng lần đầu..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-600">Ảnh chứng chỉ dạy lái</label>
              <input type="file" accept="image/*" onChange={(e) => setCertFile(e.target.files?.[0] ?? null)} className="w-full mt-1 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">Hạng chứng chỉ</label>
              <select value={certClass} onChange={(e) => setCertClass(e.target.value as LicenseClass)} className="w-full mt-1 border border-slate-200 rounded-lg p-2 text-sm">
                {Object.keys(LICENSE_CLASS_LABELS).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-600">Năm cấp chứng chỉ</label>
              <input type="number" value={certYear} onChange={(e) => setCertYear(Number(e.target.value))} className="w-full mt-1 border border-slate-200 rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">Trung tâm giảng dạy</label>
              <input value={trainingCenter} onChange={(e) => setTrainingCenter(e.target.value)} className="w-full mt-1 border border-slate-200 rounded-lg p-2 text-sm" />
            </div>
          </div>
          <button onClick={() => setStep(2)} className="btn-primary w-full">Tiếp tục</button>
        </div>
      )}

      {step === 2 && (
        <div className="card p-6 space-y-4">
          <p className="text-sm font-medium text-slate-600">Hạng xe dạy & học phí trọn khoá</p>
          {offerClasses.map((o, i) => (
            <div key={i} className="flex gap-2">
              <select
                value={o.class}
                onChange={(e) => {
                  const next = [...offerClasses]; next[i].class = e.target.value as LicenseClass; setOfferClasses(next);
                }}
                className="border border-slate-200 rounded-lg p-2 text-sm"
              >
                {Object.keys(LICENSE_CLASS_LABELS).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="number" value={o.price}
                onChange={(e) => { const next = [...offerClasses]; next[i].price = Number(e.target.value); setOfferClasses(next); }}
                className="flex-1 border border-slate-200 rounded-lg p-2 text-sm" placeholder="Học phí trọn khoá (VNĐ)"
              />
            </div>
          ))}
          <button onClick={() => setOfferClasses([...offerClasses, { class: 'B2', price: 0 }])} className="text-sm text-brand-600 font-medium">
            + Thêm hạng xe khác
          </button>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep(1)} className="btn-outline flex-1">Quay lại</button>
            <button onClick={() => setStep(3)} className="btn-primary flex-1">Tiếp tục</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card p-6 space-y-4">
          <p className="text-sm font-medium text-slate-600">Chọn kỳ hạn thanh toán phí thường niên</p>
          <div className="grid gap-2">
            {(Object.keys(PERIOD_LABEL) as SubscriptionPeriod[]).map((p) => (
              <button
                key={p} onClick={() => setPeriod(p)}
                className={`text-left border rounded-lg p-3 text-sm ${period === p ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
          <div className="bg-slate-50 rounded-lg p-4 text-sm">
            <div className="flex justify-between"><span>Tạm tính</span><span>{formatVnd(quote.base)}</span></div>
            {quote.discountPercent > 0 && (
              <div className="flex justify-between text-brand-600"><span>Giảm giá</span><span>-{(quote.discountPercent * 100).toFixed(0)}%</span></div>
            )}
            <div className="flex justify-between font-bold text-slate-800 mt-1 border-t border-slate-200 pt-1">
              <span>Thành tiền</span><span>{formatVnd(quote.finalAmount)}</span>
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn-outline flex-1">Quay lại</button>
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1">
              {submitting ? 'Đang gửi...' : 'Gửi hồ sơ & thanh toán'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
