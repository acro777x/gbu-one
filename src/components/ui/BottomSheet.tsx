import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { motion } from '../../lib/motion';
import { theme } from '../../lib/theme';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  height?: number | string;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
}) => {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 250 });
      translateY.value = withSpring(0, motion.spring.soft);
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
    }
  }, [visible]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleClose = () => {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View style={[styles.backdrop, animatedBackdropStyle]} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.sheet, animatedSheetStyle]}>
          {/* Grab handle */}
          <View style={styles.handle} />

          {title && (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
            </View>
          )}

          <View style={styles.content}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  sheet: {
    backgroundColor: '#161618',
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xl,
    maxHeight: SCREEN_HEIGHT * 0.85,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  header: {
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: theme.colors.ivory,
  },
  content: {
    paddingTop: theme.spacing.xs,
  },
});

export default BottomSheet;
