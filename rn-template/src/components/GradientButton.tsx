import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

interface GradientButtonProps {
  label: string;
  onPress?: () => void;
  colors?: string[];
  style?: ViewStyle;
  disabled?: boolean;
}

export function GradientButton({
  label,
  onPress,
  colors,
  style,
  disabled = false,
}: GradientButtonProps) {
  const gradColors = colors || theme.colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <LinearGradient
        colors={gradColors as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    ...theme.shadow.lg,
  },
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.5,
  },
});
