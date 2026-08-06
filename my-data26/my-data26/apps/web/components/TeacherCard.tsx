'use client';
import Link from 'next/link';
import type { TeacherPublic } from '@daylaixe/shared';

const VIP_LABEL: Record<string, string> = { vip1: 'VIP 1', vip2: 'VIP 2', vip3: 'VIP 3' };

export default function TeacherCard({ teacher }: { teacher: TeacherPublic }) {
  return (
    <Link href={`/teachers/${teacher.id}`} className="card p-5 flex gap-4 items-start">
      <div className="w-14 h-14 rounded-full bg-brand-50 text-brand-700 font-bold grid place-items-center text-lg shrink-0">
        {teacher.full_name?.charAt(0) ?? '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-slate-800">{teacher.full_name}</h3>
          {teacher.vip_tier !== 'none' && (
            <span className="badge-vip">{VIP_LABEL[teacher.vip_tier]}</span>
          )}
        </div>
        <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">{teacher.headline}</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
          <span>⭐ {teacher.avg_rating.toFixed(1)} ({teacher.rating_count} đánh giá)</span>
          <span>🎓 {teacher.years_experience} năm KN</span>
          <span>👥 {teacher.students_trained_public}+ học viên</span>
          {teacher.distance_km !== undefined && (
            <span className="text-brand-600 font-semibold">📍 {teacher.distance_km.toFixed(1)} km</span>
          )}
        </div>
      </div>
    </Link>
  );
}
