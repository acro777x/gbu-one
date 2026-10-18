import React from 'react';
import { StyleSheet, Text, Pressable, ViewStyle, TextStyle } from 'react-native';
import { X } from 'lucide-react-native';
import { theme } from '../../lib/theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  onRemove,
  style,
  textStyle,
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected ? styles.chipSelected : styles.chipUnselected,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text
        style={[
          styles.text,
          selected ? styles.textSelected : styles.textUnselected,
          textStyle,
        ]}
      >
        {label}
      </Text>
      {onRemove && (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          style={styles.removeButton}
          accessibilityLabel={`Remove ${label}`}
        >
          <X size={14} color={selected ? theme.colors.bg : theme.colors.textSecondary} />
        </Pressable>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 7,
    borderRadius: theme.radius.chip,
    borderWidth: 1,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  chipUnselected: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: theme.colors.borderGlass,
  },
  chipSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  text: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
  },
  textUnselected: {
    color: theme.colors.textSecondary,
  },
  textSelected: {
    color: theme.colors.ivory,
    fontWeight: '600',
  },
  removeButton: {
    marginLeft: 6,
  },
});

export default Chip;
