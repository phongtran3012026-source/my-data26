// supabase/functions/create-payment/index.ts
// Deno Edge Function — tạo URL thanh toán qua VNPay cho các loại giao dịch:
// contact_unlock (10.000đ), teacher_subscription, vip_purchase.
//
// AN TOÀN: Số tiền được tính LẠI ở server dựa trên loại giao dịch, KHÔNG
// bao giờ nhận số tiền do client gửi lên trực tiếp — tránh học viên sửa
// request để trả 1đ thay vì 10.000đ.

import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { createHmac } from 'node:crypto';

const VNP_TMN_CODE = Deno.env.get('VNP_TMN_CODE')!;
const VNP_HASH_SECRET = Deno.env.get('VNP_HASH_SECRET')!;
const VNP_URL = Deno.env.get('VNP_URL') ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const RETURN_URL = Deno.env.get('APP_RETURN_URL')!;

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

type PaymentKind = 'contact_unlock' | 'teacher_subscription' | 'vip_purchase';

async function resolveAmount(kind: PaymentKind, payload: Record<string, unknown>): Promise<number> {
  if (kind === 'contact_unlock') return 10000;

  if (kind === 'teacher_subscription') {
    const { data, error } = await supabaseAdmin
      .from('teacher_subscriptions')
      .select('final_amount')
      .eq('id', payload.subscription_id)
      .single();
    if (error || !data) throw new Error('Không tìm thấy gói đăng ký');
    return data.final_amount;
  }

  if (kind === 'vip_purchase') {
    const price: Record<string, number> = { vip3: 500000, vip2: 700000, vip1: 1000000 };
    const tier = String(payload.tier);
    if (!price[tier]) throw new Error('Hạng VIP không hợp lệ');
    return price[tier] * (Number(payload.months) || 1);
  }

  throw new Error('Loại giao dịch không hợp lệ');
}

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Chưa đăng nhập' }), { status: 401 });
    }

    const body = await req.json();
    const kind: PaymentKind = body.kind;
    const amount = await resolveAmount(kind, body);

    // Ghi lại 1 record "pending" để webhook đối chiếu khi VNPay callback
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('payment_orders')
      .insert({
        user_id: userData.user.id,
        kind,
        amount,
        metadata: body,
        status: 'pending',
      })
      .select()
      .single();
    if (orderErr) throw orderErr;

    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: VNP_TMN_CODE,
      vnp_Amount: String(amount * 100), // VNPay yêu cầu nhân 100
      vnp_CurrCode: 'VND',
      vnp_TxnRef: order.id,
      vnp_OrderInfo: `Thanh toan ${kind} - DayLaiXeGanBan`,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: RETURN_URL,
      vnp_IpAddr: req.headers.get('x-forwarded-for') ?? '127.0.0.1',
      vnp_CreateDate: new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14),
    };

    const sorted = Object.keys(params).sort();
    const signData = sorted.map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&');
    const secureHash = createHmac('sha512', VNP_HASH_SECRET).update(signData).digest('hex');

    const payUrl = `${VNP_URL}?${signData}&vnp_SecureHash=${secureHash}`;

    return new Response(JSON.stringify({ payment_url: payUrl, order_id: order.id }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 400 });
  }
});
