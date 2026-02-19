import React, { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SearchHeader, ListItem } from '../components';
import { theme } from '../theme';

const SAMPLE_DATA = {
  title: '{{pageTitle}}',
  searchPlaceholder: '{{searchPlaceholder}}',
  filters: ['{{filter1}}', '{{filter2}}', '{{filter3}}', '{{filter4}}'],
  items: [
    { title: '{{item1Title}}', subtitle: '{{item1Subtitle}}', badge: '{{item1Badge}}', meta: '{{item1Meta}}', colors: theme.colors.primary },
    { title: '{{item2Title}}', subtitle: '{{item2Subtitle}}', badge: '{{item2Badge}}', meta: '{{item2Meta}}', colors: theme.colors.accent2 },
    { title: '{{item3Title}}', subtitle: '{{item3Subtitle}}', badge: '{{item3Badge}}', colors: theme.colors.accent1 },
    { title: '{{item4Title}}', subtitle: '{{item4Subtitle}}', badge: '{{item4Badge}}', meta: '{{item4Meta}}', colors: theme.colors.accent3 },
  ],
};

export default function ListScreen() {
  const [activeFilter, setActiveFilter] = useState(0);
  const [query, setQuery] = useState('');

  const filtered = SAMPLE_DATA.items.filter(
    item => !query || item.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SearchHeader
          title={SAMPLE_DATA.title}
          placeholder={SAMPLE_DATA.searchPlaceholder}
          filters={SAMPLE_DATA.filters}
          activeFilter={activeFilter}
          onSearch={setQuery}
          onFilterChange={setActiveFilter}
        />
        <View style={styles.list}>
          {filtered.map((item, i) => (
            <ListItem key={i} {...item} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050507' },
  scroll: { padding: 20, paddingBottom: 100 },
  list: { gap: 12, marginTop: 16 },
});
