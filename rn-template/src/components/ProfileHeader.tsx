import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

interface ProfileHeaderProps {
  name: string;
  email: string;
  initials: string;
  stats: { value: string; label: string }[];
}

export function ProfileHeader({ name, email, initials, stats }: ProfileHeaderProps) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[...theme.colors.primary, theme.colors.accent1[0]] as [string, string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.avatarRing}
      >
        <View style={styles.avatarInner}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
      </LinearGradient>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.email}>{email}</Text>

      <View style={styles.statsRow}>
        {stats.map((s, i) => (
          <View key={i} style={styles.statItem}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: 16 },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    padding: 3,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 45,
    backgroundColor: '#050507',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 24, fontWeight: '700', color: '#fff' },
  name: { fontSize: 20, fontWeight: '700', color: '#fff', marginTop: 12 },
  email: { fontSize: 14, color: theme.colors.textMuted },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  statItem: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2 },
});
