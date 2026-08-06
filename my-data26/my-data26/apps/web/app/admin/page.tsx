import Link from 'next/link';

export default function AdminHome() {
  const items = [
    { href: '/admin/teachers', title: 'Duyệt hồ sơ giáo viên', desc: 'Xem chứng chỉ, số liệu thật, phê duyệt hiển thị' },
  ];
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold text-slate-900 mb-6">Trang quản trị</h1>
      <div className="grid gap-3">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="card p-5 block">
            <h3 className="font-bold text-slate-800">{i.title}</h3>
            <p className="text-sm text-slate-500">{i.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
