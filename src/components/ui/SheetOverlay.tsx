import React, { useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Dimensions,
  BackHandler,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion } from '../../lib/motion';
import { theme } from '../../lib/theme';
import { useAppTheme } from '../../lib/ThemeContext';
import { useSheetStore } from '../../store/useSheetStore';

export interface SheetOverlayProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** `sheet` slides up from the bottom, `center` floats in the middle. */
  variant?: 'sheet' | 'center';
  /** The sheet's own height in points. */
  height?: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * GBU One - the sheet overlay.
 *
 * A React Native `Modal` does not work in this app on Android: the modal
 * window is created and painted, but its content view is measured without
 * constraints, so the window ends up with no touchable region. The sheet was
 * invisible and every tap fell through to the screen underneath. The sheets
 * are therefore drawn inside the screen as an absolutely positioned overlay,
 * which behaves like a modal for the student and keeps the animation in the
 * app's own language.
 *
 * The overlay covers the whole window, including the status bar area, and
 * tells the tab layout to step aside while it is open.
 */
export const SheetOverlay: React.FC<SheetOverlayProps> = ({
  visible,
  onClose,
  title,
  children,
  variant = 'sheet',
  height,
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const setSheetOpen = useSheetStore((state) => state.setOpen);

  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setSheetOpen(true);
      progress.value = withSpring(1, motion.spring.soft);
    } else {
      setSheetOpen(false);
      progress.value = withTiming(0, { duration: 180 });
    }
  }, [visible, progress, setSheetOpen]);

  useEffect(() => {
    return () => setSheetOpen(false);
  }, [setSheetOpen]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform:
      variant === 'sheet'
        ? [{ translateY: (1 - progress.value) * SCREEN_HEIGHT }]
        : [{ scale: 0.94 + progress.value * 0.06 }],
  }));

  const handleClose = useCallback(() => {
    progress.value = withTiming(0, { duration: 160 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  }, [onClose, progress]);

  // The Android back button closes the sheet instead of leaving the screen.
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, handleClose]);

  if (!visible) return null;

  return (
    <View
      style={[
        styles.overlay,
        {
          top: -insets.top,
          bottom: -insets.bottom,
          left: -insets.left,
          right: -insets.right,
        },
      ]}
    >
      <Animated.View style={[styles.backdrop, { backgroundColor: 'rgba(9, 12, 20, 0.62)' }, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityLabel="Close" />
      </Animated.View>

      <Animated.View
        style={[
          variant === 'sheet' ? styles.sheet : styles.centered,
          {
            backgroundColor: variant === 'sheet' ? colors.surface : 'transparent',
            borderColor: colors.borderGlass,
            height,
            maxHeight: SCREEN_HEIGHT * 0.9,
            // The sheet reaches under the navigation bar, so its content is
            // padded clear of it.
            paddingBottom: variant === 'sheet' ? insets.bottom + theme.spacing.lg : 0,
          },
          sheetStyle,
        ]}
      >
        {variant === 'sheet' && <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />}

        {title && (
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          </View>
        )}

        {/* The content scrolls, so a long form is never cut off. */}
        <ScrollView
          style={height ? styles.scrollFixed : styles.scrollAuto}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    borderWidth: 1,
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    shadowColor: theme.colors.borderStrong,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 24,
  },
  /** A sheet with a fixed height: the content fills it and scrolls. */
  scrollFixed: {
    flex: 1,
  },
  /** A sheet that grows with its content, up to the maximum height. */
  scrollAuto: {
    flexShrink: 1,
  },
  card: {
    width: SCREEN_WIDTH - theme.spacing.xl * 2,
    alignSelf: 'center',
    borderRadius: theme.radius.card,
    borderWidth: 1,
    padding: theme.spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  header: {
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
  },
  content: {
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
  },
});

export default SheetOverlay;
