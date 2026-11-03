import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  DimensionValue,
  Dimensions,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AlertCircle, ChevronLeft, ChevronRight, X, Download, FileText, ExternalLink } from 'lucide-react-native';
import Pdf from 'react-native-pdf';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { useAppTheme } from '../../lib/ThemeContext';
import { radius, spacing } from '../../lib/theme';
import { PillButton } from '../ui/PillButton';
import {
  buildCacheFileName,
  describeDownloadProblem,
  isPdfErrorPage,
  isProbablyDoc,
  isProbablyImage,
  isProbablyPdf,
  isSafePdfUrl,
  looksLikeDocUrl,
  looksLikeImageUrl,
  looksLikePdfUrl,
  looksLikeSoft404,
  MIN_PDF_BYTES,
  PDF_MIME_TYPE,
} from './pdfHelpers';

export interface PdfViewerProps {
  url: string;
  onClose?: () => void;
  title?: string;
  /** Shown under the toolbar, e.g. the source name. */
  subtitle?: string;
}

/** How many leading bytes are inspected to recognise a PDF body. */
const HEAD_WINDOW = 2048;

/** The university server is slow on a good day; give it a generous budget. */
const DOWNLOAD_TIMEOUT_MS = 45000;

/**
 * Some university front-ends reject requests without a browser-ish user agent,
 * so one is sent with every download.
 */
const REQUEST_HEADERS: Record<string, string> = {
  Accept: 'application/pdf,application/octet-stream,*/*',
  'User-Agent': 'GBU One/1.0 (Android)',
};

type ViewerPhase =
  | { status: 'downloading'; progress: number }
  | { status: 'ready' }
  | { status: 'error'; message: string };

/** Removes a cached download, ignoring a file that is already gone. */
const removeCachedFile = async (path: string | null): Promise<void> => {
  if (!path) return;
  try {
    await ReactNativeBlobUtil.fs.unlink(path);
  } catch {
    // The file was never created or the OS already cleared the cache.
  }
};

/**
 * Reads the leading bytes and the size of a finished download.
 *
 * Only the head is read: the GBU error pages are small, but a real circular is
 * megabytes and decoding all of it as text would be wasteful. A file that
 * cannot be inspected at all is reported as an empty head, which the size
 * check below then rejects.
 */
const readDownloadFacts = async (
  path: string,
): Promise<{ head: string; size: number }> => {
  let size = 0;
  try {
    const stat = await ReactNativeBlobUtil.fs.stat(path);
    const reported = Number(stat.size);
    size = Number.isFinite(reported) ? reported : 0;
  } catch {
    return { head: '', size: 0 };
  }

  try {
    const raw: unknown = await ReactNativeBlobUtil.fs.readFile(path, 'ascii');
    if (typeof raw === 'string') {
      return { head: raw.slice(0, HEAD_WINDOW), size };
    }
  } catch {
    // Fallback to slice
  }

  const headPath = path + '.head';
  try {
    await ReactNativeBlobUtil.fs.slice(path, headPath, 0, HEAD_WINDOW);
    const raw: unknown = await ReactNativeBlobUtil.fs.readFile(headPath, 'ascii');
    return { head: typeof raw === 'string' ? raw : '', size };
  } catch {
    return { head: '', size };
  } finally {
    await removeCachedFile(headPath);
  }
};

/**
 * GBU One — In-app document viewer.
 *
 * The file is downloaded to the app cache first and only then rendered. That
 * order matters: the university portal answers with HTML error pages for
 * perfectly valid-looking links, and rendering one of those would leave the
 * student staring at a blank screen. See `pdfHelpers.ts` for the checks.
 */
