# Tài liệu nghiệp vụ — đối chiếu yêu cầu ↔ implementation

## A. Học viên

| Yêu cầu | Đã lập trình ở đâu |
|---|---|
| Đăng ký app, tạo nhu cầu học (hạng bằng) | `student_learning_requests` (schema), form tạo nhu cầu (TODO UI — hiện đã có bảng + logic, cần thêm form) |
| Đề xuất giáo viên gần vị trí | `apps/web/app/search/page.tsx`, `apps/mobile/screens/SearchScreen.tsx` — dùng `expo-location` / `navigator.geolocation` + hàm `haversineDistanceKm` trong `packages/shared` |
| Trả 10.000đ xem SĐT/địa chỉ giáo viên | Bảng `contact_unlocks` + RLS trên `teacher_contact_info` (chỉ đọc được nếu đã unlock) + Edge Function `create-payment` + `payment-webhook` gọi `rpc_unlock_teacher_contact` |
| Giới thiệu học viên mới → 10% hoa hồng | Trigger `fn_on_teacher_confirm_payment` trong `0001_init.sql`: khi GV xác nhận thu học phí, nếu học viên mới có `referred_by`, cộng 10% học phí vào ví người giới thiệu (`wallet_transactions` type `referral_student_commission`) |
| Giới thiệu thêm 1 người đăng ký học → 100.000đ | Cùng trigger trên, cộng cố định 100.000đ (`referral_enrollment_bonus`) khi GV xác nhận đã thu học phí |
| Đánh giá GV sau khi học xong → lên hạng VIP thành viên | Trigger `fn_on_five_star_review`: rating = 5 → `profiles.is_vip_student = true` |
| Ưu đãi bạn bè/người quen mới tham gia, tuỳ chính sách ban quản trị | Bảng `teacher_offerings.promo_note` (GV tự khai ưu đãi theo khoá học); chính sách toàn hệ thống theo thời điểm nên quản lý qua bảng cấu hình admin riêng (roadmap) |

## B. Giáo viên

| Yêu cầu | Đã lập trình ở đâu |
|---|---|
| Đăng ký hồ sơ, trả phí thường niên tháng/quý/năm | `apps/web/app/teacher/onboarding/page.tsx` — chọn kỳ hạn, xem giá tính sẵn qua `calcTeacherSubscription()` |
| 200.000đ tháng đầu, 150.000đ các tháng sau | Hằng số `FEES.TEACHER_SUB_FIRST_MONTH` / `TEACHER_SUB_RENEW_MONTH` trong `packages/shared/src/constants.ts`, hàm SQL `fn_calc_subscription_amount` tính lại y hệt phía server |
| Giảm 5% (quý) / 8% (2 quý = 6 tháng) / 12% (năm) | `FEES.SUBSCRIPTION_DISCOUNT` — áp dụng cả 2 phía client (hiển thị) và server (SQL function, không tin số client) |
| Hồ sơ cần ảnh chứng chỉ + hạng xe tương ứng | Upload vào Supabase Storage bucket **private** `teacher-certificates`, lưu path vào `teacher_private_profiles.certificate_image_url` |
| Kinh nghiệm = năm cấp chứng chỉ → hiện tại | Hàm `calcYearsExperience()` (chung) — admin nhập năm cấp chứng chỉ lúc duyệt, hệ thống tự tính lại mỗi lần hiển thị |
| Số học viên đã dạy theo từng năm + tên trung tâm | `teacher_private_profiles.students_trained_history` (jsonb `[{year, count}]`) + `training_center_name` — **chỉ admin xem được** |
| Hồ sơ phải được admin duyệt mới hiển thị công khai | `teachers.status` enum (`pending_review` → `approved`/`rejected`), RLS chỉ cho `select` khi `status = 'approved'`, trang `apps/web/app/admin/teachers/page.tsx` + RPC `rpc_admin_review_teacher` |
| Chỉ admin xem được số liệu học viên/chứng chỉ | RLS `private_profile_admin_only` trên `teacher_private_profiles` — không policy nào cho học viên/GV khác đọc |
| Công khai: họ tên, số năm KN, số học viên, mô tả ngắn | Bảng `teachers` (cột public) join `profiles.full_name` — không chứa cột nhạy cảm |
| Giới thiệu GV khác → 5% phí tháng đầu, quy đổi thời gian (không rút tiền mặt) | Trigger `fn_on_teacher_subscription_paid`: cộng `credit_minutes` vào ví GV giới thiệu (loại `teacher_referral_credit`, `amount = 0`, chỉ có `credit_minutes`) — tách biệt hoàn toàn khỏi `balance` tiền mặt của học viên |
| Kê khai hạng xe dạy + giá trọn khoá | Bảng `teacher_offerings` (`license_class`, `full_course_price`) — form ở bước 2 onboarding |
| Chính sách khuyến mãi học viên cũ/mới | `teacher_offerings.promo_note` (GV tự khai theo từng hạng xe) |
| Nhiều đánh giá 5 sao → tự động đề xuất VIP3/2/1 | Trigger `fn_on_five_star_review` tự nâng `vip_tier` theo `five_star_success_count` (ngưỡng 5/15/30 — chỉnh trong `FEES.VIP_AUTO_THRESHOLD`) |
| Không đủ đánh giá, muốn mua VIP: 500k/700k/1.000.000đ mỗi tháng | RPC `rpc_purchase_vip` + Edge Function `create-payment` (`kind: vip_purchase`) — giá tính lại ở server, không tin client |
| Mỗi đánh giá 5 sao (giao dịch thành công) → GV trả 3% học phí | Trigger tạo dòng `teacher_commission_dues` (3% `course_price`) mỗi khi có review 5 sao — công nợ này đối soát định kỳ (chuyển khoản/trừ vào lần gia hạn tiếp theo — roadmap tự động hoá) |
| Đẩy hạng VIP theo số lượng giao dịch thành công | Cùng cơ chế `five_star_success_count` ở trên — 1 nguồn dữ liệu duy nhất cho cả "đủ điều kiện VIP" và "công nợ hoa hồng" |

## C. Bảo mật & tính toàn vẹn dữ liệu

1. **Không có "trust the client" cho bất kỳ số tiền nào.** Mọi số tiền (10.000đ mở khoá, phí subscription,
   giá VIP) được tính lại trong SQL function hoặc Edge Function dựa trên ID bản ghi, không nhận số tiền
   client gửi lên.
2. **RLS (Row Level Security) bật trên toàn bộ bảng chứa dữ liệu người dùng.** Xem chi tiết cuối file
   `supabase/migrations/0001_init.sql`.
3. **Ví hoạt động theo mô hình ledger** (`wallet_transactions`) — số dư (`wallets.balance`) chỉ được cập
   nhật qua trigger khi có dòng ghi sổ mới, không bao giờ `UPDATE wallets SET balance = ...` trực tiếp từ
   ứng dụng → dễ audit, khó gian lận.
4. **Thanh toán qua webhook có xác thực chữ ký HMAC** (`payment-webhook/index.ts`) — chặn giả mạo callback
   "đã thanh toán thành công".
5. **Không dùng số điện thoại/email giáo viên làm public column** — tách hẳn bảng `teacher_contact_info`
   với RLS riêng.
