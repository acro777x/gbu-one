import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Eye, EyeOff, User, Lock } from 'lucide-react-native';
import { LogoMark } from '../src/components/brand/LogoMark';
import { OfficialSeal } from '../src/components/brand/OfficialSeal';
import { PillButton } from '../src/components/ui/PillButton';
import { useAuthStore } from '../src/store/useAuthStore';
import { useAppTheme } from '../src/lib/ThemeContext';
import { theme } from '../src/lib/theme';

export default function LoginScreen() {
  const { colors, isDark } = useAppTheme();
  const [rollNo, setRollNo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { login, loginAsGuest } = useAuthStore();

  const handleLogin = async () => {
    setErrorMessage(null);
    setLoading(true);

    const result = await login(rollNo, password);
    setLoading(false);

    if (result.success) {
      router.replace('/(tabs)');
    } else {
      setErrorMessage(result.error || "That roll number or password doesn't match.");
    }
  };

  const handleGuest = () => {
    loginAsGuest();
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.bg }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Top Header */}
        <View style={styles.header}>
          <LogoMark size={64} variant={isDark ? 'dark' : 'light'} />
          <View style={styles.wordmarkRow}>
            <Text style={[styles.brandGBU, { color: colors.textPrimary }]}>GBU </Text>
            <Text style={[styles.brandOne, { color: colors.accent }]}>One</Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Sign in to your GBU One account
          </Text>
        </View>

        {/* Input Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderGlass }]}>
          {errorMessage && (
            <View style={[styles.errorBox, { backgroundColor: colors.dangerSoft, borderColor: `${colors.danger}40` }]}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
            </View>
          )}

          {/* Roll Number Field */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Roll Number / Enrollment No.
            </Text>
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.borderGlass,
                },
              ]}
            >
              <User size={18} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                value={rollNo}
                onChangeText={(text) => {
                  setRollNo(text);
                  setErrorMessage(null);
                }}
                placeholder="e.g. 22/BCS/048"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                style={[styles.textInput, { color: colors.textPrimary }]}
              />
            </View>
          </View>

          {/* Password Field */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              App Password
            </Text>
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.borderGlass,
                },
              ]}
            >
              <Lock size={18} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrorMessage(null);
                }}
                placeholder="Enter password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry={!showPassword}
                style={[styles.textInput, { color: colors.textPrimary }]}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={8}
                style={styles.eyeBtn}
              >
                {showPassword ? (
                  <EyeOff size={18} color={colors.textSecondary} />
                ) : (
                  <Eye size={18} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Login Button */}
          <PillButton
            label="Log in"
            onPress={handleLogin}
            loading={loading}
            variant="primary"
            size="md"
            style={styles.loginBtn}
          />

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderGlass }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderGlass }]} />
          </View>

          {/* Continue as Guest Button */}
          <PillButton
            label="Continue as guest"
            onPress={handleGuest}
            variant={isDark ? 'dark' : 'white'}
            size="md"
            style={styles.guestBtn}
          />
        </View>

        {/* Footer Note */}
        <View style={styles.footer}>
          <Text style={[styles.securityNote, { color: colors.textTertiary }]}>
            Security notice: We never ask for, collect, or store your official university portal password.
          </Text>
          <OfficialSeal />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  brandGBU: {
    fontFamily: 'Poppins-Bold',
    fontSize: 26,
  },
  brandOne: {
    fontFamily: 'Poppins-Bold',
    fontSize: 26,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    borderRadius: theme.radius.card,
    borderWidth: 1,
    padding: theme.spacing.xl,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    textAlign: 'center',
  },
  fieldGroup: {
    marginBottom: theme.spacing.lg,
  },
  fieldLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  loginBtn: {
    marginTop: theme.spacing.sm,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  guestBtn: {},
  footer: {
    marginTop: theme.spacing.xxl,
    alignItems: 'center',
  },
  securityNote: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300,
  },
});
