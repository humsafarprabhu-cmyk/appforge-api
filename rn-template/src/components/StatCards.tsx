import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from './GlassCard';
import { theme } from '../theme';

interface StatItem {
  value: string;
  label: string;
  colors: string[];
  icon?: React.ReactNode;
}

interface StatCardsProps {
  items: StatItem[];
}

export function StatCards({ items }: StatCardsProps) {
  return (
    <View style={styles.container}>
      {items.map((item, i) => (
        <GlassCard key={i} variant="sm" style={styles.card}>
          <LinearGradient
            colors={item.colors as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconCircle}
          >
            {item.icon}
          </LinearGradient>
          <Text style={styles.value}>{item.value}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </GlassCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  label: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
