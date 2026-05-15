import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity, StyleProp } from 'react-native';
import { THEME } from '../../theme';

export interface CardProps {
  children: React.ReactNode;
  customStyle?: StyleProp<ViewStyle>;
  variant?: 'elevated' | 'outlined' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  customStyle,
  variant = 'elevated',
  padding = 'md',
  onPress,
}) => {
  const containerStyles = [
    styles.base,
    styles[variant],
    styles[`padding_${padding}`],
    customStyle,
  ];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} style={containerStyles} onPress={onPress}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyles}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.surface,
    overflow: 'hidden',
  },
  
  // -- Variants --
  elevated: {
    ...THEME.shadows.md,
  },
  outlined: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    elevation: 0,
    shadowOpacity: 0,
  },
  flat: {
    backgroundColor: THEME.colors.background,
    elevation: 0,
    shadowOpacity: 0,
  },

  // -- Padding --
  padding_none: {
    padding: 0,
  },
  padding_sm: {
    padding: THEME.spacing.sm,
  },
  padding_md: {
    padding: THEME.spacing.md,
  },
  padding_lg: {
    padding: THEME.spacing.lg,
  },
});
