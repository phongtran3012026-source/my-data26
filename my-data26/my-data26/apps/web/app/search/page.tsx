'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { haversineDistanceKm, LICENSE_CLASS_LABELS, type LicenseClass } from '@daylaixe/shared';
import TeacherCard from '@/components/TeacherCard';

export default function SearchPage() {
  const [selectedClass, setSelectedClass] = useState<LicenseClass | ''>('');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [locError, setLocError] = useState('');

  async function loadTeachers() {
    setLoading(true);
    setLocError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;

        let query = supabase
          .from('teachers')
          .select('id, headline, years_experience, students_trained_public, vip_tier, avg_rating, rating_count, lat, lng, profiles(full_name), teacher_offerings(license_class)')
          .eq('status', 'approved');

        const { data, error } = await query;
        if (error) { console.error(error); setLoading(false); return; }

        let list = (data ?? []).map((t: any) => ({
          ...t,
          full_name: t.profiles?.full_name,
          distance_km: t.lat && t.lng ? haversineDistanceKm(latitude, longitude, t.lat, t.lng) : 999,
        }));

        if (selectedClass) {
          list = list.filter((t: any) =>
            t.teacher_offerings?.some((o: any) => o.license_class === selectedClass)
          );
        }

        list.sort((a: any, b: any) => a.distance_km - b.distance_km);
        setTeachers(list);
        setLoading(false);
      },
      () => {
        setLocError('Không lấy được vị trí của bạn. Hãy cấp quyền định vị để xem giáo viên gần nhất.');
        setLoading(false);
      }
    );
  }

  useEffect(() => { loadTeachers(); /* eslint-disable-next-line */ }, [selectedClass]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Tìm giáo viên gần bạn</h1>
      <p className="text-slate-500 mb-6">Kết quả được sắp xếp theo khoảng cách gần nhất tới vị trí hiện tại của bạn.</p>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedClass('')}
          className={`px-4 py-2 rounded-full text-sm font-medium border ${selectedClass === '' ? 'bg-brand-600 text-white border-brand-600' : 'border-slate-200 text-slate-600'}`}
        >
          Tất cả
        </button>
        {Object.entries(LICENSE_CLASS_LABELS).map(([code]) => (
          <button
            key={code}
            onClick={() => setSelectedClass(code as LicenseClass)}
            className={`px-4 py-2 rounded-full text-sm font-medium border ${selectedClass === code ? 'bg-brand-600 text-white border-brand-600' : 'border-slate-200 text-slate-600'}`}
          >
            {code}
          </button>
        ))}
      </div>

      {locError && <p className="text-accent-600 bg-accent-50 rounded-lg p-3 text-sm mb-4">{locError}</p>}
      {loading && <p className="text-slate-400 text-sm">Đang tìm giáo viên gần bạn...</p>}

      <div className="grid gap-3">
        {teachers.map((t) => <TeacherCard key={t.id} teacher={t} />)}
        {!loading && teachers.length === 0 && !locError && (
          <p className="text-slate-400 text-sm">Chưa có giáo viên phù hợp trong khu vực của bạn.</p>
        )}
      </div>
    </div>
  );
}
