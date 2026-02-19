import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard, GradientButton, ListItem } from '../components';
import { theme } from '../theme';

const SAMPLE_DATA = {
  badge: '{{detailBadge}}',
  title: '{{detailTitle}}',
  subtitle: '{{detailSubtitle}}',
  stats: [
    { value: '{{detailStat1Value}}', label: '{{detailStat1Label}}' },
    { value: '{{detailStat2Value}}', label: '{{detailStat2Label}}' },
    { value: '{{detailStat3Value}}', label: '{{detailStat3Label}}' },
  ],
  descTitle: '{{detailDescTitle}}',
  description: '{{detailDescription}}',
  cta: '{{detailCTA}}',
  relatedItems: [
    { title: '{{item1Title}}', subtitle: '{{item1Subtitle}}', badge: '{{item1Badge}}', colors: theme.colors.primary },
    { title: '{{item2Title}}', subtitle: '{{item2Subtitle}}', badge: '{{item2Badge}}', colors: theme.colors.accent1 },
  ],
};

export default function DetailScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Header */}
        <LinearGradient
          colors={theme.colors.primary as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{SAMPLE_DATA.badge}</Text>
          </View>
          <Text style={styles.heroTitle}>{SAMPLE_DATA.title}</Text>
          <Text style={styles.heroSubtitle}>{SAMPLE_DATA.subtitle}</Text>
        </LinearGradient>

        <View style={styles.content}>
          {/* Stats */}
          <View style={styles.statsRow}>
            {SAMPLE_DATA.stats.map((s, i) => (
              <GlassCard key={i} variant="sm" style={styles.statCard}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </GlassCard>
            ))}
          </View>

          {/* Description */}
          <GlassCard style={styles.descCard}>
            <Text style={styles.descTitle}>{SAMPLE_DATA.descTitle}</Text>
            <Text style={styles.descText}>{SAMPLE_DATA.description}</Text>
          </GlassCard>

          {/* CTA */}
          <GradientButton label={SAMPLE_DATA.cta} style={styles.cta} />

          {/* Related Items */}
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>Related</Text>
            <View style={styles.relatedList}>
              {SAMPLE_DATA.relatedItems.map((item, i) => (
                <ListItem key={i} {...item} />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050507' },
  hero: { height: 220, justifyContent: 'flex-end', padding: 20, paddingBottom: 24 },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 8 },
  heroBadgeText: { fontSize: 10, fontWeight: '600', color: '#fff' },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  content: { padding: 20, paddingBottom: 100 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, alignItems: 'center', padding: 12 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2 },
  descCard: { marginTop: 16 },
  descTitle: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 8 },
  descText: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18 },
  cta: { marginTop: 16 },
  relatedSection: { marginTop: 24 },
  relatedTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 12 },
  relatedList: { gap: 12 },
});
