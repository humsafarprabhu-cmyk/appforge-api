import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

interface ListItemProps {
  title: string;
  subtitle: string;
  badge?: string;
  meta?: string;
  badgeColor?: string;
  colors?: string[];
  icon?: React.ReactNode;
  onPress?: () => void;
}

export function ListItem({
  title, subtitle, badge, meta, badgeColor = '#10b981',
  colors, icon, onPress,
}: ListItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={(colors || theme.colors.primary) as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconBox}
      >
        {icon}
      </LinearGradient>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      {(badge || meta) && (
        <View style={styles.right}>
          {badge && <Text style={[styles.badge, { color: badgeColor }]}>{badge}</Text>}
          {meta && <Text style={styles.meta}>{meta}</Text>}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.8 },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '600', color: '#fff' },
  subtitle: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  right: { alignItems: 'flex-end', flexShrink: 0 },
  badge: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2 },
});
