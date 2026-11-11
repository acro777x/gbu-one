/**
 * GBU One — the error boundary.
 *
 * Two defects are fixed here:
 *
 * 1. "Try Again" used to be a no-op loop: it cleared `hasError`, the same
 *    children re-rendered, the same error threw and
 *    `getDerivedStateFromError` put the boundary straight back into the
 *    error state. The subtree is now remounted with a fresh key, so the
 *    retry is a real attempt.
 *
 * 2. The fallback used to hard-code the LIGHT palette, which produced a
 *    white flash in dark mode. A class component cannot call a hook, so
 *    the themed wrapper below reads the palette and passes it in.
 */
import React, { Component, ErrorInfo, ReactNode, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAppTheme } from '../../lib/ThemeContext';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export interface ErrorBoundaryPalette {
  background: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  errorSurface: string;
  errorText: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  secondaryText: string;
  iconCircle: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  /** Bumped on every retry: it remounts the children. */
  resetKey: number;
}

interface BaseProps extends ErrorBoundaryProps {
  palette: ErrorBoundaryPalette;
  styles: ReturnType<typeof makeStyles>;
}

export class ErrorBoundaryBase extends Component<BaseProps, State> {
  constructor(props: BaseProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      resetKey: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  /**
   * A real reset: the subtree is remounted with a new key, so the children
   * are built from scratch instead of being re-rendered in place.
   */
  handleReset = (): void => {
    this.setState((state) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      resetKey: state.resetKey + 1,
    }));
  };

  handleGoHome = (): void => {
    this.handleReset();
    try {
      router.replace('/(tabs)');
    } catch {
      // ignore
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { palette, styles } = this.props;
      const errorMessage = this.state.error?.message || 'An unexpected error occurred.';

      return (
        <View style={[styles.container, { backgroundColor: palette.background }]}>
          <View
            style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <View style={[styles.iconCircle, { backgroundColor: palette.iconCircle }]}>
              <AlertTriangle size={32} color="#EF4444" />
            </View>

            <Text style={[styles.title, { color: palette.text }]}>Oops! Something went wrong</Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>
              GBU One encountered an issue on this screen. Your offline data is safe.
            </Text>

            <ScrollView
              style={[styles.errorBox, { backgroundColor: palette.errorSurface, borderColor: palette.border }]}
              contentContainerStyle={styles.errorBoxContent}
            >
              <Text style={[styles.errorText, { color: palette.errorText }]} numberOfLines={4}>
                {errorMessage}
              </Text>
            </ScrollView>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: palette.primary }]}
                onPress={this.handleReset}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Try again"
              >
                <RefreshCw size={16} color={palette.onPrimary} style={{ marginRight: 6 }} />
                <Text style={[styles.primaryButtonText, { color: palette.onPrimary }]}>Try Again</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: palette.secondary }]}
                onPress={this.handleGoHome}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Go to the home screen"
              >
                <Home size={16} color={palette.secondaryText} style={{ marginRight: 6 }} />
                <Text style={[styles.secondaryButtonText, { color: palette.secondaryText }]}>
                  Go to Home
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    // The key remounts the subtree on every retry.
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

const makeStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 4,
      borderWidth: 1,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 20,
      fontFamily: 'Poppins-Bold',
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 13,
      fontFamily: 'Inter-Regular',
      textAlign: 'center',
      lineHeight: 19,
      marginBottom: 16,
    },
    errorBox: {
      maxHeight: 100,
      width: '100%',
      borderRadius: 10,
      borderWidth: 1,
      marginBottom: 20,
    },
    errorBoxContent: {
      padding: 10,
    },
    errorText: {
      fontSize: 11,
      fontFamily: 'Courier',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
    },
    button: {
      flex: 1,
      flexDirection: 'row',
      height: 44,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    primaryButtonText: {
      fontSize: 13,
      fontFamily: 'Inter-SemiBold',
      fontWeight: '600',
    },
    secondaryButtonText: {
      fontSize: 13,
      fontFamily: 'Inter-SemiBold',
      fontWeight: '600',
    },
  });

/**
 * The themed boundary. It reads the palette with the hook and hands it to
 * the class, which cannot use hooks itself.
 */
export const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children, fallback }) => {
  const { colors } = useAppTheme();

  const palette = useMemo<ErrorBoundaryPalette>(
    () => ({
      background: colors.bg,
      card: colors.surface,
      text: colors.textPrimary,
      muted: colors.textSecondary,
      border: colors.borderGlass,
      errorSurface: colors.surfaceAlt,
      errorText: colors.danger,
      primary: colors.accentFill,
      onPrimary: colors.onAccent,
      secondary: colors.surfaceAlt,
      secondaryText: colors.textPrimary,
      iconCircle: colors.dangerSoft,
    }),
    [colors],
  );

  const styles = useMemo(() => makeStyles(), []);

  return (
    <ErrorBoundaryBase palette={palette} styles={styles} fallback={fallback}>
      {children}
    </ErrorBoundaryBase>
  );
};

export default ErrorBoundary;
