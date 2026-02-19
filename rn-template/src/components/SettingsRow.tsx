import React from 'react';
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import Svg, { Path, Polyline } from 'react-native-svg';
import { theme } from '../theme';

interface SettingsRowProps {
  label: string;
  icon?: React.ReactNode;
  type?: 'arrow' | 'toggle';
  value?: boolean;
  onPress?: () => void;
  onToggle?: (val: boolean) => void;
}

export function SettingsRow({
  label, icon, type = 'arrow', value = false, onPress, onToggle,
}: SettingsRowProps) {
  return (
    <Pressable
      onPress={type === 'arrow' ? onPress : undefined}
      style={({ pressed }) => [styles.container, pressed && type === 'arrow' && styles.pressed]}
    >
      <View style={styles.left}>
        {icon && <View style={styles.iconBox}>{icon}</View>}
        <Text style={styles.label}>{label}</Text>
      </View>
      {type === 'toggle' ? (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.colors.primary[0] }}
          thumbColor="#fff"
        />
      ) : (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={2}>
          <Polyline points="9 18 15 12 9 6" />
        </Svg>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 4,
  },
  pressed: { opacity: 0.7 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 14, fontWeight: '500', color: '#fff' },
});