export const PdfViewer: React.FC<PdfViewerProps> = ({ url, onClose, title, subtitle }) => {
  const { colors } = useAppTheme();

  const [phase, setPhase] = useState<ViewerPhase>({ status: 'downloading', progress: 0 });
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [isImageDoc, setIsImageDoc] = useState(false);
  const [isDocDoc, setIsDocDoc] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [handoffError, setHandoffError] = useState<string | null>(null);

  useEffect(() => {
    if (isImageDoc && fileUri) {
      Image.getSize(
        fileUri,
        (width, height) => setImageDimensions({ width, height }),
        () => setImageDimensions(null),
      );
    }
  }, [isImageDoc, fileUri]);

  // The cached file of the current run, so it can be deleted on unmount.
  const filePathRef = useRef<string | null>(null);
  // Guards every state update against a run that has already been replaced.
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  const startDownload = useCallback(async () => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const isCurrent = (): boolean => mountedRef.current && runIdRef.current === runId;

    setPhase({ status: 'downloading', progress: 0 });
    setHandoffError(null);
    setFileUri(null);
    setIsImageDoc(false);
    setIsDocDoc(false);
    setPage(1);
    setTotalPages(0);

    // A previous attempt may have left a half written file behind.
    await removeCachedFile(filePathRef.current);
    filePathRef.current = null;

    if (!isSafePdfUrl(url)) {
      setPhase({
        status: 'error',
        message: 'This link is not a valid document address, so nothing was downloaded.',
      });
      return;
    }

    // Every run gets its own file name, so a superseded run can never delete
    // the file the current one is still writing.
    const target = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${buildCacheFileName(url, runId)}`;

    try {
      const task = ReactNativeBlobUtil.config({
        path: target,
        overwrite: true,
        timeout: DOWNLOAD_TIMEOUT_MS,
      }).fetch('GET', url, REQUEST_HEADERS);

      task.progress({ interval: 250 }, (received, total) => {
        if (!isCurrent()) return;
        // The native module reports the byte counts as numbers on some
        // platforms and as strings on others, so they are coerced here.
        const totalBytes = Number(total);
        const ratio = totalBytes > 0 ? Number(received) / totalBytes : 0;
        const percent = Number.isFinite(ratio)
          ? Math.max(0, Math.min(99, Math.round(ratio * 100)))
          : 0;
        setPhase({ status: 'downloading', progress: percent });
      });

      const response = await task;
      const status = response.info().status;
      const { head, size } = await readDownloadFacts(target);

      if (!isCurrent()) {
        await removeCachedFile(target);
        return;
      }

      const isImg = looksLikeImageUrl(url) || isProbablyImage(head);
      const isDoc = looksLikeDocUrl(url) || isProbablyDoc(head);
      setIsImageDoc(isImg);
      setIsDocDoc(isDoc);

      if (isImg) {
        if (size < 100) {
          await removeCachedFile(target);
          setPhase({
            status: 'error',
            message: 'The image file could not be downloaded or was empty.',
          });
          return;
        }
      } else if (isDoc) {
        if (size < 100) {
          await removeCachedFile(target);
          setPhase({
            status: 'error',
            message: 'The Word document could not be downloaded or was empty.',
          });
          return;
        }
      } else {
        // A real document starts with the PDF magic and is big enough to be one.
        // Tolerates fs.slice issues if size is valid, URL is PDF, and not an error page.
        const validPdf =
          isProbablyPdf(head) ||
          (size >= MIN_PDF_BYTES && (looksLikePdfUrl(url) || !head) && !looksLikeSoft404(head) && !isPdfErrorPage(head));
        if (!validPdf || size < MIN_PDF_BYTES) {
          await removeCachedFile(target);
          setPhase({ status: 'error', message: describeDownloadProblem(status, head, size) });
          return;
        }
      }

      let finalTarget = target;
      if (isImg && !target.toLowerCase().endsWith('.jpg') && !target.toLowerCase().endsWith('.png') && !target.toLowerCase().endsWith('.jpeg')) {
        const ext = head.slice(0, 4).indexOf('PNG') !== -1 || (head.charCodeAt(0) === 0x89) ? '.png' : '.jpg';
        const imageTarget = `${target}${ext}`;
        try {
          await ReactNativeBlobUtil.fs.cp(target, imageTarget);
          await removeCachedFile(target);
          finalTarget = imageTarget;
        } catch {
          // keep original target if copy fails
        }
      }

      filePathRef.current = finalTarget;
      setFileUri(`file://${finalTarget}`);
      setPhase({ status: 'ready' });
    } catch {
      // The half written file of a superseded run is still ours to remove.
      await removeCachedFile(target);
      if (!isCurrent()) return;
      setPhase({
        status: 'error',
        message:
          'Could not reach the university server. Check your connection and try again — you can also open the original link in another app.',
      });
    }
  }, [url]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const path = filePathRef.current;
      filePathRef.current = null;
      void removeCachedFile(path);
    };
  }, []);

  useEffect(() => {
    void startDownload();
  }, [startDownload]);

  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  /**
   * Hands the document to the operating system: the native PDF reader on
   * Android, the browser on iOS, where a `file://` URL cannot be opened
   * directly.
   */
  const openExternally = useCallback(async () => {
    const path = filePathRef.current;
    try {
      if (path && Platform.OS === 'android') {
        let mime = PDF_MIME_TYPE;
        let prompt = 'Open document with';
        if (isImageDoc) {
          mime = 'image/*';
          prompt = 'Open image with';
        } else if (isDocDoc) {
          const isDocx = (path.toLowerCase() || url.toLowerCase()).endsWith('.docx');
          mime = isDocx
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : 'application/msword';
          prompt = 'Open Word document with';
        }
        const opened = await ReactNativeBlobUtil.android.actionViewIntent(
          path,
          mime,
          prompt,
        );
        if (opened === false || opened === null) {
          throw new Error('No application accepted the document.');
        }
        return;
      }
      await Linking.openURL(url);
    } catch {
      setHandoffError(
        'No app on this device could open the document. Try the original link on the university website instead.',
      );
    }
  }, [url, isImageDoc, isDocDoc]);

  /**
   * Saves the document directly to the student's device storage in DownloadDir
   * and registers it with Android DownloadManager.
   */
  const saveToDevice = useCallback(async () => {
    const path = filePathRef.current;
    if (!path) {
      void openExternally();
      return;
    }

    try {
      if (Platform.OS === 'android') {
        const safeName = (title || 'question-paper')
          .replace(/[/\\?%*:|"<>]/g, '_')
          .replace(/\s+/g, '_')
          .slice(0, 50);
        let ext = '.pdf';
        let mime = PDF_MIME_TYPE;
        if (isImageDoc) {
          ext = path.toLowerCase().endsWith('.png') ? '.png' : '.jpg';
          mime = ext === '.png' ? 'image/png' : 'image/jpeg';
        } else if (isDocDoc) {
          const isDocx = (path.toLowerCase() || url.toLowerCase()).endsWith('.docx');
          ext = isDocx ? '.docx' : '.doc';
          mime = isDocx
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : 'application/msword';
        }
        const targetFileName = `${safeName}${ext}`;

        let saved = false;
        // 1. Android MediaStore copy (Works on modern Android 10+ without storage permission)
        try {
          if (ReactNativeBlobUtil.MediaCollection?.copyToMediaStore) {
            await ReactNativeBlobUtil.MediaCollection.copyToMediaStore(
              { name: targetFileName, parentFolder: '', mimeType: mime },
              'Download',
              path,
            );
            saved = true;
          }
        } catch (mediaErr) {
          console.warn('copyToMediaStore fallback:', mediaErr);
        }

        // 2. Direct DownloadDir copy fallback
        if (!saved) {
          try {
            const downloadDir = ReactNativeBlobUtil.fs.dirs.DownloadDir;
            const destPath = `${downloadDir}/${targetFileName}`;
            await ReactNativeBlobUtil.fs.cp(path, destPath);
            try {
              await ReactNativeBlobUtil.android.addCompleteDownload({
                title: targetFileName,
                description: `${title || 'Question paper'} from GBU One`,
                mime,
                path: destPath,
                showNotification: true,
              });
            } catch {
              // ignore
            }
            saved = true;
          } catch (cpErr) {
            console.warn('DownloadDir cp fallback:', cpErr);
          }
        }

        setDownloadSuccessMessage(`Saved to Downloads/${targetFileName}`);
        return;
      }

      await openExternally();
    } catch (err) {
      console.warn('Failed to save to device downloads:', err);
      void openExternally();
    }
  }, [title, isImageDoc, isDocDoc, url, openExternally]);

  const goToPage = useCallback(
    (next: number) => {
      const last = totalPages > 0 ? totalPages : 1;
      setPage(Math.min(Math.max(1, next), last));
    },
    [totalPages],
  );

  const progressWidth: DimensionValue = `${Math.max(4, phase.status === 'downloading' ? phase.progress : 0)}%`;
  const canGoBack = page > 1;
  const canGoForward = totalPages > 0 && page < totalPages;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Toolbar */}
      <View style={[styles.toolbar, { borderBottomColor: colors.borderGlass }]}>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          disabled={!onClose}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Close the document"
        >
          <X size={20} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.toolbarText}>
          {title ? (
            <Text numberOfLines={1} style={[styles.toolbarTitle, { color: colors.textPrimary }]}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text numberOfLines={1} style={[styles.toolbarSubtitle, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {phase.status === 'ready' && (
          <Pressable
            onPress={() => void saveToDevice()}
            hitSlop={12}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Download and save to device"
          >
            <Download size={20} color={colors.textPrimary} />
          </Pressable>
        )}
      </View>

      {downloadSuccessMessage && (
        <View style={[styles.downloadToast, { backgroundColor: colors.accent }]}>
          <Text style={[styles.downloadToastText, { color: colors.onAccent }]}>
            ✓ {downloadSuccessMessage}
          </Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {phase.status === 'downloading' && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>
              Downloading the document
            </Text>
            <Text style={[styles.statusBody, { color: colors.textSecondary }]}>
              {phase.progress > 0
                ? `${phase.progress}% downloaded`
                : 'Contacting the university server…'}
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}>
              <View
                style={[styles.progressFill, { backgroundColor: colors.accentFill, width: progressWidth }]}
              />
            </View>
          </View>
        )}

        {phase.status === 'error' && (
          <View style={styles.center}>
            <AlertCircle size={44} color={colors.warning} />
            <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>
              This document could not be opened
            </Text>
            <Text style={[styles.statusBody, { color: colors.textSecondary }]}>{phase.message}</Text>

            <View style={styles.actionRow}>
              <PillButton
                label="Open in another app"
                onPress={() => void openExternally()}
                variant="primary"
                size="sm"
              />
              <PillButton
                label="Try again"
                onPress={() => void startDownload()}
                variant="outline"
                size="sm"
              />
            </View>

            {handoffError ? (
              <Text style={[styles.handoffError, { color: colors.danger }]}>{handoffError}</Text>
            ) : null}
          </View>
        )}

        {phase.status === 'ready' && fileUri ? (
          isImageDoc ? (
            <ScrollView
              style={styles.imageScroll}
              contentContainerStyle={styles.imageScrollContent}
              maximumZoomScale={4}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={true}
            >
              <Image
                source={{ uri: fileUri }}
                style={{
                  width: Dimensions.get('window').width,
                  height:
                    imageDimensions && imageDimensions.width > 0
                      ? Math.max(
                          500,
                          Math.round(
                            (Dimensions.get('window').width / imageDimensions.width) *
                              imageDimensions.height,
                          ),
                        )
                      : 700,
                }}
                resizeMode="contain"
              />
            </ScrollView>
          ) : isDocDoc ? (
            <View style={styles.docPreviewCard}>
              <View style={[styles.docIconWrapper, { backgroundColor: colors.accentSoft }]}>
                <FileText size={48} color={colors.accent} />
              </View>
              <Text style={[styles.docPreviewTitle, { color: colors.textPrimary }]}>
                {title || 'Microsoft Word Document'}
              </Text>
              <View style={[styles.docBadge, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.docBadgeText, { color: colors.accent }]}>
                  {url.toLowerCase().indexOf('.docx') !== -1 ? 'DOCX DOCUMENT' : 'DOC DOCUMENT'}
                </Text>
              </View>
              <Text style={[styles.docPreviewDesc, { color: colors.textSecondary }]}>
                This question paper is in Microsoft Word format. You can open and view it in Microsoft 365, Google Docs, WPS Office, or save it to your device Downloads folder.
              </Text>
              <View style={styles.docActionCol}>
                <PillButton
                  label="Open in Office / Word"
                  onPress={() => void openExternally()}
                  variant="primary"
                  size="md"
                  icon={<ExternalLink size={16} color={colors.onAccent} style={{ marginRight: 6 }} />}
                  style={{ width: '100%', marginBottom: 10 }}
                />
                <PillButton
                  label="Save to Downloads"
                  onPress={() => void saveToDevice()}
                  variant="outline"
                  size="md"
                  icon={<Download size={16} color={colors.textPrimary} style={{ marginRight: 6 }} />}
                  style={{ width: '100%' }}
                />
              </View>
            </View>
          ) : (
            <Pdf
              source={{ uri: fileUri }}
              style={styles.pdf}
              fitPolicy={0}
              onLoadComplete={(numberOfPages) => {
                setTotalPages(numberOfPages);
                setPage(1);
              }}
              onPageChanged={(currentPage, numberOfPages) => {
                setPage(currentPage);
                setTotalPages(numberOfPages);
              }}
              onError={() => {
                setPhase({
                  status: 'error',
                  message:
                    'The document could not be rendered on this device. Opening it in another app may still work.',
                });
              }}
            />
          )
        ) : null}
      </View>

      {/* Page controls */}
      {phase.status === 'ready' && !isImageDoc && !isDocDoc ? (
        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.borderGlass }]}>
          <Pressable
            onPress={() => goToPage(page - 1)}
            disabled={!canGoBack}
            hitSlop={8}
            style={({ pressed }) => [
              styles.pageButton,
              {
                backgroundColor: colors.surfaceAlt,
                opacity: !canGoBack ? 0.4 : pressed ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Previous page"
            accessibilityState={{ disabled: !canGoBack }}
          >
            <ChevronLeft size={18} color={colors.textPrimary} />
          </Pressable>

          <Text style={[styles.pageIndicator, { color: colors.textSecondary }]}>
            {totalPages > 0 ? `Page ${page} of ${totalPages}` : `Page ${page}`}
          </Text>

          <Pressable
            onPress={() => goToPage(page + 1)}
            disabled={!canGoForward}
            hitSlop={8}
            style={({ pressed }) => [
              styles.pageButton,
              {
                backgroundColor: colors.surfaceAlt,
                opacity: !canGoForward ? 0.4 : pressed ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Next page"
            accessibilityState={{ disabled: !canGoForward }}
          >
            <ChevronRight size={18} color={colors.textPrimary} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  iconButton: {
    // 44dp so the close button meets the minimum touch target.
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolbarText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  toolbarTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
  },
  toolbarSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  pdf: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  imageScroll: {
    flex: 1,
    backgroundColor: '#000000',
  },
  imageScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100%',
  },
  imageViewer: {
    width: '100%',
    height: 600,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  statusTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  statusBody: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  progressTrack: {
    width: 220,
    height: 6,
    borderRadius: radius.chip,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.chip,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  handoffError: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.md,
    maxWidth: 300,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  pageButton: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageIndicator: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    minWidth: 120,
    textAlign: 'center',
  },
  downloadToast: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadToastText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
  },
  docPreviewCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  docIconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  docPreviewTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  docBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.chip,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  docBadgeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  docPreviewDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacing.xl,
  },
  docActionCol: {
    width: '100%',
    maxWidth: 280,
  },
});

export default PdfViewer;
