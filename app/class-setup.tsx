import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, CheckCircle2, CloudOff } from 'lucide-react-native';
import { Chip, PillButton, GlassCard, Skeleton } from '../src/components/ui';
import { useAuthStore, ClassSelection } from '../src/store/useAuthStore';
import { useAppTheme } from '../src/lib/ThemeContext';
import { radius, spacing } from '../src/lib/theme';
import {
  buildSectionCode,
  fallbackProgrammes,
  fallbackSections,
  groupSectionsIntoProgrammes,
  normaliseYearLabel,
  parsePublishedSection,
  schoolProgrammesFor,
  schoolsOf,
  sectionLetterOf,
  sectionsForProgramme,
  yearLabelOf,
  yearsForProgramme,
  type CatalogueProgramme,
} from '../src/features/timetable/classCatalogue';
import {
  getAvailableClassesList,
  getCachedClassesList,
} from '../src/features/timetable/timetableStore';
import type { ClassRef } from '../src/features/timetable/timetableProvider';

type Step = 1 | 2 | 3 | 4;

/** Where the class list on screen came from. */
type CatalogueSource = 'live' | 'saved' | 'bundled';

const SOURCE_MESSAGES: Record<Exclude<CatalogueSource, 'live'>, string> = {
  saved: 'Showing the class list saved on this device - the live list could not be reached.',
  bundled: 'Showing the saved class list - the live list could not be reached.',
};

/** The class list the app ships with, used when the university is unreachable. */
function bundledClassList(): ClassRef[] {
  const codes = fallbackSections();
  return fallbackProgrammes().flatMap((programme) =>
    sectionsForProgramme(codes, programme.code).map((section) => ({
      school: programme.school,
      programme: programme.name,
      programmeCode: programme.apiCode,
      semester: section.year,
      section: section.section,
    })),
  );
}

/**
 * The label of every programme, with the published code added when two
 * programmes of the same school share a name.
 */
function programmeLabels(programmes: CatalogueProgramme[]): Record<string, string> {
  const nameCounts = new Map<string, number>();
  for (const programme of programmes) {
    nameCounts.set(programme.name, (nameCounts.get(programme.name) ?? 0) + 1);
  }

  const labels: Record<string, string> = {};
  for (const programme of programmes) {
    const shared = (nameCounts.get(programme.name) ?? 0) > 1;
    labels[programme.code] = shared
      ? `${programme.name} (${programme.code})`
      : programme.name;
  }
  return labels;
}

