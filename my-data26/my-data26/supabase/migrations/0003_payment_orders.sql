-- Bảng trung gian lưu đơn thanh toán trước khi cổng thanh toán xác nhận.
-- Mọi thay đổi trạng thái 'paid' CHỈ được set bởi payment-webhook (service role),
-- không policy nào cho phép client tự set status = 'paid'.
create table payment_orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id),
  kind text not null, -- contact_unlock | teacher_subscription | vip_purchase
  amount bigint not null,
  metadata jsonb not null default '{}',
  status text not null default 'pending', -- pending | paid | failed
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table payment_orders enable row level security;

create policy "payment_orders_owner_read" on payment_orders
  for select using (auth.uid() = user_id or fn_is_admin());

-- Không có policy INSERT/UPDATE cho client — chỉ Edge Function (service role)
-- được phép tạo/cập nhật đơn hàng, bỏ qua RLS bằng service role key.
