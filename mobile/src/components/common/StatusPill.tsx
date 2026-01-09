import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { JobStatusType, getJobStatusLabel, getJobStatusColors } from '../../types/enums';

// ============================================
// Status Pill Component
// Displays a colored badge for job status
// ============================================

interface StatusPillProps {
  status: JobStatusType;
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

export function StatusPill({ status, size = 'medium', style }: StatusPillProps) {
  const colors = getJobStatusColors(status);
  const label = getJobStatusLabel(status);

  const sizeStyles = {
    small: styles.small,
    medium: styles.medium,
    large: styles.large,
  };

  const textSizeStyles = {
    small: styles.textSmall,
    medium: styles.textMedium,
    large: styles.textLarge,
  };

  return (
    <View
      style={[
        styles.pill,
        sizeStyles[size],
        { backgroundColor: colors.bg },
        style,
      ]}
    >
      <Text style={[styles.text, textSizeStyles[size], { color: colors.text }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  medium: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  large: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 10,
  },
  textMedium: {
    fontSize: 11,
  },
  textLarge: {
    fontSize: 12,
  },
});
