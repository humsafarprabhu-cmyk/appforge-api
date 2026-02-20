import React from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store';
import { theme } from '../theme';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const { items, stats } = useStore();
  const nav = useNavigation<any>();
  const recent = items.slice(0, 5);

  const greeting = new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{greeting} 👋</Text>
            <Text style={s.title}>{{pageTitle}}</Text>
          </View>
          <TouchableOpacity style={s.avatar} onPress={() => nav.navigate('Main', { screen: '{{profileTab}}' })}>
            <Text style={s.avatarText}>U</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={s.statsRow}>
          {[
            { label: 'Total', value: stats.total, color: theme.colors.primary[0] },
            { label: 'Active', value: stats.active, color: theme.colors.accent1[0] },
            { label: 'Done', value: stats.completed, color: theme.colors.accent2[0] },
            { label: 'Today', value: stats.today, color: theme.colors.accent3[0] },
          ].map((st, i) => (
            <View key={i} style={[s.statCard, { borderColor: st.color + '30' }]}>
              <Text style={[s.statValue, { color: st.color }]}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* Progress */}
        <View style={s.progressCard}>
          <View style={s.progressHeader}>
            <Text style={s.sectionTitle}>Progress</Text>
            <Text style={s.pctText}>{pct}%</Text>
          </View>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: theme.colors.primary[0] }]} />
          </View>
        </View>

        {/* Recent Items */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Recent</Text>
            <TouchableOpacity onPress={() => nav.navigate('Main', { screen: '{{listTab}}' })}>
              <Text style={[s.link, { color: theme.colors.primary[0] }]}>See All</Text>
            </TouchableOpacity>
          </View>
          {recent.length === 0 ? (
            <TouchableOpacity style={s.emptyCard} onPress={() => nav.navigate('{{formScreenName}}')}>
              <Text style={s.emptyEmoji}>✨</Text>
              <Text style={s.emptyText}>No items yet. Tap to create your first!</Text>
            </TouchableOpacity>
          ) : (
            recent.map(item => (
              <TouchableOpacity key={item.id} style={s.itemCard} onPress={() => nav.navigate('{{detailScreenName}}', { id: item.id })}>
                <View style={[s.itemDot, { backgroundColor: item.completed ? theme.colors.accent2[0] : theme.colors.primary[0] }]} />
                <View style={s.itemContent}>
                  <Text style={[s.itemTitle, item.completed && s.itemDone]}>{item.title}</Text>
                  {item.subtitle ? <Text style={s.itemSub}>{item.subtitle}</Text> : null}
                </View>
                {item.badge ? (
                  <View style={[s.badge, { backgroundColor: theme.colors.primary[0] + '20' }]}>
                    <Text style={[s.badgeText, { color: theme.colors.primary[0] }]}>{item.badge}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Quick Add */}
        <TouchableOpacity style={[s.fab, { backgroundColor: theme.colors.primary[0] }]} onPress={() => nav.navigate('{{formScreenName}}')}>
          <Text style={s.fabText}>+ Add New</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050507' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 24 },
  greeting: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, borderWidth: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4 },
  progressCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 20 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  pctText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  progressBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  link: { fontSize: 14, fontWeight: '500' },
  emptyCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'dashed' },
  emptyEmoji: { fontSize: 32, marginBottom: 8 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center' },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, marginBottom: 8 },
  itemDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  itemContent: { flex: 1 },
  itemTitle: { color: '#fff', fontSize: 15, fontWeight: '500' },
  itemDone: { textDecorationLine: 'line-through', opacity: 0.5 },
  itemSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  fab: { borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 8 },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
