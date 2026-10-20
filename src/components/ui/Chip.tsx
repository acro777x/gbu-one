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
          style={styles.removeButton}
          accessibilityLabel={`Remove ${label}`}
          accessibilityRole="button"
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
    // The whole chip has to be a comfortable target (AGENTS.md: 44pt min),
    // including the short labels, which would otherwise be narrower than that.
    minHeight: 44,
    minWidth: 44,
    borderRadius: theme.radius.chip,
    borderWidth: 1,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  chipUnselected: {
    backgroundColor: 'rgba(17, 24, 39, 0.05)',
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
    // The X glyph is small, so the touch target is widened around it and the
    // extra size is taken back with negative margins (the chip keeps its
    // height). The target ends up at 44x44 dp.
    width: 44,
    height: 44,
    marginLeft: -4,
    marginRight: -10,
    marginVertical: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Chip;
