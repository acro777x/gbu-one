import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
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
import { theme } from '../../lib/theme';

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

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  activeTab,
  onTabPress,
  userAvatar,
  userName,
  isGuest = true,
}) => {
  const activeIndex = Math.max(0, TABS.findIndex((t) => t.key === activeTab));
  const translateX = useSharedValue(0);
  const iconScale = useSharedValue(1);

  // Layout width
  const screenWidth = Dimensions.get('window').width;
  const barHorizontalMargin = 16;
  const barPadding = 4;
  const availableWidth = screenWidth - barHorizontalMargin * 2 - barPadding * 2;
  const tabWidth = availableWidth / TABS.length;

  useEffect(() => {
    translateX.value = withSpring(activeIndex * tabWidth, motion.spring.snappy);
    iconScale.value = withSequence(
      withTiming(1.12, { duration: 100 }),
      withTiming(1.0, { duration: 150 }),
    );
  }, [activeIndex, tabWidth]);

  const handlePress = (tabKey: string, index: number) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        // ignore haptics error if not available
      }
    }
    onTabPress(tabKey);
  };

  const capsuleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  return (
    <View style={styles.outerContainer} pointerEvents="box-none">
      <View style={styles.bar}>
        {/* Animated Capsule Indicator */}
        <Animated.View
          style={[
            styles.activeCapsule,
            { width: tabWidth },
            capsuleAnimatedStyle,
          ]}
        >
          {/* Reactive Glow behind active tab */}
          <View style={styles.reactiveGlow} />
          <View style={styles.capsulePill} />
        </Animated.View>

        {/* Tab Buttons */}
        {TABS.map((tab, idx) => {
          const isActive = idx === activeIndex;
          const activeColor = theme.colors.accent;
          const inactiveColor = theme.colors.textSecondary;

          return (
            <Pressable
              key={tab.key}
              onPress={() => handlePress(tab.key, idx)}
              style={styles.tabButton}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <Animated.View style={[styles.iconWrapper, isActive && iconAnimStyle]}>
                {tab.key === 'profile' ? (
                  <Avatar
                    url={userAvatar}
                    name={userName}
                    isGuest={isGuest}
                    size={24}
                    style={isActive ? styles.activeAvatarBorder : undefined}
                  />
                ) : (
                  tab.icon(isActive ? activeColor : inactiveColor, 20)
                )}
              </Animated.View>
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? theme.colors.ivory : inactiveColor },
                  isActive && styles.activeTabLabel,
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
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
    backgroundColor: 'rgba(22, 22, 24, 0.82)',
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
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
    width: '92%',
    height: '100%',
    borderRadius: 28,
    backgroundColor: 'rgba(255, 106, 43, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 43, 0.28)',
  },
  reactiveGlow: {
    position: 'absolute',
    width: '60%',
    height: 20,
    bottom: -6,
    backgroundColor: '#FF6A2B',
    borderRadius: 10,
    opacity: 0.25,
    shadowColor: '#FF6A2B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 8,
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
    borderColor: theme.colors.accent,
    borderWidth: 1.5,
  },
});

export default FloatingTabBar;
