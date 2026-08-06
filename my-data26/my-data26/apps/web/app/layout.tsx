import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dạy Lái Xe Gần Bạn',
  description: 'Kết nối học viên với giáo viên dạy lái xe gần khu vực của bạn',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <header className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-slate-100">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-extrabold text-lg text-brand-700">
              <span className="w-9 h-9 rounded-full bg-brand-600 text-white grid place-items-center">🚗</span>
              Dạy Lái Xe Gần Bạn
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <Link href="/search" className="hover:text-brand-600">Tìm giáo viên</Link>
              <Link href="/teacher/onboarding" className="hover:text-brand-600">Trở thành giáo viên</Link>
              <Link href="/wallet" className="hover:text-brand-600">Ví của tôi</Link>
              <Link href="/admin" className="hover:text-brand-600">Quản trị</Link>
            </nav>
            <Link href="/auth" className="btn-primary text-sm">Đăng nhập</Link>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-24 border-t border-slate-100 py-8 text-center text-sm text-slate-400">
          © {new Date().getFullYear()} Dạy Lái Xe Gần Bạn — Kết nối an toàn, học lái dễ dàng.
        </footer>
      </body>
    </html>
  );
}
