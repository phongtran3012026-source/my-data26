// supabase/functions/payment-webhook/index.ts
// Nhận callback (IPN) từ VNPay. BẮT BUỘC xác thực vnp_SecureHash trước khi
// tin bất kỳ dữ liệu nào — đây là bước quan trọng nhất để chống giả mạo
// "đã thanh toán thành công".

import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { createHmac } from 'node:crypto';

const VNP_HASH_SECRET = Deno.env.get('VNP_HASH_SECRET')!;
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function verifySignature(params: URLSearchParams): boolean {
  const received = params.get('vnp_SecureHash') ?? '';
  const entries = Array.from(params.entries()).filter(
    ([k]) => k !== 'vnp_SecureHash' && k !== 'vnp_SecureHashType'
  );
  entries.sort(([a], [b]) => a.localeCompare(b));
  const signData = entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const expected = createHmac('sha512', VNP_HASH_SECRET).update(signData).digest('hex');
  return expected === received;
}

serve(async (req) => {
  const url = new URL(req.url);
  const params = url.searchParams;

  if (!verifySignature(params)) {
    return new Response(JSON.stringify({ RspCode: '97', Message: 'Sai chữ ký' }), { status: 400 });
  }

  const orderId = params.get('vnp_TxnRef')!;
  const responseCode = params.get('vnp_ResponseCode');
  const isSuccess = responseCode === '00';

  const { data: order, error } = await supabaseAdmin
    .from('payment_orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    return new Response(JSON.stringify({ RspCode: '01', Message: 'Không tìm thấy đơn hàng' }), { status: 400 });
  }
  if (order.status !== 'pending') {
    return new Response(JSON.stringify({ RspCode: '02', Message: 'Đơn hàng đã xử lý' }), { status: 200 });
  }

  await supabaseAdmin
    .from('payment_orders')
    .update({ status: isSuccess ? 'paid' : 'failed', paid_at: new Date().toISOString() })
    .eq('id', orderId);

  if (isSuccess) {
    if (order.kind === 'contact_unlock') {
      await supabaseAdmin.rpc('rpc_unlock_teacher_contact', {
        p_teacher_id: order.metadata.teacher_id,
        p_student_id: order.user_id,
        p_payment_ref: orderId,
      });
    }
    if (order.kind === 'teacher_subscription') {
      await supabaseAdmin
        .from('teacher_subscriptions')
        .update({ status: 'paid' })
        .eq('id', order.metadata.subscription_id);
    }
    if (order.kind === 'vip_purchase') {
      await supabaseAdmin.rpc('rpc_purchase_vip', {
        p_teacher_id: order.user_id,
        p_tier: order.metadata.tier,
        p_months: order.metadata.months ?? 1,
      });
    }
  }

  return new Response(JSON.stringify({ RspCode: '00', Message: 'Confirm Success' }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