export default function ClassSetupScreen() {
  const { classSelection, setClassSelection } = useAuthStore();
  const { colors } = useAppTheme();

  const [step, setStep] = useState<Step>(1);
  const [classes, setClasses] = useState<ClassRef[]>([]);
  const [source, setSource] = useState<CatalogueSource | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedSchool, setSelectedSchool] = useState<string>(
    classSelection?.school ?? '',
  );
  const [selectedProgramme, setSelectedProgramme] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');

  const seeded = useRef(false);

  // The live list first, the saved one second, the bundled one last.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const saved = await getCachedClassesList();
      if (!cancelled && saved.length > 0) {
        setClasses(saved);
        setSource('saved');
      }

      try {
        const live = await getAvailableClassesList();
        if (cancelled) return;
        setClasses(live);
        setSource('live');
      } catch {
        if (cancelled) return;
        if (saved.length === 0) {
          setClasses(bundledClassList());
          setSource('bundled');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const codes = useMemo(() => classes.map((entry) => entry.section), [classes]);
  const programmes = useMemo(() => groupSectionsIntoProgrammes(classes), [classes]);
  const schools = useMemo(() => schoolsOf(programmes), [programmes]);

  const schoolProgrammes = useMemo(
    () => schoolProgrammesFor(programmes, selectedSchool),
    [programmes, selectedSchool],
  );

  const schoolLabels = useMemo(
    () => programmeLabels(schoolProgrammes),
    [schoolProgrammes],
  );

  const years = useMemo(
    () => yearsForProgramme(codes, selectedProgramme),
    [codes, selectedProgramme],
  );

  // Every class the university publishes for the chosen programme.
  const programmeSections = useMemo(
    () => sectionsForProgramme(codes, selectedProgramme),
    [codes, selectedProgramme],
  );

  // The published codes of the chosen year.
  const sections = useMemo(() => {
    const wanted = normaliseYearLabel(selectedYear);
    return programmeSections
      .filter((entry) => normaliseYearLabel(entry.year) === wanted)
      .map((entry) => entry.section);
  }, [programmeSections, selectedYear]);

  const currentProgramme: CatalogueProgramme | undefined = useMemo(
    () => programmes.find((programme) => programme.code === selectedProgramme),
    [programmes, selectedProgramme],
  );

  /** The published codes of one programme and year. */
  const publishedSectionsFor = useCallback(
    (programmeCode: string, year: string): string[] => {
      const wanted = normaliseYearLabel(year);
      return sectionsForProgramme(codes, programmeCode)
        .filter((entry) => normaliseYearLabel(entry.year) === wanted)
        .map((entry) => entry.section);
    },
    [codes],
  );

  // Seed the picker once the catalogue is known, keeping the saved class
  // when the university still publishes it.
  useEffect(() => {
    if (seeded.current || programmes.length === 0) return;
    seeded.current = true;

    const savedSection = classSelection?.section ?? '';
    const savedParts = parsePublishedSection(savedSection);
    const savedProgrammeCode = (classSelection?.programmeCode ?? '').toUpperCase();

    const match =
      programmes.find((programme) => programme.code === savedParts.programmeCode) ??
      programmes.find(
        (programme) => programme.apiCode.toUpperCase() === savedProgrammeCode,
      );
    const programme = match ?? programmes[0];

    const programmeYears = yearsForProgramme(codes, programme.code);
    const year = programmeYears.includes(savedParts.year)
      ? savedParts.year
      : programmeYears[0] ?? '';

    const programmeSections = publishedSectionsFor(programme.code, year);
    const section = programmeSections.includes(savedSection)
      ? savedSection
      : programmeSections[0] ?? '';

    setSelectedSchool(programme.school);
    setSelectedProgramme(programme.code);
    setSelectedYear(year);
    setSelectedSection(section);
  }, [programmes, codes, classSelection, publishedSectionsFor]);

  const chooseProgramme = useCallback(
    (code: string) => {
      const programmeYears = yearsForProgramme(codes, code);
      const year = programmeYears[0] ?? '';
      setSelectedProgramme(code);
      setSelectedYear(year);
      setSelectedSection(publishedSectionsFor(code, year)[0] ?? '');
    },
    [codes, publishedSectionsFor],
  );

  const chooseSchool = useCallback(
    (school: string) => {
      setSelectedSchool(school);
      const first = schoolProgrammesFor(programmes, school)[0];
      if (first) chooseProgramme(first.code);
    },
    [programmes, chooseProgramme],
  );

  const chooseYear = useCallback(
    (year: string) => {
      setSelectedYear(year);
      setSelectedSection(publishedSectionsFor(selectedProgramme, year)[0] ?? '');
    },
    [selectedProgramme, publishedSectionsFor],
  );

  // The stored code is the one the university publishes, never a guess.
  const storedSection = useMemo(() => {
    if (sections.includes(selectedSection)) return selectedSection;
    if (sections.length > 0) return sections[0];
    return buildSectionCode(
      selectedProgramme,
      selectedYear,
      sectionLetterOf(selectedSection),
      codes,
    );
  }, [sections, selectedSection, selectedProgramme, selectedYear, codes]);

  const handleFinish = () => {
    if (!storedSection) return;

    const programme =
      currentProgramme ??
      programmes.find((entry) => entry.code === selectedProgramme) ??
      fallbackProgrammes()[0];

    const selection: ClassSelection = {
      school: selectedSchool || programme.school,
      programme: programme.name,
      programmeCode: programme.apiCode,
      semester: selectedYear,
      section: storedSection,
    };

    setClassSelection(selection);
    router.replace('/(tabs)');
  };

  const renderLoading = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Loading classes</Text>
      <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        Fetching the classes the university is running right now.
      </Text>
      <Skeleton height={44} borderRadius={12} style={styles.skeleton} />
      <Skeleton height={44} borderRadius={12} style={styles.skeleton} />
      <Skeleton height={44} borderRadius={12} style={styles.skeleton} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => (step > 1 ? setStep(((step - 1) as Step)) : router.back())}
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
        {loading && programmes.length === 0 ? (
          renderLoading()
        ) : (
          <>
            {source && source !== 'live' && (
              <View style={[styles.notice, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}>
                <CloudOff size={16} color={colors.textSecondary} />
                <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                  {SOURCE_MESSAGES[source]}
                </Text>
              </View>
            )}

            {step === 1 && (
              <View style={styles.stepContainer}>
                <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Choose your School</Text>
                <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
                  Select the faculty / school your department belongs to at GBU.
                </Text>

                <View style={styles.chipsWrap}>
                  {schools.map((school) => (
                    <Chip
                      key={school}
                      label={school}
                      selected={selectedSchool === school}
                      onPress={() => chooseSchool(school)}
                      style={styles.choiceChip}
                    />
                  ))}
                </View>

                <PillButton
                  label="Continue to Programme"
                  onPress={() => setStep(2)}
                  variant="primary"
                  size="md"
                  disabled={!selectedSchool}
                  style={styles.nextBtn}
                />
              </View>
            )}

            {step === 2 && (
              <View style={styles.stepContainer}>
                <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Select your Programme</Text>
                <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
                  {schoolProgrammes.length > 0
                    ? `The ${selectedSchool} programmes the university is running.`
                    : 'No programme is running in this school right now.'}
                </Text>

                <View style={styles.chipsWrap}>
                  {schoolProgrammes.map((programme) => (
                    <Chip
                      key={programme.code}
                      label={schoolLabels[programme.code] ?? programme.name}
                      selected={selectedProgramme === programme.code}
                      onPress={() => chooseProgramme(programme.code)}
                      style={styles.choiceChip}
                    />
                  ))}
                </View>

                <PillButton
                  label="Continue to Year"
                  onPress={() => setStep(3)}
                  variant="primary"
                  size="md"
                  disabled={!selectedProgramme}
                  style={styles.nextBtn}
                />
              </View>
            )}

            {step === 3 && (
              <View style={styles.stepContainer}>
                <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Select your Year</Text>
                <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
                  Only the years that actually have classes for this programme are listed.
                </Text>

                <View style={styles.chipsWrap}>
                  {years.map((year) => (
                    <Chip
                      key={year}
                      label={`Year ${year} (${yearLabelOf(year)})`}
                      selected={selectedYear === year}
                      onPress={() => chooseYear(year)}
                      style={styles.choiceChip}
                    />
                  ))}
                </View>

                <PillButton
                  label="Continue to Section"
                  onPress={() => setStep(4)}
                  variant="primary"
                  size="md"
                  disabled={!selectedYear}
                  style={styles.nextBtn}
                />
              </View>
            )}

            {step === 4 && (
              <View style={styles.stepContainer}>
                <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Select your Section / Batch</Text>
                <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
                  {sections.length > 0
                    ? `${sections.length} class${sections.length === 1 ? '' : 'es'} running for Year ${selectedYear}.`
                    : 'The university publishes no class for this year yet.'}
                </Text>

                <View style={styles.chipsWrap}>
                  {sections.map((section) => (
                    <Chip
                      key={section}
                      label={section}
                      selected={storedSection === section}
                      onPress={() => setSelectedSection(section)}
                      style={styles.choiceChip}
                    />
                  ))}
                </View>

                {/* Summary Card: the exact code that gets stored. */}
                <GlassCard style={styles.summaryCard}>
                  <Text style={[styles.summaryLabel, { color: colors.accent }]}>CLASS CODE</Text>
                  <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                    {storedSection || '-'}
                  </Text>
                  <Text style={[styles.summarySchool, { color: colors.textSecondary }]}>
                    {selectedSchool} - {currentProgramme?.name ?? ''}
                  </Text>
                  <Text style={[styles.summarySchool, { color: colors.textSecondary }]}>
                    Year {selectedYear}
                    {currentProgramme ? ` (${yearLabelOf(selectedYear)})` : ''}
                    {storedSection && sectionLetterOf(storedSection) !== 'General'
                      ? ` - Section ${sectionLetterOf(storedSection)}`
                      : ''}
                  </Text>
                  <Text style={[styles.summaryHint, { color: colors.textSecondary }]}>
                    This is the code the university publishes for your class. It is what your
                    timetable is matched against.
                  </Text>
                  {storedSection && source === 'live' && (
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
                  disabled={!storedSection}
                  style={styles.nextBtn}
                />
              </View>
            )}
          </>
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
  skeleton: {
    marginBottom: 12,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  noticeText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
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
  summaryHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
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
