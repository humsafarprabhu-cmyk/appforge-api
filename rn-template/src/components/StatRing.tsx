import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { GlassCard } from './GlassCard';
import { theme } from '../theme';

interface Metric {
  label: string;
  value: string;
  target: string;
  color: 'primary' | 'accent1' | 'accent2' | 'accent3';
}

interface StatRingProps {
  percent: number;
  label: string;
  metrics: Metric[];
}

export function StatRing({ percent, label, metrics }: StatRingProps) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (percent / 100) * circumference;

  const colorMap: Record<string, string> = {
    primary: theme.colors.primary[0],
    accent1: theme.colors.accent1[0],
    accent2: theme.colors.accent2[0],
    accent3: theme.colors.accent3[0],
  };

  return (
    <GlassCard>
      <View style={styles.row}>
        <View style={styles.ringContainer}>
          <Svg width={96} height={96} viewBox="0 0 100 100">
            <Circle cx={50} cy={50} r={42} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
            <Defs>
              <SvgGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={theme.colors.primary[0]} />
                <Stop offset="100%" stopColor={theme.colors.primary[1]} />
              </SvgGradient>
            </Defs>
            <Circle
              cx={50} cy={50} r={42}
              fill="none" stroke="url(#ringGrad)" strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              rotation={-90} origin="50,50"
            />
          </Svg>
          <View style={styles.ringCenter}>
            <Text style={styles.ringPercent}>{percent}%</Text>
            <Text style={styles.ringLabel}>{label}</Text>
          </View>
        </View>
        <View style={styles.metrics}>
          {metrics.map((m, i) => (
            <View key={i} style={styles.metricRow}>
              <View style={styles.metricLeft}>
                <View style={[styles.dot, { backgroundColor: colorMap[m.color] || colorMap.primary }]} />
                <Text style={styles.metricLabel}>{m.label}</Text>
              </View>
              <Text style={styles.metricValue}>
                {m.value} <Text style={styles.metricTarget}>/ {m.target}</Text>
              </Text>
            </View>
          ))}
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ringContainer: { width: 96, height: 96, position: 'relative' },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringPercent: { fontSize: 20, fontWeight: '800', color: '#fff' },
  ringLabel: { fontSize: 10, color: theme.colors.textMuted },
  metrics: { flex: 1, gap: 12 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  metricLabel: { fontSize: 12, color: theme.colors.textMuted },
  metricValue: { fontSize: 13, fontWeight: '700', color: '#fff' },
  metricTarget: { fontWeight: '400', color: theme.colors.textMuted },
});
