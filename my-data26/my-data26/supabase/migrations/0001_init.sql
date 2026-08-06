-- =====================================================================
-- DẠY LÁI XE GẦN BẠN — SCHEMA KHỞI TẠO (Postgres / Supabase)
-- =====================================================================
-- Ghi chú thiết kế quan trọng:
-- 1) Bảo mật: các cột nhạy cảm của giáo viên (chứng chỉ, số học viên thật,
--    ảnh xác thực) nằm ở bảng riêng `teacher_private_profiles` và CHỈ
--    admin (role = 'admin') được SELECT nhờ Row Level Security (RLS).
--    Bảng public `teachers` chỉ chứa thông tin học viên được phép thấy.
-- 2) Toàn bộ tiền dùng đơn vị VNĐ, kiểu BIGINT (không dùng float).
-- 3) Mọi biến động ví đều đi qua bảng `wallet_transactions` (ledger),
--    KHÔNG update trực tiếp số dư trong ứng dụng — dùng trigger để cộng
--    dồn vào `wallets.balance`, tránh sai lệch / gian lận.
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists postgis; -- tính khoảng cách theo toạ độ

-- ---------------------------------------------------------------------
-- 1. NGƯỜI DÙNG & VAI TRÒ
-- ---------------------------------------------------------------------
create type user_role as enum ('student', 'teacher', 'admin');
create type license_class as enum ('A1','A2','A','B1','B2','C','D','E','F');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'student',
  full_name text not null,
  phone text,
  avatar_url text,
  is_vip_student boolean not null default false, -- lên hạng sau khi đánh giá GV
  referred_by uuid references profiles(id), -- ai đã giới thiệu người này
  referral_code text unique not null default substr(md5(random()::text), 1, 8),
  created_at timestamptz not null default now()
);

-- Vị trí học viên (dùng để đề xuất giáo viên gần nhất)
create table student_locations (
  student_id uuid primary key references profiles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  address_text text,
  updated_at timestamptz not null default now()
);

