import React from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { WordReveal } from '../motion/WordReveal';
import { PillButton } from './PillButton';
import { theme } from '../../lib/theme';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {icon && <View style={styles.iconWrapper}>{icon}</View>}
      <WordReveal
        text={title}
        style={styles.title}
        containerStyle={styles.titleContainer}
      />
      {description && (
        <Text style={styles.description}>{description}</Text>
      )}
      {actionLabel && onAction && (
        <PillButton
          label={actionLabel}
          onPress={onAction}
          variant="outline"
          size="sm"
          style={styles.actionBtn}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    marginBottom: theme.spacing.md,
    opacity: 0.8,
  },
  titleContainer: {
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  actionBtn: {
    marginTop: theme.spacing.lg,
  },
});

export default EmptyState;
