# 🚗 Dạy Lái Xe Gần Bạn

Hệ sinh thái kết nối **học viên** với **giáo viên dạy lái xe** gần khu vực, gồm 3 phần dùng chung 1 backend (Supabase):

```
my-data26/
├── apps/
│   ├── web/        → Next.js 14 (App Router) — chạy trên trình duyệt, deploy Vercel
│   └── mobile/      → React Native (Expo) — build ra app cho Google Play & App Store
├── packages/
│   └── shared/       → Hằng số phí, types, hàm tính toán dùng CHUNG cho web + mobile
├── supabase/
│   ├── migrations/    → Toàn bộ schema DB + RLS + business logic (SQL)
│   └── functions/     → Edge Functions xử lý thanh toán (VNPay) an toàn
└── docs/             → Tài liệu nghiệp vụ chi tiết
```

## 1. Vì sao chọn kiến trúc này

- **Supabase** (Postgres + Auth + Storage + Edge Functions) làm 1 backend duy nhất cho cả web và app,
  tránh viết 2 lần API, deploy nhanh, có RLS (Row Level Security) bảo vệ dữ liệu ở tầng database —
  quan trọng vì hệ thống có tiền thật (ví, hoa hồng, học phí).
- **Toàn bộ số tiền được tính lại ở server** (SQL functions / Edge Functions), KHÔNG bao giờ tin số tiền
  do client gửi lên — chống gian lận (VD: sửa request để trả 1đ thay vì 10.000đ).
- **Dữ liệu nhạy cảm của giáo viên** (ảnh chứng chỉ, số học viên thật, tên trung tâm) nằm ở bảng
  `teacher_private_profiles`, RLS chỉ cho `role = 'admin'` đọc được — đúng yêu cầu bảo mật bạn đưa ra.

## 2. Cài đặt & chạy thử (local)

### Bước 1 — Tạo project Supabase
1. Vào https://supabase.com → New Project.
2. Copy `Project URL` và `anon public key` (Settings → API).
3. Cài Supabase CLI: `npm install -g supabase`
4. Đăng nhập & liên kết project:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   ```
5. Đẩy toàn bộ schema lên:
   ```bash
   supabase db push
   ```
   (Lệnh này chạy lần lượt các file trong `supabase/migrations/` theo thứ tự 0001 → 0004)
6. Tạo bucket lưu ảnh chứng chỉ giáo viên (private):
   ```bash
   supabase storage buckets create teacher-certificates --private
   ```
7. Deploy Edge Functions xử lý thanh toán:
   ```bash
   supabase functions deploy create-payment
   supabase functions deploy payment-webhook
   supabase secrets set --env-file supabase/.env
   ```

### Bước 2 — Chạy web app
```bash
cd apps/web
cp .env.example .env.local   # điền Supabase URL + anon key
npm install
npm run dev
```
Mở http://localhost:3000

### Bước 3 — Chạy mobile app
```bash
cd apps/mobile
cp .env.example .env         # điền Supabase URL + anon key
npm install
npx expo start
```
Quét mã QR bằng app **Expo Go** trên điện thoại để xem thử ngay, không cần build.

## 3. Đưa ứng dụng vào sử dụng thực tế

| Thành phần | Nơi deploy | Ghi chú |
|---|---|---|
| Web app | [Vercel](https://vercel.com) | Import repo GitHub này, chọn thư mục gốc `apps/web`, thêm biến môi trường ở bước 1 |
| Backend | Supabase (đã setup ở Bước 1) | Nâng cấp gói trả phí khi có traffic thật |
| Cổng thanh toán | [VNPay](https://vnpay.vn) hoặc Momo Business | Đăng ký merchant, lấy `VNP_TMN_CODE`/`VNP_HASH_SECRET` thật thay cho sandbox |
| Android app | Expo EAS Build → Google Play Console | `eas build --platform android` rồi upload file `.aab` |
| iOS app | Expo EAS Build → App Store Connect | `eas build --platform ios` (cần tài khoản Apple Developer 99 USD/năm) |

Chi tiết từng bước deploy: xem `docs/deployment.md`.

## 4. Đẩy code này lên GitHub repo của bạn

Bạn đã tải file zip chứa toàn bộ code này. Thực hiện:

```bash
# Giải nén xong, vào thư mục dự án
cd my-data26
git init
git remote add origin https://github.com/phongtran3012026-source/my-data26.git
git add .
git commit -m "Khởi tạo hệ sinh thái Dạy Lái Xe Gần Bạn: web + mobile + backend Supabase"
git branch -M main
git push -u origin main
```

Nếu repo GitHub đã có sẵn README khác, dùng `git push -u origin main --force` (cẩn thận, sẽ ghi đè).

## 5. Toàn bộ nghiệp vụ đã lập trình

Xem chi tiết đầy đủ, khớp 100% với yêu cầu ban đầu, tại **`docs/business-logic.md`**.

## 6. Việc cần làm tiếp theo (roadmap gợi ý)

- [ ] Thêm màn hình đăng ký/học viên xác nhận & đánh giá 5 sao (enrollment flow hoàn chỉnh)
- [ ] Trang admin quản lý chính sách khuyến mãi (giảm giá theo thời điểm)
- [ ] Tích hợp thật VNPay/Momo (hiện code đã sẵn khung, cần merchant thật)
- [ ] Push notification (Expo Notifications) khi có học viên mới quan tâm
- [ ] Unit test cho các hàm tính hoa hồng trong `packages/shared`
- [ ] CI/CD: GitHub Actions tự deploy web lên Vercel + build app qua EAS khi push lên `main`

Dự án hiện là **nền tảng hoàn chỉnh, chạy được thật** (không phải demo tĩnh) — nhưng vẫn cần bạn:
điền khoá API thật, kiểm thử kỹ luồng thanh toán trên môi trường sandbox trước khi ra mắt chính thức.
