// d:\Aihacktonproject\Wasila\src\theme\index.ts
// This file acts as the central source of truth for the app's premium UI design system.
// Changes here can be applied globally across the entire app.

export const COLORS = {
  // Brand
  primary: '#4F46E5', // Deep Indigo
  primaryLight: '#818CF8',
  primaryDark: '#3730A3',
  
  secondary: '#10B981', // Elegant Emerald
  secondaryLight: '#34D399',
  secondaryDark: '#059669',
  
  accent: '#F59E0B',

  // Backgrounds & Surfaces
  background: '#F8FAFC', // Slate 50 (Very soft)
  surface: '#FFFFFF',
  surfaceDark: '#0F172A', // Slate 900

  // Typography
  textMain: '#0F172A',
  textMuted: '#64748B',
  textLight: '#94A3B8',
  textInverse: '#FFFFFF',

  // Status
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Borders
  border: '#E2E8F0',
  borderDark: '#334155',
  
  // Transparent / Overlays
  overlay: 'rgba(15, 23, 42, 0.4)',
  transparent: 'transparent',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const RADIUS = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  round: 9999,
};

export const FONTS = {
  regular: 'Inter-Regular', 
  medium: 'Inter-Medium',
  bold: 'Inter-Bold',
  display: 'SplineSans-Bold',
};

export const SHADOWS = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
};

export const THEME = {
  colors: COLORS,
  spacing: SPACING,
  radius: RADIUS,
  fonts: FONTS,
  shadows: SHADOWS,
};

export default THEME;
