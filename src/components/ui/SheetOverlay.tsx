import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { X } from 'lucide-react-native';
import { motion } from '../../lib/motion';
import { theme } from '../../lib/theme';
import { useAppTheme } from '../../lib/ThemeContext';
import { useReduceMotion } from '../../lib/useReduceMotion';
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
  /**
   * The ACTION the close control performs, in the student's words:
   * "Close" for an ordinary sheet, "Dismiss alarm" for the class alarm.
   * It is what a screen reader announces, so it must describe the action
   * rather than the shape of the control.
   */
  closeLabel?: string;
  /** Whether a tap on the backdrop closes the sheet. Default: true. */
  dismissOnBackdropPress?: boolean;
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
  closeLabel = 'Close',
  dismissOnBackdropPress = true,
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const registerSheet = useSheetStore((state) => state.register);

  const progress = useSharedValue(0);

  /**
   * The sheet stays mounted until its exit animation has finished. Returning
   * `null` on the very render in which `visible` flips to `false` used to
   * kill the exit animation: a programmatically closed sheet vanished
   * instantly while a user-closed one animated.
   */
  const [mounted, setMounted] = useState(visible);
  const mountedRef = useRef(mounted);
  mountedRef.current = mounted;

  const hide = useCallback(() => {
    mountedRef.current = false;
    setMounted(false);
  }, []);

  useEffect(() => {
    if (visible) {
      if (!mountedRef.current) {
        mountedRef.current = true;
        setMounted(true);
      }
      progress.value = reduceMotion ? 1 : withSpring(1, motion.spring.soft);
      return;
    }

    if (!mountedRef.current) return;

    if (reduceMotion) {
      progress.value = 0;
      hide();
      return;
    }

    progress.value = withTiming(0, { duration: 180 }, (finished) => {
      if (finished) {
        runOnJS(hide)();
      }
    });
  }, [visible, reduceMotion, progress, hide]);

  /**
   * The tab bar steps aside while a sheet is on screen. The store counts the
   * open sheets, so closing one of several sheets does not re-show the tab
   * bar while another one is still up.
   */
  useEffect(() => {
    if (!mounted) return;
    const release = registerSheet();
    return release;
  }, [mounted, registerSheet]);

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
    if (reduceMotion) {
      // No motion: the sheet is torn down by the `visible` flip below.
      onClose();
      return;
    }
    progress.value = withTiming(0, { duration: 160 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  }, [onClose, progress, reduceMotion]);

  // The Android back button closes the sheet instead of leaving the screen.
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, handleClose]);

  if (!mounted) return null;

  const closeButton = (
    <Pressable
      onPress={handleClose}
      hitSlop={12}
      style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.7 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={closeLabel}
    >
      <X size={18} color={colors.textSecondary} />
    </Pressable>
  );

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
      // While the exit animation is running the sheet must not eat touches.
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Animated.View style={[styles.backdrop, { backgroundColor: 'rgba(9, 12, 20, 0.62)' }, backdropStyle]}>
        {/*
          The backdrop is a full-screen press target. It is hidden from the
          accessibility tree: a screen reader must not land on a screen-sized
          "Close" element, and the sheet's own close control carries the
          action instead.
        */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissOnBackdropPress ? handleClose : undefined}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          accessible={false}
          focusable={false}
        />
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
        /*
          On iOS `accessibilityViewIsModal` makes VoiceOver ignore the views
          behind the sheet, so the screen underneath is not read out with it.
          (On Android the equivalent is to hide the content behind the sheet,
          which lives in a screen this component does not own.)
        */
        accessibilityViewIsModal
        importantForAccessibility="yes"
      >
        {variant === 'sheet' && <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />}

        {title ? (
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <Text
              style={[styles.title, { color: colors.textPrimary }]}
              accessibilityRole="header"
              numberOfLines={2}
            >
              {title}
            </Text>
            {closeButton}
          </View>
        ) : (
          <View style={styles.topBar}>{closeButton}</View>
        )}

        {/* The content scrolls, so a long form is never cut off. */}
        <ScrollView
          style={height ? styles.scrollFixed : styles.scrollAuto}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
          nestedScrollEnabled={true}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    marginBottom: theme.spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: theme.spacing.xs,
  },
  closeBtn: {
    // The project floor for a touch target is 44pt (AGENTS.md).
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    flex: 1,
  },
  content: {
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
  },
});

export default SheetOverlay;
