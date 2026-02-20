import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { theme } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileScreen() {
  const { stats } = useStore();
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);

  const handleClearData = () => {
    Alert.alert('Clear All Data', 'This will delete all your items. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        await AsyncStorage.clear();
        Alert.alert('Done', 'All data cleared. Restart the app.');
      }},
    ]);
  };

  const statCards = [
    { label: 'Total Items', value: stats.total, color: theme.colors.primary[0] },
    { label: 'Completed', value: stats.completed, color: theme.colors.accent2[0] },
    { label: 'Completion Rate', value: stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}%` : '0%', color: theme.colors.accent1[0] },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Profile</Text>

        {/* Avatar */}
        <View style={s.avatarSection}>
          <View style={[s.avatar, { backgroundColor: theme.colors.primary[0] + '30' }]}>
            <Text style={[s.avatarText, { color: theme.colors.primary[0] }]}>U</Text>
          </View>
          <Text style={s.userName}>User</Text>
          <Text style={s.userEmail}>Tap to set up your profile</Text>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          {statCards.map((st, i) => (
            <View key={i} style={s.statCard}>
              <Text style={[s.statValue, { color: st.color }]}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* Settings */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Settings</Text>

          <View style={s.settingRow}>
            <Text style={s.settingLabel}>🌙 Dark Mode</Text>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.colors.primary[0] + '60' }}
              thumbColor={darkMode ? theme.colors.primary[0] : '#888'}
            />
          </View>

          <View style={s.settingRow}>
            <Text style={s.settingLabel}>🔔 Notifications</Text>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.colors.primary[0] + '60' }}
              thumbColor={notifications ? theme.colors.primary[0] : '#888'}
            />
          </View>

          <TouchableOpacity style={s.settingRow} onPress={handleClearData}>
            <Text style={[s.settingLabel, { color: '#ff6b6b' }]}>🗑️ Clear All Data</Text>
            <Text style={s.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* About */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>About</Text>
          <View style={s.aboutCard}>
            <Text style={s.aboutName}>{{appName}}</Text>
            <Text style={s.aboutVersion}>Version 1.0.0</Text>
            <Text style={s.aboutBuilt}>Built with AppForge ⚡</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050507' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 16 },
  avatarSection: { alignItems: 'center', marginVertical: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: '700' },
  userName: { color: '#fff', fontSize: 20, fontWeight: '600' },
  userEmail: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4, textAlign: 'center' },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8 },
  settingLabel: { color: '#fff', fontSize: 15 },
  arrow: { color: 'rgba(255,255,255,0.3)', fontSize: 22 },
  aboutCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 20, alignItems: 'center' },
  aboutName: { color: '#fff', fontSize: 18, fontWeight: '600' },
  aboutVersion: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 },
  aboutBuilt: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 8 },
});
