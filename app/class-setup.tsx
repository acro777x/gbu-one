import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Chip, PillButton, GlassCard } from '../src/components/ui';
import { useAuthStore, ClassSelection } from '../src/store/useAuthStore';
import { useAppTheme } from '../src/lib/ThemeContext';
import { spacing, radius } from '../src/lib/theme';

const SCHOOLS = [
  'SOICT',
  'SOE',
  'SOM',
  'SOBT',
  'SOHSS',
  'SOVSAS',
  'SOLJG',
  'SOBSC',
];

const PROGRAMMES_BY_SCHOOL: Record<string, Array<{ name: string; code: string }>> = {
  SOICT: [
    { name: 'B.Tech (CS)', code: 'BCS' },
    { name: 'B.Tech (AI)', code: 'BAI' },
    { name: 'BCA', code: 'BCA' },
    { name: 'MCA', code: 'MCA' },
    { name: 'M.Tech (CSE)', code: 'MCS' },
  ],
  SOE: [
    { name: 'B.Tech (Civil)', code: 'BCE' },
    { name: 'B.Tech (Mechanical)', code: 'BME' },
    { name: 'B.Tech (EE)', code: 'BEE' },
  ],
  SOM: [
    { name: 'BBA', code: 'BBA' },
    { name: 'MBA', code: 'MBA' },
    { name: 'B.Com (Hons)', code: 'BCM' },
  ],
  SOBT: [
    { name: 'B.Tech (Biotech)', code: 'BBT' },
    { name: 'M.Sc (Biotech)', code: 'MBT' },
  ],
  SOHSS: [
    { name: 'BA (Economics)', code: 'BAEC' },
    { name: 'MA (English)', code: 'MAE' },
  ],
  SOVSAS: [
    { name: 'B.Sc (Applied Physics)', code: 'BAP' },
    { name: 'M.Sc (Chemistry)', code: 'MSC' },
  ],
  SOLJG: [
    { name: 'BA LLB', code: 'LLB' },
    { name: 'LLM', code: 'LLM' },
  ],
  SOBSC: [
    { name: 'B.Sc (Buddhist Studies)', code: 'BBS' },
  ],
};

const SEMESTERS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

const SECTIONS = ['A', 'B', 'C', 'General'];

export default function ClassSetupScreen() {
  const { classSelection, setClassSelection } = useAuthStore();
  const { colors, isDark } = useAppTheme();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedSchool, setSelectedSchool] = useState<string>(classSelection?.school || 'SOICT');
  const [selectedProg, setSelectedProg] = useState<{ name: string; code: string }>(
    { name: classSelection?.programme || 'B.Tech (CS)', code: classSelection?.programmeCode || 'BCS' },
  );
  const [selectedSem, setSelectedSem] = useState<string>(classSelection?.semester || 'II');
  const [selectedSec, setSelectedSec] = useState<string>(
    classSelection?.section ? classSelection.section.split(' ').pop() || 'B' : 'B',
  );

  const availableProgrammes = PROGRAMMES_BY_SCHOOL[selectedSchool] || PROGRAMMES_BY_SCHOOL['SOICT'];

  const handleFinish = () => {
    const fullSectionName = `${selectedProg.code}-${selectedSem} ${selectedSec}`;
    const selection: ClassSelection = {
      school: selectedSchool,
      programme: selectedProg.name,
      programmeCode: selectedProg.code,
      semester: selectedSem,
      section: fullSectionName,
    };

    setClassSelection(selection);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => (step > 1 ? setStep(((step - 1) as 1 | 2 | 3 | 4)) : router.back())}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Class Setup</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Step Indicator */}
      <View style={styles.stepIndicatorRow}>
        {[1, 2, 3, 4].map((s) => (
          <View
            key={`step-${s}`}
            style={[
              styles.stepBar,
              { backgroundColor: s <= step ? colors.accent : colors.borderGlass },
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Choose your School</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              Select the faculty / school your department belongs to at GBU.
            </Text>

            <View style={styles.chipsWrap}>
              {SCHOOLS.map((school) => (
                <Chip
                  key={school}
                  label={school}
                  selected={selectedSchool === school}
                  onPress={() => setSelectedSchool(school)}
                  style={styles.choiceChip}
                />
              ))}
            </View>

            <PillButton
              label="Continue to Programme"
              onPress={() => setStep(2)}
              variant="primary"
              size="md"
              style={styles.nextBtn}
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Select your Programme</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              Which degree programme are you enrolled in?
            </Text>

            <View style={styles.chipsWrap}>
              {availableProgrammes.map((prog) => (
                <Chip
                  key={prog.code}
                  label={`${prog.name} (${prog.code})`}
                  selected={selectedProg.code === prog.code}
                  onPress={() => setSelectedProg(prog)}
                  style={styles.choiceChip}
                />
              ))}
            </View>

            <PillButton
              label="Continue to Semester"
              onPress={() => setStep(3)}
              variant="primary"
              size="md"
              style={styles.nextBtn}
            />
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Select your Semester</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              Choose your current academic term.
            </Text>

            <View style={styles.chipsWrap}>
              {SEMESTERS.map((sem) => (
                <Chip
                  key={sem}
                  label={`Semester ${sem}`}
                  selected={selectedSem === sem}
                  onPress={() => setSelectedSem(sem)}
                  style={styles.choiceChip}
                />
              ))}
            </View>

            <PillButton
              label="Continue to Section"
              onPress={() => setStep(4)}
              variant="primary"
              size="md"
              style={styles.nextBtn}
            />
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Select your Section / Batch</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              This tunes your timetable and notifications to your exact lectures.
            </Text>

            <View style={styles.chipsWrap}>
              {SECTIONS.map((sec) => (
                <Chip
                  key={sec}
                  label={`Section ${sec}`}
                  selected={selectedSec === sec}
                  onPress={() => setSelectedSec(sec)}
                  style={styles.choiceChip}
                />
              ))}
            </View>

            {/* Summary Card */}
            <GlassCard style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: colors.accent }]}>TARGET CLASS KEY</Text>
              <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                {selectedProg.code}-{selectedSem} {selectedSec}
              </Text>
              <Text style={[styles.summarySchool, { color: colors.textSecondary }]}>{selectedSchool} • {selectedProg.name}</Text>
            </GlassCard>

            <PillButton
              label="Complete Setup"
              onPress={handleFinish}
              variant="primary"
              size="md"
              style={styles.nextBtn}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    gap: 8,
    marginVertical: spacing.sm,
  },
  stepBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  stepBarActive: {},
  stepBarInactive: {},
  scrollContent: {
    padding: spacing.xl,
    flexGrow: 1,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    marginBottom: 6,
  },
  stepSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.xxl,
  },
  choiceChip: {
    marginRight: 10,
    marginBottom: 12,
  },
  summaryCard: {
    marginBottom: spacing.xl,
    padding: spacing.lg,
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    marginBottom: 2,
  },
  summarySchool: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
  },
  nextBtn: {
    marginTop: 'auto',
  },
});
