import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';
import { Typography } from '../../components/ui/Typography';
import { Button } from '../../components/ui/Button';
import { auth } from '../../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { signIn: googleSignIn, loading: googleLoading } = useGoogleAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Root layout will handle navigation via onAuthStateChanged
    } catch (error: any) {
      console.error(error);
      Alert.alert('Login Failed', error.message || 'Check your credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#F8FAFC', '#EFF6FF']} style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="sparkles" size={40} color={THEME.colors.primary} />
            </View>
            <Typography variant="h1" weight="bold" style={{ marginTop: THEME.spacing.lg }}>
              Welcome Back
            </Typography>
            <Typography variant="body" color="muted">
              Sign in to continue using Wasila
            </Typography>
          </View>

          <View style={styles.form}>
            <View style={[styles.inputWrapper, (loading || googleLoading) && styles.disabledInput]}>
              <Ionicons name="mail-outline" size={20} color={THEME.colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading && !googleLoading}
              />
            </View>

            <View style={[styles.inputWrapper, (loading || googleLoading) && styles.disabledInput]}>
              <Ionicons name="lock-closed-outline" size={20} color={THEME.colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading && !googleLoading}
              />
            </View>

            <TouchableOpacity style={styles.forgotPass}>
              <Typography variant="caption" color="primary" weight="bold">Forgot Password?</Typography>
            </TouchableOpacity>

            <Button 
              label="Sign In" 
              onPress={handleLogin}
              customStyle={styles.loginBtn}
              isLoading={loading}
            />

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Typography variant="caption" color="muted" style={{ marginHorizontal: 10 }}>OR</Typography>
              <View style={styles.divider} />
            </View>

            <Button
              label="Continue with Google"
              variant="outline"
              onPress={() => googleSignIn()}
              isLoading={googleLoading}
              disabled={loading}
              leftIcon={<Ionicons name="logo-google" size={20} color="#EA4335" />}
              customStyle={styles.googleBtn}
            />
          </View>

          <View style={styles.footer}>
            <Typography variant="body" color="muted">Don't have an account? </Typography>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Typography variant="body" color="primary" weight="bold">Sign Up</Typography>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: THEME.spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: THEME.spacing.xxl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: THEME.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.md,
  },
  form: {
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    marginBottom: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.md,
    height: 56,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  inputIcon: {
    marginRight: THEME.spacing.sm,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: THEME.fonts.regular,
    fontSize: 16,
    color: THEME.colors.textMain,
  },
  forgotPass: {
    alignSelf: 'flex-end',
    marginBottom: THEME.spacing.lg,
  },
  loginBtn: {
    height: 56,
    borderRadius: THEME.radius.lg,
    ...THEME.shadows.md,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: THEME.spacing.xl,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.colors.border,
  },
  googleBtn: {
    flexDirection: 'row',
    height: 56,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: THEME.spacing.xxl,
  },
  disabledInput: {
    opacity: 0.6,
    backgroundColor: '#F1F5F9',
  }
});