-- Nhu cầu học của học viên (hạng xe muốn học)
create table student_learning_requests (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references profiles(id) on delete cascade,
  desired_class license_class not null,
  note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. HỒ SƠ GIÁO VIÊN — TÁCH CÔNG KHAI / RIÊNG TƯ
-- ---------------------------------------------------------------------
create type teacher_status as enum ('pending_review', 'approved', 'rejected', 'suspended');
create type vip_tier as enum ('none', 'vip3', 'vip2', 'vip1');

-- Thông tin CÔNG KHAI — hiển thị cho học viên
create table teachers (
  id uuid primary key references profiles(id) on delete cascade,
  headline text, -- mô tả ngắn tự khai
  years_experience int not null default 0, -- tự động tính từ năm cấp chứng chỉ
  students_trained_public int not null default 0, -- số hiển thị công khai (làm tròn/ẩn bớt nếu muốn)
  status teacher_status not null default 'pending_review',
  vip_tier vip_tier not null default 'none',
  vip_paid_until date, -- nếu trả phí mua vip trực tiếp
  avg_rating numeric(2,1) not null default 0,
  rating_count int not null default 0,
  five_star_success_count int not null default 0, -- số giao dịch 5 sao đã thanh toán hoa hồng
  lat double precision,
  lng double precision,
  service_radius_km int not null default 15,
  created_at timestamptz not null default now()
);

-- Các hạng xe giáo viên dạy + học phí trọn khoá cho mỗi hạng
create table teacher_offerings (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  license_class license_class not null,
  full_course_price bigint not null check (full_course_price > 0),
  promo_note text, -- ưu đãi học viên cũ/mới, tuỳ giáo viên tự khai
  unique (teacher_id, license_class)
);

-- Thông tin LIÊN HỆ — chỉ mở khi học viên đã thanh toán 10.000đ/thông tin
create table teacher_contact_info (
  teacher_id uuid primary key references teachers(id) on delete cascade,
  phone text not null,
  address_text text not null
);

-- Thông tin RIÊNG TƯ — CHỈ admin xem được (RLS chặn học viên/giáo viên khác)
create table teacher_private_profiles (
  teacher_id uuid primary key references teachers(id) on delete cascade,
  certificate_image_url text not null,
  certificate_license_class license_class not null,
  certificate_issue_year int not null, -- dùng để admin/hệ thống tính years_experience
  training_center_name text,
  students_trained_history jsonb not null default '[]', -- [{year, count}]
  admin_note text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz
);

-- ---------------------------------------------------------------------
-- 3. VÍ ĐIỆN TỬ (WALLET) — LEDGER-BASED, KHÔNG SỬA TRỰC TIẾP SỐ DƯ
-- ---------------------------------------------------------------------
create table wallets (
  owner_id uuid primary key references profiles(id) on delete cascade,
  balance bigint not null default 0, -- tiền mặt có thể rút (chỉ học viên)
  credit_minutes_balance bigint not null default 0, -- phút gia hạn (chỉ giáo viên, KHÔNG quy đổi ra tiền)
  updated_at timestamptz not null default now()
);

create type wallet_tx_type as enum (
  'referral_student_commission',      -- học viên giới thiệu học viên mới: +10% phí hoa hồng
  'referral_enrollment_bonus',        -- giới thiệu thêm 1 người đăng ký học thành công: +100.000đ
  'teacher_referral_credit',          -- giáo viên giới thiệu GV khác: +5% phí tháng đầu, quy đổi thời gian
  'contact_unlock_payment',           -- học viên trả 10.000đ để xem thông tin liên hệ GV
  'withdrawal'
);

create table wallet_transactions (
  id uuid primary key default uuid_generate_v4(),
  wallet_owner_id uuid not null references profiles(id),
  type wallet_tx_type not null,
  amount bigint not null,           -- (+) cộng ví, (-) trừ ví, đơn vị VNĐ
  credit_minutes bigint not null default 0, -- dùng riêng cho teacher_referral_credit
  related_user_id uuid references profiles(id), -- người liên quan (được giới thiệu, GV được unlock...)
  related_transaction_id uuid,      -- tham chiếu tới enrollment/subscription liên quan
  description text,
  created_at timestamptz not null default now()
);

-- Trigger: mỗi dòng ledger tự cộng/trừ vào wallets.balance hoặc credit_minutes_balance
create or replace function fn_apply_wallet_tx() returns trigger as $$
begin
  insert into wallets(owner_id, balance, credit_minutes_balance)
  values (new.wallet_owner_id, 0, 0)
  on conflict (owner_id) do nothing;

  update wallets
  set balance = balance + new.amount,
      credit_minutes_balance = credit_minutes_balance + new.credit_minutes,
      updated_at = now()
  where owner_id = new.wallet_owner_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_wallet_tx after insert on wallet_transactions
for each row execute function fn_apply_wallet_tx();

-- ---------------------------------------------------------------------
-- 4. MỞ KHOÁ THÔNG TIN LIÊN HỆ (10.000đ / lượt / giáo viên)
-- ---------------------------------------------------------------------
create table contact_unlocks (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references profiles(id),
  teacher_id uuid not null references teachers(id),
  amount_paid bigint not null default 10000,
  paid_at timestamptz not null default now(),
  unique (student_id, teacher_id) -- trả 1 lần, xem vĩnh viễn
);

-- ---------------------------------------------------------------------
-- 5. ĐĂNG KÝ HỌC (ENROLLMENT) & XÁC NHẬN HỌC PHÍ
-- ---------------------------------------------------------------------
create type enrollment_status as enum ('requested', 'confirmed_paid', 'completed', 'cancelled');

create table enrollments (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references profiles(id),
  teacher_id uuid not null references teachers(id),
  license_class license_class not null,
  course_price bigint not null, -- chốt giá tại thời điểm đăng ký
  referred_by_student_id uuid references profiles(id), -- học viên cũ đã giới thiệu (nếu có)
  status enrollment_status not null default 'requested',
  teacher_confirmed_at timestamptz, -- GV xác nhận đã thu học phí -> trigger thưởng người giới thiệu
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Đánh giá sau khi học xong
create table reviews (
  id uuid primary key default uuid_generate_v4(),
  enrollment_id uuid not null references enrollments(id) unique,
  student_id uuid not null references profiles(id),
  teacher_id uuid not null references teachers(id),
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. LOGIC THƯỞNG KHI GIÁO VIÊN XÁC NHẬN ĐÃ THU HỌC PHÍ
--    - Người giới thiệu (nếu có) nhận 100.000đ cố định vào ví
--    - Nếu người giới thiệu là "học viên cũ" review 5 sao trước đó thì
--      thêm 10% hoa hồng phí khoá học vào ví (referral_student_commission)
--    - Giáo viên bị trừ 3% hoa hồng học phí VÀO CÔNG NỢ VIP (không phải
--      trừ ví, xem bảng teacher_commission_dues) mỗi khi có 1 giao dịch
--      5 sao thành công -> dùng để xét lên hạng VIP theo review
-- ---------------------------------------------------------------------
create table teacher_commission_dues (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null references teachers(id),
  enrollment_id uuid not null references enrollments(id),
  due_amount bigint not null, -- 3% giá trị học phí, phải thanh toán cho sàn
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function fn_on_teacher_confirm_payment() returns trigger as $$
declare
  v_referrer uuid;
begin
  if new.status = 'confirmed_paid' and old.status is distinct from 'confirmed_paid' then
    new.teacher_confirmed_at := now();
    v_referrer := new.referred_by_student_id;

    if v_referrer is not null then
      -- Thưởng cố định 100.000đ cho người giới thiệu thêm 1 học viên đăng ký
      insert into wallet_transactions(wallet_owner_id, type, amount, related_user_id, related_transaction_id, description)
      values (v_referrer, 'referral_enrollment_bonus', 100000, new.student_id, new.id,
              'Thưởng giới thiệu học viên đăng ký học thành công');

      -- Nếu người giới thiệu là "referred_by" gốc của học viên này (giới thiệu tài khoản mới)
      -- thì cộng thêm 10% hoa hồng học phí
      if exists (select 1 from profiles p where p.id = new.student_id and p.referred_by = v_referrer) then
        insert into wallet_transactions(wallet_owner_id, type, amount, related_user_id, related_transaction_id, description)
        values (v_referrer, 'referral_student_commission', round(new.course_price * 0.10), new.student_id, new.id,
                '10% hoa hồng vì giới thiệu học viên mới đăng ký app');
      end if;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_enrollment_confirm before update on enrollments
for each row execute function fn_on_teacher_confirm_payment();

-- Khi có review 5 sao -> tạo công nợ hoa hồng 3% cho giáo viên + tăng đếm 5-star
create or replace function fn_on_five_star_review() returns trigger as $$
declare
  v_price bigint;
begin
  if new.rating = 5 then
    select course_price into v_price from enrollments where id = new.enrollment_id;

    insert into teacher_commission_dues(teacher_id, enrollment_id, due_amount)
    values (new.teacher_id, new.enrollment_id, round(v_price * 0.03));

    update teachers
    set five_star_success_count = five_star_success_count + 1
    where id = new.teacher_id;

    -- Học viên đánh giá xong -> nâng hạng VIP thành viên
    update profiles set is_vip_student = true where id = new.student_id;
  end if;

  update teachers t
  set rating_count = rating_count + 1,
      avg_rating = (
        select round(avg(r.rating)::numeric, 1) from reviews r where r.teacher_id = new.teacher_id
      )
  where t.id = new.teacher_id;

  -- Xét tự động nâng VIP theo số giao dịch 5 sao (không cần trả phí)
  update teachers
  set vip_tier = case
        when five_star_success_count >= 30 then 'vip1'::vip_tier
        when five_star_success_count >= 15 then 'vip2'::vip_tier
        when five_star_success_count >= 5  then 'vip3'::vip_tier
        else vip_tier
      end
  where id = new.teacher_id;

  return new;
end;
$$ language plpgsql security definer;

create trigger trg_review_insert after insert on reviews
for each row execute function fn_on_five_star_review();

-- ---------------------------------------------------------------------
-- 7. PHÍ THƯỜNG NIÊN GIÁO VIÊN (THÁNG / QUÝ / NĂM) + GIỚI THIỆU GV MỚI
-- ---------------------------------------------------------------------
create type subscription_period as enum ('month', 'quarter', 'half_year', 'year');
create type subscription_status as enum ('pending', 'paid', 'expired', 'cancelled');

create table teacher_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null references teachers(id),
  period subscription_period not null,
  base_amount bigint not null,     -- tổng tiền trước giảm giá
  discount_percent numeric(4,2) not null default 0,
  final_amount bigint not null,    -- số tiền thực trả
  referred_by_teacher_id uuid references teachers(id), -- GV nào giới thiệu (nếu có)
  status subscription_status not null default 'pending',
  period_start date,
  period_end date,
  created_at timestamptz not null default now()
);

-- Bảng giá chuẩn — 200k tháng đầu, 150k các tháng sau, giảm theo kỳ hạn
-- (áp dụng trong application layer khi tạo bản ghi, dùng hàm dưới để tham chiếu)
create or replace function fn_calc_subscription_amount(
  p_is_first_month boolean, p_period subscription_period
) returns table(base_amount bigint, discount_percent numeric, final_amount bigint) as $$
declare
  v_month_price bigint;
  v_months int;
  v_base bigint;
  v_discount numeric;
begin
  v_month_price := case when p_is_first_month then 200000 else 150000 end;
  v_months := case p_period
    when 'month' then 1
    when 'quarter' then 3
    when 'half_year' then 6
    when 'year' then 12
  end;
  -- tháng đầu tính giá 200k, các tháng còn lại trong kỳ tính 150k
  v_base := case
    when p_is_first_month then v_month_price + (v_months - 1) * 150000
    else v_months * 150000
  end;
  v_discount := case p_period
    when 'quarter' then 5
    when 'half_year' then 8
    when 'year' then 12
    else 0
  end;
  return query select v_base, v_discount, round(v_base * (1 - v_discount/100.0))::bigint;
end;
$$ language plpgsql immutable;

-- Khi subscription của giáo viên được thanh toán -> nếu có người giới thiệu,
-- người giới thiệu nhận 5% phí THÁNG ĐẦU quy đổi thành PHÚT GIA HẠN (không phải tiền mặt)
create or replace function fn_on_teacher_subscription_paid() returns trigger as $$
declare
  v_first_month_fee bigint := 200000;
  v_credit bigint;
begin
  if new.status = 'paid' and old.status is distinct from 'paid' and new.referred_by_teacher_id is not null then
    v_credit := round(v_first_month_fee * 0.05); -- 5% của 200.000đ = 10.000đ quy đổi
    -- Quy đổi tiền -> phút gia hạn theo đơn giá 150.000đ/30 ngày => 1 ngày ~ 5.000đ
    insert into wallet_transactions(wallet_owner_id, type, amount, credit_minutes, related_user_id, related_transaction_id, description)
    values (
      new.referred_by_teacher_id, 'teacher_referral_credit', 0,
      round(v_credit / 5000.0 * 24 * 60), -- quy đổi ra phút gia hạn hệ thống
      new.teacher_id, new.id,
      '5% hoa hồng giới thiệu giáo viên mới (quy đổi thời gian gia hạn, không rút tiền mặt)'
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_teacher_sub_paid before update on teacher_subscriptions
for each row execute function fn_on_teacher_subscription_paid();

-- ---------------------------------------------------------------------
-- 8. NÂNG CẤP VIP TRẢ PHÍ TRỰC TIẾP (không đủ điều kiện qua đánh giá)
-- ---------------------------------------------------------------------
create table vip_purchases (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null references teachers(id),
  tier vip_tier not null,
  monthly_price bigint not null, -- vip3: 500k, vip2: 700k, vip1: 1.000.000
  paid_until date not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table teachers enable row level security;
alter table teacher_offerings enable row level security;
alter table teacher_contact_info enable row level security;
alter table teacher_private_profiles enable row level security;
alter table wallets enable row level security;
alter table wallet_transactions enable row level security;
alter table contact_unlocks enable row level security;
alter table enrollments enable row level security;
alter table reviews enable row level security;
alter table teacher_subscriptions enable row level security;
alter table teacher_commission_dues enable row level security;
alter table vip_purchases enable row level security;
alter table student_locations enable row level security;
alter table student_learning_requests enable row level security;

create or replace function fn_is_admin() returns boolean as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin');
$$ language sql stable security definer;

-- Hồ sơ công khai: ai cũng xem được GV đã approved
create policy "public_read_approved_teachers" on teachers
  for select using (status = 'approved' or owner_is_self() or fn_is_admin());

create or replace function owner_is_self() returns boolean as $$
  select auth.uid() = id;
$$ language sql stable;

create policy "teacher_offerings_read" on teacher_offerings for select using (true);

-- Thông tin liên hệ: chỉ đọc được nếu đã unlock, hoặc chính GV, hoặc admin
create policy "contact_info_restricted" on teacher_contact_info
  for select using (
    fn_is_admin()
    or auth.uid() = teacher_id
    or exists (
      select 1 from contact_unlocks cu
      where cu.teacher_id = teacher_contact_info.teacher_id and cu.student_id = auth.uid()
    )
  );

-- Hồ sơ riêng tư (chứng chỉ, số liệu thật): CHỈ admin
create policy "private_profile_admin_only" on teacher_private_profiles
  for select using (fn_is_admin());
create policy "private_profile_teacher_insert" on teacher_private_profiles
  for insert with check (auth.uid() = teacher_id);

-- Ví: chỉ chủ ví hoặc admin xem được
create policy "wallet_owner_only" on wallets for select using (auth.uid() = owner_id or fn_is_admin());
create policy "wallet_tx_owner_only" on wallet_transactions for select using (auth.uid() = wallet_owner_id or fn_is_admin());

create policy "profiles_self_or_admin" on profiles for select using (true); -- tên hiển thị công khai (ẩn số ĐT)
create policy "profiles_update_self" on profiles for update using (auth.uid() = id);

create policy "enrollments_participant" on enrollments
  for select using (auth.uid() = student_id or auth.uid() = teacher_id or fn_is_admin());

create policy "reviews_public_read" on reviews for select using (true);
create policy "reviews_insert_by_student" on reviews for insert with check (auth.uid() = student_id);

create policy "contact_unlocks_owner" on contact_unlocks for select using (auth.uid() = student_id or fn_is_admin());

create policy "subs_teacher_or_admin" on teacher_subscriptions for select using (auth.uid() = teacher_id or fn_is_admin());
create policy "dues_teacher_or_admin" on teacher_commission_dues for select using (auth.uid() = teacher_id or fn_is_admin());
create policy "vip_teacher_or_admin" on vip_purchases for select using (auth.uid() = teacher_id or fn_is_admin());

create policy "locations_owner_or_teacher_match" on student_locations for select using (auth.uid() = student_id or fn_is_admin());
create policy "requests_owner_or_admin" on student_learning_requests for select using (auth.uid() = student_id or fn_is_admin());

-- ---------------------------------------------------------------------
-- 10. INDEX PHỤC VỤ TÌM GIÁO VIÊN GẦN NHẤT
-- ---------------------------------------------------------------------
create index idx_teachers_geo on teachers using gist (
  ll_to_earth(lat, lng)
);
create index idx_teachers_status on teachers(status);
create index idx_offerings_class on teacher_offerings(license_class);
