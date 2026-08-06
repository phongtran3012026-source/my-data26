import type { LicenseClass, VipTier } from './constants';

export type UserRole = 'student' | 'teacher' | 'admin';
export type TeacherStatus = 'pending_review' | 'approved' | 'rejected' | 'suspended';
export type EnrollmentStatus = 'requested' | 'confirmed_paid' | 'completed' | 'cancelled';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  is_vip_student: boolean;
  referral_code: string;
  referred_by?: string | null;
}

/** Hồ sơ giáo viên — CHỈ chứa dữ liệu công khai được phép hiển thị cho học viên */
export interface TeacherPublic {
  id: string;
  full_name: string; // join từ profiles
  headline?: string | null;
  years_experience: number;
  students_trained_public: number;
  status: TeacherStatus;
  vip_tier: VipTier;
  avg_rating: number;
  rating_count: number;
  lat?: number | null;
  lng?: number | null;
  distance_km?: number; // tính client-side sau khi query
}

export interface TeacherOffering {
  id: string;
  teacher_id: string;
  license_class: LicenseClass;
  full_course_price: number;
  promo_note?: string | null;
}

export interface TeacherContactInfo {
  teacher_id: string;
  phone: string;
  address_text: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  teacher_id: string;
  license_class: LicenseClass;
  course_price: number;
  referred_by_student_id?: string | null;
  status: EnrollmentStatus;
}

export interface Review {
  id: string;
  enrollment_id: string;
  student_id: string;
  teacher_id: string;
  rating: number;
  comment?: string | null;
}

export interface WalletTransaction {
  id: string;
  wallet_owner_id: string;
  type: string;
  amount: number;
  credit_minutes: number;
  description?: string | null;
  created_at: string;
}
