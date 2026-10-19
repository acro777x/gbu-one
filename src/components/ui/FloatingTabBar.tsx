import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Home, Calendar, Bell, FileText, User } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { motion } from '../../lib/motion';
import { useAppTheme } from '../../lib/ThemeContext';
import { ColorSet } from '../../lib/theme';

export interface TabItem {
  key: string;
  label: string;
  icon: (color: string, size: number) => React.ReactNode;
}

export interface FloatingTabBarProps {
  activeTab: string;
  onTabPress: (tabKey: string) => void;
  userAvatar?: string | null;
  userName?: string;
  isGuest?: boolean;
}

const TABS: TabItem[] = [
  { key: 'home', label: 'Home', icon: (c, s) => <Home color={c} size={s} /> },
  { key: 'timetable', label: 'Timetable', icon: (c, s) => <Calendar color={c} size={s} /> },
  { key: 'notices', label: 'Notices', icon: (c, s) => <Bell color={c} size={s} /> },
  { key: 'pyq', label: 'PYQ', icon: (c, s) => <FileText color={c} size={s} /> },
  { key: 'profile', label: 'Profile', icon: (c, s) => <User color={c} size={s} /> },
];

interface TabButtonProps {
  tab: TabItem;
  isActive: boolean;
  onPress: () => void;
  userAvatar?: string | null;
  userName?: string;
  isGuest?: boolean;
  colors: ColorSet;
}

const TabButton: React.FC<TabButtonProps> = ({
  tab,
  isActive,
  onPress,
  userAvatar,
  userName,
  isGuest,
  colors,
}) => {
  const scale = useSharedValue(1);
  const prevActive = useRef(isActive);

  useEffect(() => {
    if (isActive && !prevActive.current) {
      scale.value = withSequence(
        withTiming(1.15, { duration: 100 }),
        withSpring(1.0, { damping: 15, stiffness: 300 }),
      );
    }
    prevActive.current = isActive;
  }, [isActive]);

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const activeColor = colors.accent;
  const inactiveColor = colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      style={styles.tabButton}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={tab.label}
    >
      <Animated.View style={[styles.iconWrapper, iconAnimStyle]}>
        {tab.key === 'profile' ? (
          <Avatar
            url={userAvatar}
            name={userName}
            isGuest={isGuest}
            size={24}
            style={isActive ? [styles.activeAvatarBorder, { borderColor: colors.accent }] : undefined}
          />
        ) : (
          tab.icon(isActive ? activeColor : inactiveColor, 20)
        )}
      </Animated.View>
      <Text
        style={[
          styles.tabLabel,
          { color: isActive ? colors.textPrimary : inactiveColor },
          isActive && styles.activeTabLabel,
        ]}
        numberOfLines={1}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
};

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  activeTab,
  onTabPress,
  userAvatar,
  userName,
  isGuest = true,
}) => {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const activeIndex = Math.max(0, TABS.findIndex((t) => t.key === activeTab));
  const translateX = useSharedValue(0);

  // Layout width
  const barHorizontalMargin = 16;
  const barPadding = 4;
  const availableWidth = screenWidth - barHorizontalMargin * 2 - barPadding * 2;
  const tabWidth = availableWidth / TABS.length;

  useEffect(() => {
    translateX.value = withSpring(activeIndex * tabWidth, motion.spring.snappy);
  }, [activeIndex, tabWidth]);

  const handlePress = (tabKey: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // ignore haptics error if not available
      }
    }
    onTabPress(tabKey);
  };

  const capsuleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const dynamicBottom = Math.max(16, insets.bottom + 6);

  return (
    <View style={[styles.outerContainer, { bottom: dynamicBottom }]} pointerEvents="box-none">
      <View
        style={[
          styles.bar,
          {
            backgroundColor: isDark ? 'rgba(22, 22, 24, 0.90)' : 'rgba(255, 255, 255, 0.96)',
            borderColor: colors.borderGlass,
          },
        ]}
      >
        {/* Animated Capsule Indicator */}
        <Animated.View
          style={[
            styles.activeCapsule,
            { width: tabWidth },
            capsuleAnimatedStyle,
          ]}
        >
          {/* Reactive Glow behind active tab */}
          <View style={[styles.reactiveGlow, { backgroundColor: colors.accent }]} />
          <View
            style={[
              styles.capsulePill,
              {
                backgroundColor: isDark ? 'rgba(255, 106, 43, 0.16)' : colors.accentSoft,
                borderColor: `${colors.accent}40`,
              },
            ]}
          />
        </Animated.View>

        {/* Tab Buttons */}
        {TABS.map((tab, idx) => (
          <TabButton
            key={tab.key}
            tab={tab}
            isActive={idx === activeIndex}
            onPress={() => handlePress(tab.key)}
            userAvatar={userAvatar}
            userName={userName}
            isGuest={isGuest}
            colors={colors}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  bar: {
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    position: 'relative',
    shadowColor: '#344054',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 12,
  },
  activeCapsule: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  capsulePill: {
    width: '90%',
    height: '100%',
    borderRadius: 24,
    borderWidth: 1,
  },
  reactiveGlow: {
    position: 'absolute',
    width: '70%',
    height: 28,
    borderRadius: 14,
    opacity: 0.12,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
  },
  activeTabLabel: {
    fontFamily: 'Inter-SemiBold',
  },
  activeAvatarBorder: {
    borderWidth: 1.5,
  },
});

export default FloatingTabBar;
