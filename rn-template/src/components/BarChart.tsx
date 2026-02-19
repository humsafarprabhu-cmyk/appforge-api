import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from './GlassCard';
import { theme } from '../theme';

interface BarChartProps {
  title: string;
  period?: string;
  data: { label: string; value: number; isActive?: boolean }[];
}

export function BarChart({ title, period = 'This Week', data }: BarChartProps) {
  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <GlassCard style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.periodBadge}>
          <Text style={styles.periodText}>{period}</Text>
        </View>
      </View>
      <View style={styles.chart}>
        {data.map((item, i) => (
          <View key={i} style={styles.barCol}>
            <View style={styles.barTrack}>
              {item.value > 0 ? (
                <LinearGradient
                  colors={theme.colors.primary as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={[
                    styles.barFill,
                    {
                      height: `${(item.value / maxVal) * 100}%`,
                      opacity: 0.4 + (item.value / maxVal) * 0.6,
                    },
                  ]}
                />
              ) : (
                <View style={[styles.barFill, styles.barEmpty, { height: '10%' }]} />
              )}
            </View>
            <Text style={[styles.label, item.isActive && styles.labelActive]}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { ...theme.typography.bodyBold, color: '#fff' },
  periodBadge: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  periodText: { fontSize: 12, color: theme.colors.textMuted },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 112,
    gap: 8,
  },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 6, minHeight: 4 },
  barEmpty: { backgroundColor: 'rgba(255,255,255,0.08)' },
  label: { fontSize: 10, color: theme.colors.textDimmed },
  labelActive: { color: '#fff', fontWeight: '500' },
});
