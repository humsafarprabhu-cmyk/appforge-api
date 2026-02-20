import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store';
import { theme } from '../theme';

const FILTERS = ['All', 'Active', 'Done'];

export default function ListScreen() {
  const { items, toggle } = useStore();
  const nav = useNavigation<any>();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const filtered = items.filter(item => {
    if (filter === 'Active' && item.completed) return false;
    if (filter === 'Done' && !item.completed) return false;
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>{{pageTitle}}</Text>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: theme.colors.primary[0] }]} onPress={() => nav.navigate('{{formScreenName}}')}>
          <Text style={s.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          placeholder="Search..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filters */}
      <View style={s.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterChip, filter === f && { backgroundColor: theme.colors.primary[0] + '20', borderColor: theme.colors.primary[0] }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterText, filter === f && { color: theme.colors.primary[0] }]}>{f}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        <Text style={s.countText}>{filtered.length} items</Text>
      </View>

      {/* List */}
      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>{search ? '🔍' : '📝'}</Text>
            <Text style={s.emptyText}>{search ? 'No results found' : 'Nothing here yet'}</Text>
            {!search && (
              <TouchableOpacity style={[s.emptyBtn, { backgroundColor: theme.colors.primary[0] }]} onPress={() => nav.navigate('{{formScreenName}}')}>
                <Text style={s.emptyBtnText}>Create First Item</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filtered.map(item => (
            <TouchableOpacity key={item.id} style={s.itemCard} onPress={() => nav.navigate('{{detailScreenName}}', { id: item.id })} activeOpacity={0.7}>
              <TouchableOpacity style={[s.checkbox, item.completed && { backgroundColor: theme.colors.accent2[0], borderColor: theme.colors.accent2[0] }]} onPress={() => toggle(item.id)}>
                {item.completed && <Text style={s.checkmark}>✓</Text>}
              </TouchableOpacity>
              <View style={s.itemContent}>
                <Text style={[s.itemTitle, item.completed && s.itemDone]}>{item.title}</Text>
                {item.subtitle ? <Text style={s.itemSub}>{item.subtitle}</Text> : null}
              </View>
              {item.badge ? (
                <View style={[s.badge, { backgroundColor: theme.colors.primary[0] + '20' }]}>
                  <Text style={[s.badgeText, { color: theme.colors.primary[0] }]}>{item.badge}</Text>
                </View>
              ) : null}
              <Text style={s.arrow}>›</Text>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050507' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 16 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700' },
  addBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 24, fontWeight: '300', marginTop: -2 },
  searchWrap: { paddingHorizontal: 20, marginTop: 16 },
  searchInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 15 },
  filterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 14, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filterText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '500' },
  countText: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
  list: { flex: 1, paddingHorizontal: 20, marginTop: 14 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 16, marginBottom: 20 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, marginBottom: 8 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  itemContent: { flex: 1 },
  itemTitle: { color: '#fff', fontSize: 15, fontWeight: '500' },
  itemDone: { textDecorationLine: 'line-through', opacity: 0.5 },
  itemSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 8 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  arrow: { color: 'rgba(255,255,255,0.3)', fontSize: 22 },
});
