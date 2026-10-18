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
import { ArrowLeft, Check, BookOpen } from 'lucide-react-native';
import { Chip, PillButton, GlassCard } from '../src/components/ui';
import { useAuthStore, ClassSelection } from '../src/store/useAuthStore';
import { theme } from '../src/lib/theme';

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
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => (step > 1 ? setStep((s) => (s - 1) as any) : router.back())}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color={theme.colors.ivory} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Class Setup</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Step Indicator */}
      <View style={styles.stepIndicatorRow}>
        {[1, 2, 3, 4].map((s) => (
          <View
            key={`step-${s}`}
            style={[
              styles.stepBar,
              s <= step ? styles.stepBarActive : styles.stepBarInactive,
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Choose your School</Text>
            <Text style={styles.stepSubtitle}>
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
            <Text style={styles.stepTitle}>Select your Programme</Text>
            <Text style={styles.stepSubtitle}>
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
            <Text style={styles.stepTitle}>Select your Semester</Text>
            <Text style={styles.stepSubtitle}>
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
            <Text style={styles.stepTitle}>Select your Section / Batch</Text>
            <Text style={styles.stepSubtitle}>
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
              <Text style={styles.summaryLabel}>TARGET CLASS KEY</Text>
              <Text style={styles.summaryValue}>
                {selectedProg.code}-{selectedSem} {selectedSec}
              </Text>
              <Text style={styles.summarySchool}>{selectedSchool} • {selectedProg.name}</Text>
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
    backgroundColor: theme.colors.bg,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: theme.colors.ivory,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.xl,
    gap: 8,
    marginVertical: theme.spacing.sm,
  },
  stepBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  stepBarActive: {
    backgroundColor: theme.colors.accent,
  },
  stepBarInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  scrollContent: {
    padding: theme.spacing.xl,
    flexGrow: 1,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    color: theme.colors.ivory,
    marginBottom: 6,
  },
  stepSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
    lineHeight: 20,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.xxl,
  },
  choiceChip: {
    marginRight: 10,
    marginBottom: 12,
  },
  summaryCard: {
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: theme.colors.accent,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    color: theme.colors.ivory,
    marginBottom: 2,
  },
  summarySchool: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  nextBtn: {
    marginTop: 'auto',
  },
});
