import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, RotateCcw } from 'lucide-react-native';
import { AnimatedLogo } from '../../src/components/brand/AnimatedLogo';
import {
  TypeWriter,
  WordReveal,
  LetterRise,
  ShimmerText,
  CountUp,
  ScrambleText,
} from '../../src/components/motion';
import { GlassCard, PillButton } from '../../src/components/ui';
import { useAppTheme } from '../../src/lib/ThemeContext';
import { theme } from '../../src/lib/theme';

export default function MotionPlayground() {
  const { colors, isDark } = useAppTheme();
  const [replayKey, setReplayKey] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [logoMode, setLogoMode] = useState<'intro' | 'loading' | 'static'>('intro');
  const [logoGlow, setLogoGlow] = useState(true);

  const handleReplay = () => {
    setReplayKey((k) => k + 1);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.borderGlass }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Motion Playground</Text>
        <TouchableOpacity
          onPress={handleReplay}
          style={styles.replayButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Replay animations"
        >
          <RotateCcw size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Global Controls */}
        <GlassCard style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Global Controls</Text>
          <View style={styles.controlRow}>
            <Text style={[styles.controlLabel, { color: colors.textPrimary }]}>Reduce Motion (OS toggle simulation)</Text>
            <Switch
              value={reduceMotion}
              onValueChange={setReduceMotion}
              trackColor={{ false: colors.borderStrong, true: colors.accent }}
            />
          </View>
        </GlassCard>

        {/* 1. Animated Brand Logo */}
        <GlassCard style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>1. Animated Logo</Text>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
            Traced mark from original source art, dome rise, &apos;1&apos; scale, authentic glow
          </Text>

          <View style={styles.logoCenter}>
            <AnimatedLogo
              key={`logo-${replayKey}-${logoMode}`}
              size={130}
              mode={logoMode}
              glow={logoGlow}
              variant={isDark ? 'dark' : 'light'}
              reduceMotion={reduceMotion}
            />
          </View>

          <View style={styles.buttonRow}>
            <PillButton
              label="Intro Draw"
              size="sm"
              variant={logoMode === 'intro' ? 'primary' : isDark ? 'dark' : 'white'}
              onPress={() => setLogoMode('intro')}
              style={styles.modeBtn}
            />
            <PillButton
              label="Loading Spin"
              size="sm"
              variant={logoMode === 'loading' ? 'primary' : isDark ? 'dark' : 'white'}
              onPress={() => setLogoMode('loading')}
              style={styles.modeBtn}
            />
            <PillButton
              label="Static"
              size="sm"
              variant={logoMode === 'static' ? 'primary' : isDark ? 'dark' : 'white'}
              onPress={() => setLogoMode('static')}
              style={styles.modeBtn}
            />
          </View>

          <View style={[styles.controlRow, { marginTop: 12 }]}>
            <Text style={[styles.controlLabel, { color: colors.textPrimary }]}>Glow Layer</Text>
            <Switch
              value={logoGlow}
              onValueChange={setLogoGlow}
              trackColor={{ false: colors.borderStrong, true: colors.accent }}
            />
          </View>
        </GlassCard>

        {/* 2. LetterRise */}
        <GlassCard style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>2. LetterRise (Wordmark)</Text>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
            Letters rise sequentially from below with snappy spring physics.
          </Text>

          <View style={[styles.previewBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}>
            <View style={styles.wordmarkRow}>
              <LetterRise
                key={`lr-gbu-${replayKey}`}
                text="GBU "
                style={{ ...styles.wordmarkGBU, color: colors.textPrimary }}
                stagger={24}
                reduceMotion={reduceMotion}
              />
              <LetterRise
                key={`lr-one-${replayKey}`}
                text="One"
                style={{ ...styles.wordmarkOne, color: colors.accent }}
                stagger={24}
                delay={60}
                reduceMotion={reduceMotion}
              />
            </View>
          </View>
        </GlassCard>

        {/* 3. TypeWriter */}
        <GlassCard style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>3. TypeWriter (Tagline)</Text>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
            Character-by-character typewriter reveal with blinking amber cursor.
          </Text>

          <View style={[styles.previewBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}>
            <TypeWriter
              key={`tw-${replayKey}`}
              text="Everything GBU. One app."
              speed={34}
              style={{ ...styles.typeWriterText, color: colors.accent }}
              reduceMotion={reduceMotion}
            />
          </View>
        </GlassCard>

        {/* 4. WordReveal */}
        <GlassCard style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>4. WordReveal (Headlines)</Text>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
            Word-by-word fade &amp; rise for headers and carousel titles.
          </Text>

          <View style={[styles.previewBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}>
            <WordReveal
              key={`wr-${replayKey}`}
              text="Next class: Data Structures at 09:30 AM in Room 208"
              stagger={60}
              style={{ ...styles.wordRevealText, color: colors.textPrimary }}
              reduceMotion={reduceMotion}
            />
          </View>
        </GlassCard>

        {/* 5. ShimmerText */}
        <GlassCard style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>5. ShimmerText (Live Badges)</Text>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
            Continuous subtle sheen sweep for active badges and countdowns.
          </Text>

          <View style={[styles.previewBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}>
            <View style={[styles.badgePill, { backgroundColor: colors.accentSoft }]}>
              <ShimmerText
                text="LIVE • Attendance 84%"
                style={{ ...styles.shimmerStyle, color: colors.accent }}
                reduceMotion={reduceMotion}
              />
            </View>
          </View>
        </GlassCard>

        {/* 6. CountUp */}
        <GlassCard style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>6. CountUp (Numbers)</Text>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
            Smooth numerical tween for attendance %, exam countdown, and credits.
          </Text>

          <View style={[styles.previewBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}>
            <View style={styles.countUpRow}>
              <View style={styles.countUpItem}>
                <CountUp
                  key={`cu-1-${replayKey}`}
                  value={84}
                  suffix="%"
                  duration={900}
                  style={{ ...styles.countUpNum, color: colors.accent }}
                  reduceMotion={reduceMotion}
                />
                <Text style={[styles.countUpLabel, { color: colors.textSecondary }]}>Attendance</Text>
              </View>
              <View style={styles.countUpItem}>
                <CountUp
                  key={`cu-2-${replayKey}`}
                  value={14}
                  duration={750}
                  style={{ ...styles.countUpNum, color: colors.warning }}
                  reduceMotion={reduceMotion}
                />
                <Text style={[styles.countUpLabel, { color: colors.textSecondary }]}>Days to Midsem</Text>
              </View>
              <View style={styles.countUpItem}>
                <CountUp
                  key={`cu-3-${replayKey}`}
                  value={22}
                  duration={600}
                  style={{ ...styles.countUpNum, color: colors.success }}
                  reduceMotion={reduceMotion}
                />
                <Text style={[styles.countUpLabel, { color: colors.textSecondary }]}>Credits</Text>
              </View>
            </View>
          </View>
        </GlassCard>

        {/* 7. ScrambleText */}
        <GlassCard style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>7. ScrambleText (Room / Cipher)</Text>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
            Matrix-style cipher decryption effect for room changes and notices.
          </Text>

          <View style={[styles.previewBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}>
            <ScrambleText
              key={`sc-${replayKey}`}
              text="ROOM 208 • SOICT"
              duration={700}
              style={{ ...styles.scrambleText, color: colors.accent }}
              reduceMotion={reduceMotion}
            />
          </View>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
  },
  replayButton: {
    padding: 8,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 60,
  },
  card: {
    marginBottom: theme.spacing.lg,
  },
  cardTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    marginBottom: 4,
  },
  cardSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginBottom: theme.spacing.md,
  },
  logoCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modeBtn: {
    flex: 1,
    marginHorizontal: 4,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
  },
  previewBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordmarkGBU: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
  },
  wordmarkOne: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
  },
  typeWriterText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
  },
  wordRevealText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    textAlign: 'center',
  },
  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  shimmerStyle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  countUpRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  countUpItem: {
    alignItems: 'center',
  },
  countUpNum: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
  },
  countUpLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  scrambleText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    textAlign: 'center',
  },
});
