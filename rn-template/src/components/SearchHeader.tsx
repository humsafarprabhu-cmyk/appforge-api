import React, { useState } from 'react';
import { View, TextInput, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

interface SearchHeaderProps {
  title: string;
  placeholder?: string;
  filters?: string[];
  activeFilter?: number;
  onSearch?: (text: string) => void;
  onFilterChange?: (index: number) => void;
}

export function SearchHeader({
  title, placeholder = 'Search...', filters = [],
  activeFilter = 0, onSearch, onFilterChange,
}: SearchHeaderProps) {
  const [query, setQuery] = useState('');

  return (
    <View>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.searchBox}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={2}>
          <Circle cx={11} cy={11} r={8} />
          <Line x1={21} y1={21} x2={16.65} y2={16.65} />
        </Svg>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={query}
          onChangeText={(t) => { setQuery(t); onSearch?.(t); }}
        />
      </View>
      {filters.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          {filters.map((f, i) => (
            i === activeFilter ? (
              <LinearGradient
                key={i}
                colors={theme.colors.primary as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.filterChip}
              >
                <Pressable onPress={() => onFilterChange?.(i)}>
                  <Text style={styles.filterTextActive}>{f}</Text>
                </Pressable>
              </LinearGradient>
            ) : (
              <Pressable key={i} style={styles.filterChipInactive} onPress={() => onFilterChange?.(i)}>
                <Text style={styles.filterText}>{f}</Text>
              </Pressable>
            )
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { ...theme.typography.h2, color: '#fff' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  input: { flex: 1, fontSize: 14, color: '#fff' },
  filters: { flexDirection: 'row', marginBottom: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginRight: 8 },
  filterChipInactive: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  filterTextActive: { fontSize: 12, fontWeight: '500', color: '#fff' },
  filterText: { fontSize: 12, color: theme.colors.textMuted },
});
