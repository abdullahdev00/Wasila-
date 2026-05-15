import React from 'react';
import { Text, TextProps, StyleSheet, TextStyle } from 'react-native';
import { THEME } from '../../theme';

export type TypographyVariant = 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'button';
export type TypographyColor = 'main' | 'muted' | 'light' | 'inverse' | 'primary' | 'secondary' | 'error' | 'success';
export type TypographyWeight = 'regular' | 'medium' | 'bold';

export interface TypographyProps extends TextProps {
  variant?: TypographyVariant;
  color?: TypographyColor;
  weight?: TypographyWeight;
  align?: 'left' | 'center' | 'right';
  customStyle?: TextStyle;
  children: React.ReactNode;
}

export const Typography: React.FC<TypographyProps> = ({
  variant = 'body',
  color = 'main',
  weight = 'regular',
  align = 'left',
  customStyle,
  children,
  ...props
}) => {
  const textStyles = [
    styles.base,
    styles[variant],
    styles[`${color}Color`],
    styles[`${weight}Weight`],
    { textAlign: align },
    customStyle,
  ];

  return (
    <Text style={textStyles} {...props}>
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  base: {
    fontFamily: THEME.fonts.regular,
  },
  
  // -- Variants --
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontFamily: THEME.fonts.display,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    lineHeight: 32,
    fontFamily: THEME.fonts.display,
  },
  h3: {
    fontSize: 20,
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    fontSize: 16,
    lineHeight: 24,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // -- Colors --
  mainColor: { color: THEME.colors.textMain },
  mutedColor: { color: THEME.colors.textMuted },
  lightColor: { color: THEME.colors.textLight },
  inverseColor: { color: THEME.colors.textInverse },
  primaryColor: { color: THEME.colors.primary },
  secondaryColor: { color: THEME.colors.secondary },
  errorColor: { color: THEME.colors.error },
  successColor: { color: THEME.colors.success },

  // -- Weights --
  regularWeight: { fontWeight: '400' },
  mediumWeight: { fontWeight: '500' },
  boldWeight: { fontWeight: '700' },
});
