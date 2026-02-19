import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { theme } from '../theme';

interface GlassCardProps extends ViewProps {
  variant?: 'default' | 'sm';
  children: React.ReactNode;
}

export function GlassCard({ variant = 'default', style, children, ...props }: GlassCardProps) {
  return (
    <View
      style={[
        styles.card,
        variant === 'sm' && styles.cardSm,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    overflow: 'hidden',
  },
  cardSm: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
  },
});
