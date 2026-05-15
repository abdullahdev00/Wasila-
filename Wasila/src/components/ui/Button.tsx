import React from 'react';
import { 
  TouchableOpacity,
  Text,
  View,
  StyleSheet, 
  ActivityIndicator, 
  TouchableOpacityProps,
  ViewStyle,
  TextStyle
} from 'react-native';
import { THEME } from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  customStyle?: ViewStyle;
  customLabelStyle?: TextStyle;
}

import Animated, { 
  FadeIn, 
  FadeOut, 
  useAnimatedStyle, 
  withTiming,
  useSharedValue,
  interpolateColor
} from 'react-native-reanimated';

export const Button: React.FC<ButtonProps> = ({
  label,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  customStyle,
  customLabelStyle,
  disabled,
  ...props
}) => {
  const isDisabled = disabled || isLoading;

  // Resolve Styles based on Props
  const containerStyles = [
    styles.baseContainer,
    styles[`${variant}Container`],
    styles[`${size}Container`],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabledContainer,
    customStyle,
  ];

  const labelStyles = [
    styles.baseLabel,
    styles[`${variant}Label`],
    styles[`${size}Label`],
    isDisabled && styles.disabledLabel,
    customLabelStyle,
  ];

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={isDisabled}
      style={containerStyles}
      {...props}
    >
      <View style={styles.contentContainer}>
        {isLoading ? (
          <Animated.View 
            entering={FadeIn.duration(200)} 
            exiting={FadeOut.duration(200)}
            style={styles.loaderContainer}
          >
            <ActivityIndicator 
              color={variant === 'outline' || variant === 'ghost' ? THEME.colors.primary : THEME.colors.surface} 
              size="small" 
            />
          </Animated.View>
        ) : (
          <Animated.View 
            entering={FadeIn.duration(200)} 
            exiting={FadeOut.duration(200)}
            style={styles.innerContent}
          >
            {leftIcon && leftIcon}
            <Text style={labelStyles}>{label}</Text>
            {rightIcon && rightIcon}
          </Animated.View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.radius.lg, // Premium rounded look
    gap: THEME.spacing.sm,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
  },
  loaderContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseLabel: {
    fontWeight: '600',
    textAlign: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  
  // -- Sizes --
  smContainer: {
    paddingVertical: THEME.spacing.xs,
    paddingHorizontal: THEME.spacing.md,
    minHeight: 36,
  },
  smLabel: {
    fontSize: 14,
  },
  mdContainer: {
    paddingVertical: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.lg,
    minHeight: 48,
  },
  mdLabel: {
    fontSize: 16,
  },
  lgContainer: {
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.xl,
    minHeight: 56,
  },
  lgLabel: {
    fontSize: 18,
  },

  // -- Variants --
  primaryContainer: {
    backgroundColor: THEME.colors.primary,
    ...THEME.shadows.md,
  },
  primaryLabel: {
    color: THEME.colors.surface,
  },
  
  secondaryContainer: {
    backgroundColor: THEME.colors.secondary,
    ...THEME.shadows.md,
  },
  secondaryLabel: {
    color: THEME.colors.surface,
  },

  outlineContainer: {
    backgroundColor: THEME.colors.transparent,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
  },
  outlineLabel: {
    color: THEME.colors.primary,
  },

  ghostContainer: {
    backgroundColor: THEME.colors.transparent,
  },
  ghostLabel: {
    color: THEME.colors.primary,
  },

  dangerContainer: {
    backgroundColor: THEME.colors.error,
    ...THEME.shadows.md,
  },
  dangerLabel: {
    color: THEME.colors.surface,
  },

  // -- States --
  disabledContainer: {
    backgroundColor: THEME.colors.border,
    borderColor: THEME.colors.border,
    elevation: 0,
    shadowOpacity: 0,
  },
  disabledLabel: {
    color: THEME.colors.textLight,
  },
});
