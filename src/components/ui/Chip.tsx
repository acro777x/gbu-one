import React from 'react';
import { StyleSheet, Text, Pressable, ViewStyle, TextStyle } from 'react-native';
import { X } from 'lucide-react-native';
import { theme } from '../../lib/theme';
import { useAppTheme } from '../../lib/ThemeContext';

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
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.accentFill, borderColor: colors.accentFill }
          : { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text
        style={[
          styles.text,
          { color: selected ? colors.onAccent : colors.textSecondary },
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
          <X size={14} color={selected ? colors.onAccent : colors.textSecondary} />
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
  text: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
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
