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
import { theme } from '../src/lib/theme';

export default function LoginScreen() {
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
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Top Header */}
        <View style={styles.header}>
          <LogoMark size={64} />
          <View style={styles.wordmarkRow}>
            <Text style={styles.brandGBU}>GBU </Text>
            <Text style={styles.brandOne}>One</Text>
          </View>
          <Text style={styles.subtitle}>Sign in to your GBU One account</Text>
        </View>

        {/* Input Card */}
        <View style={styles.card}>
          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Roll Number Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Roll Number / Enrollment No.</Text>
            <View style={styles.inputContainer}>
              <User size={18} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                value={rollNo}
                onChangeText={(text) => {
                  setRollNo(text);
                  setErrorMessage(null);
                }}
                placeholder="e.g. 22/BCS/048"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.textInput}
              />
            </View>
          </View>

          {/* Password Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>App Password</Text>
            <View style={styles.inputContainer}>
              <Lock size={18} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrorMessage(null);
                }}
                placeholder="Enter password"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                secureTextEntry={!showPassword}
                style={styles.textInput}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={8}
                style={styles.eyeBtn}
              >
                {showPassword ? (
                  <EyeOff size={18} color={theme.colors.textSecondary} />
                ) : (
                  <Eye size={18} color={theme.colors.textSecondary} />
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
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Continue as Guest Button */}
          <PillButton
            label="Continue as guest"
            onPress={handleGuest}
            variant="dark"
            size="md"
            style={styles.guestBtn}
          />
        </View>

        {/* Footer Note */}
        <View style={styles.footer}>
          <Text style={styles.securityNote}>
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
    backgroundColor: theme.colors.bg,
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
    color: theme.colors.ivory,
  },
  brandOne: {
    fontFamily: 'Poppins-Bold',
    fontSize: 26,
    color: theme.colors.accent,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#161618',
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    padding: theme.spacing.xl,
  },
  errorBox: {
    backgroundColor: 'rgba(255, 92, 92, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 92, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: theme.colors.danger,
    textAlign: 'center',
  },
  fieldGroup: {
    marginBottom: theme.spacing.lg,
  },
  fieldLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F11',
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: theme.colors.ivory,
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dividerText: {
    paddingHorizontal: 12,
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  guestBtn: {
    backgroundColor: '#202024',
  },
  footer: {
    marginTop: theme.spacing.xxl,
    alignItems: 'center',
  },
  securityNote: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.35)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300,
  },
});
