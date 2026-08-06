import Link from 'next/link';
import { LICENSE_CLASS_LABELS } from '@daylaixe/shared';

export default function HomePage() {
  return (
    <div>
      <section className="max-w-6xl mx-auto px-4 pt-16 pb-20 text-center">
        <span className="inline-block bg-brand-50 text-brand-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
          🇻🇳 Nền tảng học lái xe #1 kết nối theo vị trí
        </span>
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight max-w-3xl mx-auto">
          Tìm giáo viên dạy lái xe <span className="text-brand-600">gần bạn nhất</span>
        </h1>
        <p className="mt-5 text-lg text-slate-500 max-w-xl mx-auto">
          Chọn hạng bằng cần học, chúng tôi đề xuất giáo viên uy tín gần khu vực của bạn —
          minh bạch học phí, đánh giá thật từ học viên đã học.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/search" className="btn-primary">Tìm giáo viên ngay</Link>
          <Link href="/teacher/onboarding" className="btn-outline">Đăng ký làm giáo viên</Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20">
        <h2 className="text-xl font-bold mb-4 text-slate-800">Bạn muốn học hạng bằng nào?</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(LICENSE_CLASS_LABELS).map(([code, label]) => (
            <Link
              key={code}
              href={`/search?class=${code}`}
              className="card p-4 flex items-center gap-3 hover:border-brand-400"
            >
              <span className="w-10 h-10 rounded-full bg-brand-50 text-brand-700 font-bold grid place-items-center">
                {code}
              </span>
              <span className="text-sm text-slate-600">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-24 grid md:grid-cols-3 gap-6">
        {[
          { icon: '📍', title: 'Đề xuất theo vị trí', desc: 'Hệ thống ưu tiên giáo viên gần bạn nhất để tiết kiệm thời gian di chuyển.' },
          { icon: '✅', title: 'Hồ sơ đã kiểm duyệt', desc: 'Mọi giáo viên đều được ban quản trị xác thực chứng chỉ trước khi hiển thị.' },
          { icon: '💬', title: 'Đánh giá thật', desc: 'Xem đánh giá từ học viên đã học xong để chọn giáo viên phù hợp.' },
        ].map((f) => (
          <div key={f.title} className="card p-6">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-bold text-slate-800">{f.title}</h3>
            <p className="text-sm text-slate-500 mt-1">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
