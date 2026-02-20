import React from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useStore } from '../store';
import { theme } from '../theme';

export default function DetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { items, toggle, remove } = useStore();
  const item = items.find(i => i.id === route.params?.id);

  if (!item) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.emptyEmoji}>🔍</Text>
          <Text style={s.emptyText}>Item not found</Text>
          <TouchableOpacity style={[s.btn, { backgroundColor: theme.colors.primary[0] }]} onPress={() => nav.goBack()}>
            <Text style={s.btnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleDelete = () => {
    Alert.alert('Delete', `Delete "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await remove(item.id); nav.goBack(); } },
    ]);
  };

  const createdDate = new Date(item.createdAt);
  const timeAgo = Math.floor((Date.now() - createdDate.getTime()) / 60000);
  const timeStr = timeAgo < 1 ? 'Just now' : timeAgo < 60 ? `${timeAgo}m ago` : timeAgo < 1440 ? `${Math.floor(timeAgo/60)}h ago` : `${Math.floor(timeAgo/1440)}d ago`;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <TouchableOpacity style={s.backBtn} onPress={() => nav.goBack()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Title area */}
        <View style={s.titleArea}>
          <View style={s.titleRow}>
            <Text style={s.title}>{item.title}</Text>
            {item.badge ? (
              <View style={[s.badge, { backgroundColor: theme.colors.primary[0] + '20' }]}>
                <Text style={[s.badgeText, { color: theme.colors.primary[0] }]}>{item.badge}</Text>
              </View>
            ) : null}
          </View>
          {item.subtitle ? <Text style={s.subtitle}>{item.subtitle}</Text> : null}
          <Text style={s.time}>Created {timeStr}</Text>
        </View>

        {/* Status */}
        <View style={s.statusCard}>
          <Text style={s.statusLabel}>Status</Text>
          <TouchableOpacity
            style={[s.statusBtn, { backgroundColor: item.completed ? theme.colors.accent2[0] + '20' : theme.colors.primary[0] + '20' }]}
            onPress={() => toggle(item.id)}
          >
            <View style={[s.statusDot, { backgroundColor: item.completed ? theme.colors.accent2[0] : theme.colors.primary[0] }]} />
            <Text style={[s.statusText, { color: item.completed ? theme.colors.accent2[0] : theme.colors.primary[0] }]}>
              {item.completed ? 'Completed ✓' : 'Active'}
            </Text>
          </TouchableOpacity>
          <Text style={s.statusHint}>Tap to toggle</Text>
        </View>

        {/* Extra data */}
        {item.data && Object.keys(item.data).length > 0 ? (
          <View style={s.dataCard}>
            <Text style={s.sectionTitle}>Details</Text>
            {Object.entries(item.data).map(([key, val]) => (
              <View key={key} style={s.dataRow}>
                <Text style={s.dataKey}>{key}</Text>
                <Text style={s.dataVal}>{String(val)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.colors.primary[0] }]} onPress={() => toggle(item.id)}>
            <Text style={s.actionText}>{item.completed ? 'Mark Active' : 'Mark Complete'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.deleteBtn]} onPress={handleDelete}>
            <Text style={[s.actionText, { color: '#ff6b6b' }]}>Delete</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050507' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, marginBottom: 20 },
  backBtn: { marginTop: 12, marginBottom: 8, paddingVertical: 8 },
  backText: { color: 'rgba(255,255,255,0.6)', fontSize: 16 },
  titleArea: { marginBottom: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', flex: 1 },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 15, marginTop: 6 },
  time: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  statusCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 16 },
  statusLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 10 },
  statusBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 15, fontWeight: '600' },
  statusHint: { color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 8, textAlign: 'center' },
  dataCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  dataKey: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textTransform: 'capitalize' },
  dataVal: { color: '#fff', fontSize: 14, fontWeight: '500' },
  actions: { gap: 10, marginTop: 8 },
  actionBtn: { borderRadius: 14, padding: 16, alignItems: 'center' },
  actionText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: { backgroundColor: 'rgba(255,107,107,0.1)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.2)' },
  btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
