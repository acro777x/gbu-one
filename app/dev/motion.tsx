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
import { theme } from '../../src/lib/theme';

export default function MotionPlayground() {
  const [replayKey, setReplayKey] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [logoMode, setLogoMode] = useState<'intro' | 'loading' | 'static'>('intro');
  const [logoGlow, setLogoGlow] = useState(true);

  const handleReplay = () => {
    setReplayKey((k) => k + 1);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={22} color={theme.colors.ivory} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Motion Playground</Text>
        <TouchableOpacity
          onPress={handleReplay}
          style={styles.replayButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Replay animations"
        >
          <RotateCcw size={20} color={theme.colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Global Controls */}
        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Global Controls</Text>
          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Reduce Motion (OS toggle simulation)</Text>
            <Switch
              value={reduceMotion}
              onValueChange={setReduceMotion}
              trackColor={{ false: '#333', true: theme.colors.accent }}
            />
          </View>
        </GlassCard>

        {/* 1. Animated Brand Logo */}
        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>1. Animated Logo</Text>
          <Text style={styles.cardSub}>Traced vector mark, stroke-draw ribbons, dome rise, '1' scale, code glow</Text>

          <View style={styles.logoCenter}>
            <AnimatedLogo
              key={`logo-${replayKey}-${logoMode}`}
              size={130}
              mode={logoMode}
              glow={logoGlow}
              reduceMotion={reduceMotion}
            />
          </View>

          <View style={styles.buttonRow}>
            <PillButton
              label="Intro Draw"
              size="sm"
              variant={logoMode === 'intro' ? 'primary' : 'dark'}
              onPress={() => setLogoMode('intro')}
              style={styles.modeBtn}
            />
            <PillButton
              label="Loading Spin"
              size="sm"
              variant={logoMode === 'loading' ? 'primary' : 'dark'}
              onPress={() => setLogoMode('loading')}
              style={styles.modeBtn}
            />
            <PillButton
              label="Static"
              size="sm"
              variant={logoMode === 'static' ? 'primary' : 'dark'}
              onPress={() => setLogoMode('static')}
              style={styles.modeBtn}
            />
          </View>

          <View style={[styles.controlRow, { marginTop: 12 }]}>
            <Text style={styles.controlLabel}>Code Glow Layer</Text>
            <Switch
              value={logoGlow}
              onValueChange={setLogoGlow}
              trackColor={{ false: '#333', true: theme.colors.accent }}
            />
          </View>
        </GlassCard>

        {/* 2. LetterRise */}
        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>2. LetterRise</Text>
          <Text style={styles.cardSub}>Used in logo wordmark & screen titles</Text>
          <View style={styles.previewBox}>
            <View style={styles.wordmarkRow}>
              <LetterRise
                key={`lr-gbu-${replayKey}`}
                text="GBU "
                style={styles.wordmarkGBU}
                reduceMotion={reduceMotion}
              />
              <LetterRise
                key={`lr-one-${replayKey}`}
                text="One"
                style={styles.wordmarkOne}
                delay={80}
                reduceMotion={reduceMotion}
              />
            </View>
          </View>
        </GlassCard>

        {/* 3. TypeWriter */}
        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>3. TypeWriter</Text>
          <Text style={styles.cardSub}>Used in splash tagline & login subtitles</Text>
          <View style={styles.previewBox}>
            <TypeWriter
              key={`tw-${replayKey}`}
              text="Everything GBU. One app."
              speed={40}
              style={styles.typeWriterText}
              reduceMotion={reduceMotion}
            />
          </View>
        </GlassCard>

        {/* 4. WordReveal */}
        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>4. WordReveal</Text>
          <Text style={styles.cardSub}>Used in onboarding headlines & status loaders</Text>
          <View style={styles.previewBox}>
            <WordReveal
              key={`wr-${replayKey}`}
              text="Every GBU notice, sorted and filtered for your class."
              style={styles.wordRevealText}
              reduceMotion={reduceMotion}
            />
          </View>
        </GlassCard>

        {/* 5. ShimmerText */}
        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>5. ShimmerText</Text>
          <Text style={styles.cardSub}>Used for 'LIVE now', 'New', and accent pills</Text>
          <View style={styles.previewBox}>
            <View style={styles.badgePill}>
              <ShimmerText
                text="• LIVE NOW"
                style={styles.shimmerStyle}
                reduceMotion={reduceMotion}
              />
            </View>
          </View>
        </GlassCard>

        {/* 6. CountUp */}
        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>6. CountUp</Text>
          <Text style={styles.cardSub}>Used in countdowns, attendance %, PYQ downloads</Text>
          <View style={styles.previewBox}>
            <View style={styles.countUpRow}>
              <View style={styles.countUpItem}>
                <CountUp
                  key={`cu-1-${replayKey}`}
                  value={87.5}
                  decimals={1}
                  suffix="%"
                  style={styles.countUpNum}
                  reduceMotion={reduceMotion}
                />
                <Text style={styles.countUpLabel}>Attendance</Text>
              </View>

              <View style={styles.countUpItem}>
                <CountUp
                  key={`cu-2-${replayKey}`}
                  value={142}
                  prefix=""
                  suffix=" papers"
                  style={styles.countUpNum}
                  reduceMotion={reduceMotion}
                />
                <Text style={styles.countUpLabel}>Available PYQs</Text>
              </View>
            </View>
          </View>
        </GlassCard>

        {/* 7. ScrambleText */}
        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>7. ScrambleText</Text>
          <Text style={styles.cardSub}>Used on onboarding highlight & 'Result Found' celebration</Text>
          <View style={styles.previewBox}>
            <ScrambleText
              key={`st-${replayKey}`}
              text="RESULT FOUND: ROLL 22/BCS/048"
              duration={900}
              style={styles.scrambleText}
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
    backgroundColor: theme.colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17, 24, 39, 0.08)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: theme.colors.ivory,
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
    color: theme.colors.ivory,
    marginBottom: 4,
  },
  cardSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
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
    color: theme.colors.textPrimary,
  },
  previewBox: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(17, 24, 39, 0.06)',
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
    color: theme.colors.ivory,
  },
  wordmarkOne: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: theme.colors.accent,
  },
  typeWriterText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: theme.colors.accent,
  },
  wordRevealText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: theme.colors.ivory,
    textAlign: 'center',
  },
  badgePill: {
    backgroundColor: theme.colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  shimmerStyle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: theme.colors.accent,
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
    color: theme.colors.accent,
  },
  countUpLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  scrambleText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: theme.colors.accent,
    textAlign: 'center',
  },
});
