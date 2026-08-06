import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { haversineDistanceKm } from '@daylaixe/shared';

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Cần quyền truy cập vị trí để đề xuất giáo viên gần bạn.');
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});

      const { data, error } = await supabase
        .from('teachers')
        .select('id, headline, years_experience, students_trained_public, vip_tier, avg_rating, rating_count, lat, lng, profiles(full_name)')
        .eq('status', 'approved');

      if (error) { setErrorMsg('Không tải được danh sách giáo viên.'); setLoading(false); return; }

      const list = (data ?? [])
        .map((t: any) => ({
          ...t,
          full_name: t.profiles?.full_name,
          distance_km: t.lat && t.lng
            ? haversineDistanceKm(loc.coords.latitude, loc.coords.longitude, t.lat, t.lng)
            : 999,
        }))
        .sort((a: any, b: any) => a.distance_km - b.distance_km);

      setTeachers(list);
      setLoading(false);
    })();
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color="#16A34A" /></View>;
  if (errorMsg) return <View style={styles.center}><Text style={styles.error}>{errorMsg}</Text></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={teachers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('TeacherDetail', { teacherId: item.id })}
          >
            <View style={styles.avatar}><Text style={styles.avatarText}>{item.full_name?.charAt(0)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.full_name}</Text>
              <Text style={styles.headline} numberOfLines={2}>{item.headline}</Text>
              <Text style={styles.meta}>
                ⭐ {item.avg_rating?.toFixed(1)} · 🎓 {item.years_experience} năm · 📍 {item.distance_km.toFixed(1)} km
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Chưa có giáo viên phù hợp gần bạn.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: '#EF4444', textAlign: 'center' },
  card: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, elevation: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EEFDF3', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#0F8A3D', fontWeight: '800', fontSize: 18 },
  name: { fontWeight: '700', color: '#0F172A' },
  headline: { color: '#64748B', fontSize: 13, marginTop: 2 },
  meta: { color: '#64748B', fontSize: 12, marginTop: 6 },
  empty: { textAlign: 'center', color: '#94A3B8', marginTop: 40 },
});
