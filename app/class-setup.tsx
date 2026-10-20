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
import { ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { Chip, PillButton, GlassCard } from '../src/components/ui';
import { useAuthStore, ClassSelection } from '../src/store/useAuthStore';
import { useAppTheme } from '../src/lib/ThemeContext';
import { spacing } from '../src/lib/theme';
import { parseGBUClassCode } from '../src/features/timetable/timetableProvider';

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
    { name: "B.Tech. (Artificial Intelligence)", code: "BAI" },
    { name: "B.C.A.", code: "BCA" },
    { name: "B.Tech (CS)", code: "BCS" },
    { name: "B.Tech (EC)", code: "BEC" },
    { name: "B.Tech ECE AI&ML", code: "BEC-AIML" },
    { name: "B.Tech (IT)", code: "BIT" },
    { name: "B.Tech. CSE Cyber Security", code: "CSE-Cyber" },
    { name: "B.Tech. CSE Data Science", code: "CSE-DS" },
    { name: "B.Tech. CSE Machine Learning", code: "CSE-ML" },
    { name: "B.Tech.-M.Tech. (EC)", code: "EC" },
    { name: "B.Tech.-M.Tech. (CS)", code: "ICS" },
    { name: "MCA", code: "MCA" },
    { name: "M.Tech. (DS)", code: "MDS" },
    { name: "M.Tech. (AIR)", code: "MTA" },
    { name: "M.Tech. (SE)", code: "MTS" },
    { name: "M.Tech (CSE) Weekend", code: "PCW" },
    { name: "Ph.D. Computer Science and Engineering", code: "PhDCS" },
    { name: "B.Tech. EC VLSI", code: "PVD" },
  ],
  SOE: [
    { name: "B.Tech (ME)", code: "BEE" },
    { name: "B.Tech (ME)", code: "BME" },
    { name: "B.Tech.+M.Tech./M.B.A. (EE)", code: "EE" },
    { name: "M.Tech (Power System)", code: "MTP" },
    { name: "B.Tech. (Electrical and Computer Engineering)", code: "UEL" },
    { name: "B.Tech. (Robotics and Artificial Intelligence)", code: "URA" },
  ],
  SOM: [
    { name: "B.Com. (Hons)", code: "BCOM" },
    { name: "MBA", code: "MBA" },
  ],
  SOBT: [
    { name: "Int. B.Tech.+M.Tech./M.B.A.-Biotech.", code: "BT" },
    { name: "BSc MSc Ayurveda Biology", code: "IBTAB" },
    { name: "M.Sc. Biotechnology", code: "MBT" },
    { name: "MSc Biotechnology (1Yr)", code: "MBTR" },
    { name: "MSc-Life Sciences", code: "MSLS" },
    { name: "MSc Microbiology", code: "MSMB" },
    { name: "M. Tech. (Biotechnology)", code: "MTB" },
    { name: "MSc. Nuclear Medicine Technology", code: "NMT" },
    { name: "Ph.D. Biotechnology", code: "PhDBT" },
    { name: "B.Sc. (H) in Biotechnology with Research", code: "UBT" },
    { name: "B.Sc. Forensic Science", code: "UFS" },
  ],
  SOHSS: [
    { name: "B.A. (H) Economics", code: "BAEC" },
    { name: "M.A. (English)", code: "MEN" },
    { name: "B. Sc. Applied Psychology", code: "UHB" },
  ],
  SOVSAS: [
    { name: "B.Tech. (Food Processing Technology)", code: "BEE" },
    { name: "B.Sc. (H) Chemistry", code: "BHC" },
    { name: "B.Sc. (H) Mathematics", code: "BHM" },
    { name: "B.Sc. (H) Physics", code: "BHP" },
    { name: "M.Sc. (Applied Chemistry)", code: "MAC" },
    { name: "M.Sc. (Applied Mathematics)", code: "MAM" },
    { name: "M.Sc. (Applied Physics)", code: "MAP" },
    { name: "M.Sc. (Environmental Science)", code: "MES" },
    { name: "M.Sc. (Food Science)", code: "MFS" },
    { name: "M.Sc. in Operations Research and Computer Applications", code: "MOR" },
    { name: "M.Tech. (Food Technology)", code: "MTF" },
    { name: "Ph.D. Applied  Mathematics", code: "PHD-MATHS" },
    { name: "B.Sc. Environment Science", code: "UES" },
    { name: "B.Tech. (Food Processing Technology)", code: "UFT" },
    { name: "B.Sc. (H) (Mathematics, Statistics, Economics)", code: "UHS" },
    { name: "B.Tech. (Mathematics and Comuting)", code: "UMC" },
  ],
};

