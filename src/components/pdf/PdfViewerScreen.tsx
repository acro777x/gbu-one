import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ThemeContext';
import { radius, spacing } from '../../lib/theme';
import { PdfViewer } from './PdfViewer';
import { hostOfUrl, isSafePdfUrl } from './pdfHelpers';

/**
 * GBU One — Full-screen route that hosts the document viewer.
 *
 * The route is `/pdf?url=<encoded>&title=<encoded>`. The URL is validated
 * before anything is fetched: only `http` and `https` are accepted, so a
 * crafted link cannot make the app read a local file or run a script.
 */
export const PdfViewerScreen: React.FC = () => {
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ url?: string; title?: string }>();

  const url = typeof params.url === 'string' ? params.url : '';
  const title = typeof params.title === 'string' ? params.title : '';

  const isSafe = useMemo(() => isSafePdfUrl(url), [url]);

  // The host is shown under the toolbar so the student knows where the
  // document really comes from.
  const source = useMemo(() => (isSafe ? hostOfUrl(url) : ''), [url, isSafe]);

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  if (!isSafe) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { borderBottomColor: colors.borderGlass }]}>
          <Pressable
            onPress={handleClose}
            hitSlop={16}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Document</Text>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.warning} />
          <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>
            This link cannot be opened
          </Text>
          <Text style={[styles.errorBody, { color: colors.textSecondary }]}>
            Only secure web links (http and https) can be shown here. Go back and open the notice
            again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.borderGlass }]}>
        <Pressable
          onPress={handleClose}
          hitSlop={16}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.headerText}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {title || 'Document'}
          </Text>
        </View>

        <View style={styles.iconButton} />
      </View>

      <PdfViewer url={url} onClose={handleClose} subtitle={source} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.sm,
  },
  headerTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  iconButton: {
    // 44dp so the back button meets the minimum touch target.
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  errorBody: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },
});

export default PdfViewerScreen;
