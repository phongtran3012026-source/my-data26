// =====================================================================
// Hằng số nghiệp vụ — DÙNG CHUNG cho Web (Next.js) và Mobile (Expo/RN)
// Đây là "nguồn sự thật" duy nhất cho mọi mức phí, để tránh lệch số
// giữa web và app. Đừng hard-code số tiền ở nơi khác.
// =====================================================================

export const FEES = {
  CONTACT_UNLOCK_PRICE: 10_000, // học viên trả để xem SĐT/địa chỉ 1 GV

  STUDENT_REFERRAL_COMMISSION_PERCENT: 0.10, // giới thiệu học viên mới đăng ký app
  ENROLLMENT_INTRO_BONUS: 100_000, // giới thiệu thêm 1 người đăng ký học (khi GV xác nhận đã thu học phí)

  TEACHER_SUB_FIRST_MONTH: 200_000,
  TEACHER_SUB_RENEW_MONTH: 150_000,
  TEACHER_REFERRAL_PERCENT: 0.05, // GV giới thiệu GV khác: 5% phí tháng đầu, quy đổi thời gian (không rút tiền)

  TEACHER_FIVE_STAR_COMMISSION_PERCENT: 0.03, // mỗi review 5 sao (giao dịch thành công) GV trả 3% học phí

  SUBSCRIPTION_DISCOUNT: {
    month: 0,
    quarter: 0.05,
    half_year: 0.08,
    year: 0.12,
  } as const,

  VIP_MONTHLY_PRICE: {
    vip3: 500_000,
    vip2: 700_000,
    vip1: 1_000_000,
  } as const,

  // Ngưỡng số giao dịch 5-sao thành công để tự động lên VIP (miễn phí, theo chất lượng)
  VIP_AUTO_THRESHOLD: {
    vip3: 5,
    vip2: 15,
    vip1: 30,
  } as const,
};

export type SubscriptionPeriod = keyof typeof FEES.SUBSCRIPTION_DISCOUNT;
export type VipTier = 'none' | 'vip3' | 'vip2' | 'vip1';
export type LicenseClass = 'A1' | 'A2' | 'A' | 'B1' | 'B2' | 'C' | 'D' | 'E' | 'F';

export const LICENSE_CLASS_LABELS: Record<LicenseClass, string> = {
  A1: 'A1 - Xe máy dưới 125cm3',
  A2: 'A2 - Xe máy trên 125cm3',
  A: 'A - Mô tô hạng nặng',
  B1: 'B1 - Ô tô số tự động (không hành nghề)',
  B2: 'B2 - Ô tô số sàn (hành nghề)',
  C: 'C - Xe tải hạng nặng',
  D: 'D - Xe khách 10-30 chỗ',
  E: 'E - Xe khách trên 30 chỗ',
  F: 'F - Xe kéo rơ-moóc / đầu kéo',
};

/** Tính tổng phí thường niên GV theo kỳ hạn (tháng/quý/6 tháng/năm) + giảm giá */
export function calcTeacherSubscription(period: SubscriptionPeriod, isFirstSubscription: boolean) {
  const monthsMap: Record<SubscriptionPeriod, number> = { month: 1, quarter: 3, half_year: 6, year: 12 };
  const months = monthsMap[period];

  const base = isFirstSubscription
    ? FEES.TEACHER_SUB_FIRST_MONTH + (months - 1) * FEES.TEACHER_SUB_RENEW_MONTH
    : months * FEES.TEACHER_SUB_RENEW_MONTH;

  const discountPercent = FEES.SUBSCRIPTION_DISCOUNT[period];
  const finalAmount = Math.round(base * (1 - discountPercent));

  return { months, base, discountPercent, finalAmount };
}

/** Tính hạng VIP tự động dựa trên số giao dịch 5-sao thành công (miễn phí, theo chất lượng dạy) */
export function calcAutoVipTier(fiveStarSuccessCount: number): VipTier {
  if (fiveStarSuccessCount >= FEES.VIP_AUTO_THRESHOLD.vip1) return 'vip1';
  if (fiveStarSuccessCount >= FEES.VIP_AUTO_THRESHOLD.vip2) return 'vip2';
  if (fiveStarSuccessCount >= FEES.VIP_AUTO_THRESHOLD.vip3) return 'vip3';
  return 'none';
}

/** Kinh nghiệm giảng dạy = năm hiện tại - năm cấp chứng chỉ (chỉ admin nhìn thấy năm gốc) */
export function calcYearsExperience(certificateIssueYear: number, now = new Date()): number {
  return Math.max(0, now.getFullYear() - certificateIssueYear);
}

/** Khoảng cách Haversine giữa học viên và giáo viên (km) — dùng để sắp xếp đề xuất */
export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + 'đ';
}
