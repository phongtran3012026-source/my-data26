import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { supabase } from '../lib/supabase';
import { formatVnd } from '@daylaixe/shared';

const TX_LABEL: Record<string, string> = {
  referral_student_commission: '🎁 Hoa hồng giới thiệu học viên mới',
  referral_enrollment_bonus: '🎉 Thưởng giới thiệu học viên đăng ký',
  teacher_referral_credit: '⏱️ Giới thiệu giáo viên (thời gian gia hạn)',
  contact_unlock_payment: '🔓 Mở khoá liên hệ giáo viên',
  withdrawal: '💸 Yêu cầu rút tiền',
};

export default function WalletScreen() {
  const [wallet, setWallet] = useState<any>({ balance: 0 });
  const [txs, setTxs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: w } = await supabase.from('wallets').select('*').eq('owner_id', auth.user.id).maybeSingle();
      setWallet(w ?? { balance: 0 });
      const { data: t } = await supabase.from('wallet_transactions').select('*').eq('wallet_owner_id', auth.user.id).order('created_at', { ascending: false }).limit(30);
      setTxs(t ?? []);
    })();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Số dư khả dụng</Text>
        <Text style={styles.balanceValue}>{formatVnd(wallet.balance)}</Text>
      </View>
      <FlatList
        data={txs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => (
          <View style={styles.txRow}>
            <Text style={styles.txLabel}>{TX_LABEL[item.type] ?? item.type}</Text>
            <Text style={[styles.txAmount, { color: item.amount >= 0 ? '#16A34A' : '#EF4444' }]}>
              {item.amount >= 0 ? '+' : ''}{formatVnd(item.amount)}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Chưa có giao dịch nào.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  balanceCard: { backgroundColor: '#16A34A', margin: 16, borderRadius: 16, padding: 20 },
  balanceLabel: { color: '#D6F9E2', fontSize: 13 },
  balanceValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 },
  txRow: { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between' },
  txLabel: { color: '#334155', fontSize: 13, flex: 1 },
  txAmount: { fontWeight: '700' },
  empty: { textAlign: 'center', color: '#94A3B8', marginTop: 40 },
});
