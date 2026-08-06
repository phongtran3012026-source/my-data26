-- =====================================================================
-- RPC FUNCTIONS — mọi thao tác liên quan tới tiền PHẢI đi qua đây,
-- KHÔNG bao giờ để client tự insert thẳng vào contact_unlocks / wallets.
-- Các hàm dùng SECURITY DEFINER + kiểm tra auth.uid() nội bộ.
-- =====================================================================

-- 1) Mở khoá thông tin liên hệ giáo viên sau khi cổng thanh toán xác nhận
--    thành công (gọi từ Edge Function payment-webhook, KHÔNG gọi trực
--    tiếp từ app client để tránh giả mạo "đã thanh toán").
create or replace function rpc_unlock_teacher_contact(
  p_teacher_id uuid,
  p_student_id uuid,
  p_payment_ref text
) returns void as $$
begin
  insert into contact_unlocks(student_id, teacher_id, amount_paid)
  values (p_student_id, p_teacher_id, 10000)
  on conflict (student_id, teacher_id) do nothing;

  insert into wallet_transactions(wallet_owner_id, type, amount, related_user_id, description)
  values (p_student_id, 'contact_unlock_payment', -10000, p_teacher_id,
          'Mở khoá thông tin liên hệ GV — mã GD ' || coalesce(p_payment_ref, 'N/A'));
end;
$$ language plpgsql security definer;

-- 2) Giáo viên xác nhận đã thu học phí trực tiếp (không qua ví app) —
--    CHỈ giáo viên sở hữu enrollment đó mới gọi được.
create or replace function rpc_teacher_confirm_enrollment(p_enrollment_id uuid)
returns void as $$
declare
  v_teacher_id uuid;
begin
  select teacher_id into v_teacher_id from enrollments where id = p_enrollment_id;
  if v_teacher_id is null then
    raise exception 'Không tìm thấy đơn đăng ký học';
  end if;
  if v_teacher_id <> auth.uid() then
    raise exception 'Không có quyền xác nhận đơn đăng ký này';
  end if;

  update enrollments set status = 'confirmed_paid' where id = p_enrollment_id;
end;
$$ language plpgsql security definer;

-- 3) Admin duyệt hồ sơ giáo viên (chuyển pending_review -> approved/rejected)
create or replace function rpc_admin_review_teacher(
  p_teacher_id uuid, p_approve boolean, p_note text default null
) returns void as $$
begin
  if not fn_is_admin() then
    raise exception 'Chỉ ban quản trị mới có quyền duyệt hồ sơ';
  end if;

  update teachers
  set status = case when p_approve then 'approved'::teacher_status else 'rejected'::teacher_status end
  where id = p_teacher_id;

  update teacher_private_profiles
  set admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
  where teacher_id = p_teacher_id;
end;
$$ language plpgsql security definer;

-- 4) Giáo viên mua VIP trực tiếp bằng tiền (không đủ điều kiện qua đánh giá)
create or replace function rpc_purchase_vip(
  p_teacher_id uuid, p_tier vip_tier, p_months int default 1
) returns void as $$
declare
  v_price bigint;
begin
  if p_teacher_id <> auth.uid() then
    raise exception 'Không có quyền thực hiện';
  end if;

  v_price := case p_tier
    when 'vip3' then 500000
    when 'vip2' then 700000
    when 'vip1' then 1000000
    else null
  end;
  if v_price is null then raise exception 'Hạng VIP không hợp lệ'; end if;

  insert into vip_purchases(teacher_id, tier, monthly_price, paid_until)
  values (p_teacher_id, p_tier, v_price, (current_date + (p_months || ' months')::interval)::date);

  update teachers
  set vip_tier = p_tier, vip_paid_until = (current_date + (p_months || ' months')::interval)::date
  where id = p_teacher_id;
end;
$$ language plpgsql security definer;

-- 5) Rút tiền từ ví học viên (yêu cầu rút, admin xử lý thủ công/chuyển khoản)
create table if not exists withdrawal_requests (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references profiles(id),
  amount bigint not null check (amount > 0),
  bank_account_info text not null,
  status text not null default 'pending', -- pending | processed | rejected
  created_at timestamptz not null default now()
);
alter table withdrawal_requests enable row level security;
create policy "withdrawal_owner_or_admin" on withdrawal_requests
  for select using (auth.uid() = student_id or fn_is_admin());
create policy "withdrawal_insert_self" on withdrawal_requests
  for insert with check (auth.uid() = student_id);

create or replace function rpc_request_withdrawal(p_amount bigint, p_bank_info text)
returns void as $$
declare
  v_balance bigint;
begin
  select balance into v_balance from wallets where owner_id = auth.uid();
  if v_balance is null or v_balance < p_amount then
    raise exception 'Số dư ví không đủ để rút';
  end if;

  insert into withdrawal_requests(student_id, amount, bank_account_info)
  values (auth.uid(), p_amount, p_bank_info);

  insert into wallet_transactions(wallet_owner_id, type, amount, description)
  values (auth.uid(), 'withdrawal', -p_amount, 'Yêu cầu rút tiền về ' || p_bank_info);
end;
$$ language plpgsql security definer;
