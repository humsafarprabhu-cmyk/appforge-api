import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { theme } from '../theme';

interface GlassInputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function GlassInput({ label, error, style, ...props }: GlassInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
          style,
        ]}
        placeholderTextColor="rgba(255,255,255,0.3)"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: theme.spacing.lg },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: theme.radius.md,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  inputFocused: {
    borderColor: theme.colors.primary[0],
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  error: {
    ...theme.typography.tiny,
    color: theme.colors.error,
    marginTop: 4,
  },
});
