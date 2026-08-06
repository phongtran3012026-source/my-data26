import { createClient } from '@supabase/supabase-js';

// Web (Next.js) dùng NEXT_PUBLIC_*, Mobile (Expo) dùng EXPO_PUBLIC_*.
// Hàm này tự nhận biến môi trường phù hợp với môi trường đang chạy.
function readEnv(name: string): string {
  // @ts-ignore - process có thể không tồn tại ở môi trường RN, dùng fallback
  const value = (typeof process !== 'undefined' && process.env && process.env[name]) || '';
  if (!value) {
    console.warn(`[supabaseClient] Thiếu biến môi trường ${name}. Kiểm tra file .env`);
  }
  return value;
}

const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL') || readEnv('EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