const SECTIONS_BY_PROGRAMME: Record<string, string[]> = {
  "BAEC": ["BAEC-I", "BAEC-III"],
  "BAI": ["BAI-I-A", "BAI-I-B", "BAI-II", "BAI-II-B", "BAI-III", "BAI-III-B", "BAI-IV"],
  "BCA": ["BCA-I A", "BCA-II-A", "BCA-II-B", "BCA-III"],
  "BCOM": ["BCOM-I-A", "BCOM-I-B", "BCOM-I-C"],
  "BCS": ["BCS-I-A", "BCS-I-B", "BCS-I-C", "BCS-II A", "BCS-II B", "BCS-II C", "BCS-II D", "BCS-III-A", "BCS-III-B", "BCS-III-C", "BCS-III-D", "BCS-IV-A", "BCS-IV-B"],
  "BEC": ["BEC-I", "BEC-II", "BEC-III", "BEC-IV-A"],
  "BEC-AIML": ["BEC-AI-III", "BEC-AI-IV"],
  "BEE": ["BCE-I", "BEE-I", "BEE-II", "BEE-III", "BEE-IV", "BME-I", "UFT-I"],
  "BHC": ["BHC-I", "BHC-II", "BHC-III", "BHC-IV"],
  "BHM": ["BHM-I", "BHM-II", "BHM-III", "BHM-IV"],
  "BHP": ["BHP-I", "BHP-II", "BHP-III", "BHP-IV"],
  "BIT": ["BIT-I", "BIT-II", "BIT-III", "BIT-IV"],
  "BME": ["BME-II", "BME-III", "BME-IV"],
  "BT": ["BT-I", "BT-II", "BT-III", "BT-IV", "BT-V"],
  "CSE-Cyber": ["CSE-CS-I", "CSE-CS-II", "CSE-CS-III", "CSE-CS-IV"],
  "CSE-DS": ["CSE-DS-I", "CSE-DS-II", "CSE-DS-III", "CSE-DS-IV"],
  "CSE-ML": ["CSE-ML-III", "CSE-ML-IV"],
  "EC": ["IEC-IX"],
  "EE": ["EE-IV"],
  "IBTAB": ["IAY-I", "IAYBS-II"],
  "ICS": ["CS-I-A", "CS-II-A", "CS-III-A", "CS-IV-A"],
  "MAC": ["MAC-I", "MAC-II"],
  "MAM": ["MAM-I", "MAM-II"],
  "MAP": ["MAP-I", "MAP-II"],
  "MBA": ["MBA II", "MBA-I-A"],
  "MBT": ["MBT-I", "MBT-II"],
  "MBTR": ["MBT1-I"],
  "MCA": ["MCA-AI-I", "MCA-AI-II", "MCA-DS-I", "MCA-DS-II"],
  "MDS": ["MT-DS-I", "MT-DS-II"],
  "MEN": ["MEN-I", "MEN-II"],
  "MES": ["MES-I", "MES-II"],
  "MFS": ["MFS-I", "MFS-II"],
  "MOR": ["MOR-I"],
  "MSLS": ["MLFS-I", "MLFS-II"],
  "MSMB": ["MSMB-I", "MSMB-II"],
  "MTA": ["MT-AIR-I", "MT-AIR-II-A"],
  "MTB": ["MTB2-I", "MTB2-II"],
  "MTF": ["MTF-I", "MTF-II"],
  "MTP": ["MTP-I", "MTP-II"],
  "MTS": ["MT-SE-I", "MT-SE-II"],
  "NMT": ["NMT-I"],
  "PCW": ["PCW-II"],
  "PHD-MATHS": ["DAM-I"],
  "PVD": ["UVL-III"],
  "PhDBT": ["Ph.D. Biotechnology"],
  "PhDCS": ["PhDCS-I"],
  "UBT": ["UBT-I-A", "UBT-I-B", "UBT-II", "UBT-III", "UBT-IV"],
  "UEL": ["UEL-II", "UEL-III", "UEL-IV"],
  "UES": ["UES-I", "UES-II", "UES-III"],
  "UFS": ["UFS-I", "UFS-II", "UFS-III"],
  "UFT": ["UFT-I", "UFT-II", "UFT-III", "UFT-IV"],
  "UHB": ["UHB-I"],
  "UHS": ["UHS-I", "UHS-II"],
  "UMC": ["UMC-I", "UMC-II"],
  "URA": ["URA-II", "URA-III"],
};

