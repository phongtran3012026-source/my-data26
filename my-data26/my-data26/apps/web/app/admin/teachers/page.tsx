'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminTeachersPage() {
  const [pending, setPending] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setIsAdmin(false); return; }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
    if (profile?.role !== 'admin') { setIsAdmin(false); return; }
    setIsAdmin(true);

    const { data } = await supabase
      .from('teachers')
      .select('*, profiles(full_name, phone), teacher_private_profiles(*)')
      .eq('status', 'pending_review');
    setPending(data ?? []);
  }

  useEffect(() => { load(); }, []);

  async function review(teacherId: string, approve: boolean) {
    await supabase.rpc('rpc_admin_review_teacher', { p_teacher_id: teacherId, p_approve: approve });
    load();
  }

  if (isAdmin === false) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-slate-500">Bạn không có quyền truy cập trang này.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Duyệt hồ sơ giáo viên</h1>
      <p className="text-slate-500 mb-6">Kiểm tra chứng chỉ và số liệu thật trước khi cho phép hiển thị công khai.</p>

      <div className="grid gap-4">
        {pending.map((t) => {
          const priv = t.teacher_private_profiles?.[0] ?? t.teacher_private_profiles;
          return (
            <div key={t.id} className="card p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-800">{t.profiles?.full_name}</h3>
                  <p className="text-sm text-slate-500">{t.profiles?.phone}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => review(t.id, false)} className="btn-outline text-sm">Từ chối</button>
                  <button onClick={() => review(t.id, true)} className="btn-primary text-sm">Duyệt</button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm bg-slate-50 rounded-lg p-4">
                <p><span className="text-slate-400">Hạng chứng chỉ:</span> {priv?.certificate_license_class}</p>
                <p><span className="text-slate-400">Năm cấp:</span> {priv?.certificate_issue_year}</p>
                <p><span className="text-slate-400">Trung tâm:</span> {priv?.training_center_name}</p>
                <p><span className="text-slate-400">Mô tả:</span> {t.headline}</p>
              </div>
              {priv?.certificate_image_url && (
                <p className="text-xs text-slate-400 mt-2">📎 Ảnh chứng chỉ: {priv.certificate_image_url} (mở qua Supabase Storage signed URL)</p>
              )}
            </div>
          );
        })}
        {pending.length === 0 && <p className="text-sm text-slate-400">Không có hồ sơ nào chờ duyệt.</p>}
      </div>
    </div>
  );
}
