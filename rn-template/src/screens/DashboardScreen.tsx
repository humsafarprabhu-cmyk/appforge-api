import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatRing, StatCards, BarChart, ListItem } from '../components';
import { theme } from '../theme';

// Sample data — replaced by GPT-4o during assembly
const SAMPLE_DATA = {
  greeting: '{{greetingSubtext}}',
  userName: '{{userName}}',
  userInitials: '{{userInitials}}',
  ringPercent: {{ringPercent}},
  ringLabel: '{{ringLabel}}',
  metrics: [
    { label: '{{metric1Label}}', value: '{{metric1Value}}', target: '{{metric1Target}}', color: 'accent1' as const },
    { label: '{{metric2Label}}', value: '{{metric2Value}}', target: '{{metric2Target}}', color: 'primary' as const },
    { label: '{{metric3Label}}', value: '{{metric3Value}}', target: '{{metric3Target}}', color: 'accent2' as const },
  ],
  stats: [
    { value: '{{stat1Value}}', label: '{{stat1Label}}', colors: theme.colors.accent3 },
    { value: '{{stat2Value}}', label: '{{stat2Label}}', colors: theme.colors.accent1 },
    { value: '{{stat3Value}}', label: '{{stat3Label}}', colors: theme.colors.accent2 },
  ],
  chartTitle: '{{chartTitle}}',
  chartData: [
    { label: 'Mon', value: {{bar1}} },
    { label: 'Tue', value: {{bar2}} },
    { label: 'Wed', value: {{bar3}} },
    { label: 'Thu', value: {{bar4}} },
    { label: 'Fri', value: {{bar5}}, isActive: true },
    { label: 'Sat', value: {{bar6}} },
    { label: 'Sun', value: {{bar7}} },
  ],
  listTitle: '{{listTitle}}',
  items: [
    { title: '{{item1Title}}', subtitle: '{{item1Subtitle}}', badge: '{{item1Badge}}', meta: '{{item1Meta}}', colors: theme.colors.primary },
    { title: '{{item2Title}}', subtitle: '{{item2Subtitle}}', badge: '{{item2Badge}}', meta: '{{item2Meta}}', colors: theme.colors.accent2 },
    { title: '{{item3Title}}', subtitle: '{{item3Subtitle}}', badge: '{{item3Badge}}', colors: theme.colors.accent1 },
    { title: '{{item4Title}}', subtitle: '{{item4Subtitle}}', badge: '{{item4Badge}}', meta: '{{item4Meta}}', colors: theme.colors.accent3 },
  ],
};

export default function DashboardScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Greeting */}
        <View style={styles.greeting}>
          <View>
            <Text style={styles.greetSub}>{SAMPLE_DATA.greeting}</Text>
            <Text style={styles.greetName}>{SAMPLE_DATA.userName}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{SAMPLE_DATA.userInitials}</Text>
          </View>
        </View>

        {/* Progress Ring */}
        <StatRing
          percent={SAMPLE_DATA.ringPercent}
          label={SAMPLE_DATA.ringLabel}
          metrics={SAMPLE_DATA.metrics}
        />

        {/* Stat Cards */}
        <StatCards items={SAMPLE_DATA.stats} />

        {/* Bar Chart */}
        <BarChart
          title={SAMPLE_DATA.chartTitle}
          data={SAMPLE_DATA.chartData}
        />

        {/* List */}
        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>{SAMPLE_DATA.listTitle}</Text>
            <Text style={styles.seeAll}>See all</Text>
          </View>
          <View style={styles.listItems}>
            {SAMPLE_DATA.items.map((item, i) => (
              <ListItem key={i} {...item} />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050507' },
  scroll: { padding: 20, paddingBottom: 100 },
  greeting: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  greetSub: { fontSize: 13, color: theme.colors.textDimmed },
  greetName: { fontSize: 24, fontWeight: '700', color: '#fff', marginTop: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  listSection: { marginTop: 16 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  listTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  seeAll: { fontSize: 12, fontWeight: '500', color: theme.colors.primary[0] },
  listItems: { gap: 12 },
});