const SEMESTERS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

const ROMAN_TO_YEAR: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8,
};

/** Real SectionNames for a programme (from the live Samay API catalogue). */
function sectionsForProgramme(code: string): string[] {
  return SECTIONS_BY_PROGRAMME[code] ?? SECTIONS_BY_PROGRAMME[code.toUpperCase()] ?? [];
}

/** Distinct year-romans present for a programme, in order. */
function yearsForProgramme(code: string): string[] {
  const out: string[] = [];
  for (const sec of sectionsForProgramme(code)) {
    const parsed = parseGBUClassCode(sec);
    if (parsed.semesterRoman && !out.includes(parsed.semesterRoman)) out.push(parsed.semesterRoman);
  }
  return out.sort((a, b) => (ROMAN_TO_YEAR[a] ?? 99) - (ROMAN_TO_YEAR[b] ?? 99));
}

/** Real sections for a programme + year (exact SectionName strings). */
function sectionsForYear(code: string, yearRoman: string): string[] {
  return sectionsForProgramme(code).filter(
    (sec) => parseGBUClassCode(sec).semesterRoman === yearRoman
  );
}

export default function ClassSetupScreen() {
  const { classSelection, setClassSelection } = useAuthStore();
  const { colors } = useAppTheme();

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

  // Data-driven options: only years/sections that really exist in the API.
  const availableYears = yearsForProgramme(selectedProg.code);
  const effectiveYear = availableYears.includes(selectedSem)
    ? selectedSem
    : availableYears[0] ?? selectedSem;
  const availableSections = sectionsForYear(selectedProg.code, effectiveYear);
  const effectiveSection = availableSections.includes(selectedSec)
    ? selectedSec
    : availableSections[0] ?? selectedSec;

  const handleFinish = () => {
    const selection: ClassSelection = {
      school: selectedSchool,
      programme: selectedProg.name,
      programmeCode: selectedProg.code,
      semester: effectiveYear,
      section: effectiveSection,
    };

    setClassSelection(selection);
    router.replace('/(tabs)');
  };

  const previewParse = parseGBUClassCode(effectiveSection);

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
              {(availableYears.length > 0 ? availableYears : SEMESTERS).map((sem) => (
                <Chip
                  key={sem}
                  label={
                    sem === effectiveYear && previewParse.yearLabel !== 'Year ?'
                      ? `Year ${sem} (${previewParse.yearLabel})`
                      : `Year ${sem}`
                  }
                  selected={effectiveYear === sem}
                  onPress={() => {
                    setSelectedSem(sem);
                    const first = sectionsForYear(selectedProg.code, sem)[0];
                    if (first) setSelectedSec(first);
                  }}
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
              {availableSections.length > 0
                ? ` ${availableSections.length} real section${availableSections.length === 1 ? '' : 's'} found for Year ${effectiveYear}.`
                : ' Pick the closest match — you can change it later.'}
            </Text>

            <View style={styles.chipsWrap}>
              {(availableSections.length > 0 ? availableSections : ['A', 'B', 'C', 'General']).map((sec) => (
                <Chip
                  key={sec}
                  label={availableSections.length > 0 ? sec : `Section ${sec}`}
                  selected={effectiveSection === sec}
                  onPress={() => setSelectedSec(sec)}
                  style={styles.choiceChip}
                />
              ))}
            </View>

            {/* Summary Card */}
            <GlassCard style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: colors.accent }]}>TARGET CLASS KEY</Text>
              <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                {effectiveSection}
              </Text>
              <Text style={[styles.summarySchool, { color: colors.textSecondary }]}>{selectedSchool} • {selectedProg.name}</Text>
              <Text style={[styles.summarySchool, { color: colors.textSecondary }]}>
                {previewParse.displayName}
              </Text>
              {effectiveSection && (
                <View style={[styles.verifiedRow, { borderColor: colors.borderGlass }]}>
                  <CheckCircle2 size={14} color={colors.accent} />
                  <Text style={[styles.verifiedText, { color: colors.accent }]}>
                    Matches the official timetable
                  </Text>
                </View>
              )}
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
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  verifiedText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  nextBtn: {
    marginTop: 'auto',
  },
});
