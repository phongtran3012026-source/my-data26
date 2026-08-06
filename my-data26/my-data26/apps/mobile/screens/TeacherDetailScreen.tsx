import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { formatVnd } from '@daylaixe/shared';

export default function TeacherDetailScreen() {
  const route = useRoute<any>();
  const { teacherId } = route.params;
  const [teacher, setTeacher] = useState<any>(null);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [contact, setContact] = useState<any>(null);
  const [unlocking, setUnlocking] = useState(false);

  async function load() {
    const { data: t } = await supabase.from('teachers').select('*, profiles(full_name)').eq('id', teacherId).single();
    setTeacher(t);
    const { data: offs } = await supabase.from('teacher_offerings').select('*').eq('teacher_id', teacherId);
    setOfferings(offs ?? []);
    const { data: c } = await supabase.from('teacher_contact_info').select('*').eq('teacher_id', teacherId).maybeSingle();
    setContact(c);
  }

  useEffect(() => { load(); }, [teacherId]);

  async function handleUnlock() {
    setUnlocking(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.session.access_token}` },
        body: JSON.stringify({ kind: 'contact_unlock', teacher_id: teacherId }),
      });
      const json = await res.json();
      if (json.payment_url) await Linking.openURL(json.payment_url);
      // Sau khi thanh toán, VNPay webhook mở khoá — load lại khi quay lại app
    } finally {
      setUnlocking(false);
    }
  }

  if (!teacher) return <View style={styles.center}><ActivityIndicator color="#16A34A" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.card}>
        <Text style={styles.name}>{teacher.profiles?.full_name}</Text>
        <Text style={styles.headline}>{teacher.headline}</Text>
        <Text style={styles.meta}>⭐ {teacher.avg_rating?.toFixed(1)} · 🎓 {teacher.years_experience} năm KN · 👥 {teacher.students_trained_public}+ học viên</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Học phí theo hạng bằng</Text>
        {offerings.map((o) => (
          <View key={o.id} style={styles.row}>
            <Text style={styles.rowLabel}>{o.license_class}</Text>
            <Text style={styles.rowValue}>{formatVnd(o.full_course_price)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Thông tin liên hệ</Text>
        {contact ? (
          <View>
            <Text style={styles.rowLabel}>📞 {contact.phone}</Text>
            <Text style={styles.rowLabel}>📍 {contact.address_text}</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.headline}>Trả {formatVnd(10000)} để xem số điện thoại & địa chỉ.</Text>
            <TouchableOpacity style={styles.btn} onPress={handleUnlock} disabled={unlocking}>
              <Text style={styles.btnText}>{unlocking ? 'Đang xử lý...' : `Mở khoá — ${formatVnd(10000)}`}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 1 },
  name: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  headline: { color: '#64748B', marginTop: 4 },
  meta: { color: '#64748B', fontSize: 12, marginTop: 8 },
  sectionTitle: { fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowLabel: { color: '#334155', fontWeight: '600' },
  rowValue: { color: '#0F8A3D', fontWeight: '800' },
  btn: { backgroundColor: '#16A34A', borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
});
