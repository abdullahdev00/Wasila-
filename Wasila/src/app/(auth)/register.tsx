import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';
import { Typography } from '../../components/ui/Typography';
import { Button } from '../../components/ui/Button';
import { UserRole } from '../../store/useAuthStore';
import { auth, db } from '../../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRoleState] = useState<UserRole>('customer');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { signIn: googleSignIn, loading: googleLoading } = useGoogleAuth();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update Firebase Profile
      await updateProfile(user, { displayName: name });

      // Save to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name,
        email,
        role,
        createdAt: new Date().toISOString(),
      });

      // Navigation handled by root layout listener
    } catch (error: any) {
      console.error(error);
      Alert.alert('Registration Failed', error.message || 'Something went wrong');
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
            <Typography variant="h1" weight="bold">Create Account</Typography>
            <Typography variant="body" color="muted">Join Wasila to get services effortlessly</Typography>
          </View>

          <View style={styles.form}>
            {/* Role Selector */}
            <View style={[styles.roleContainer, (loading || googleLoading) && { opacity: 0.6 }]}>
              <TouchableOpacity 
                style={[styles.roleBtn, role === 'customer' && styles.roleBtnActive]} 
                onPress={() => !loading && !googleLoading && setRoleState('customer')}
                disabled={loading || googleLoading}
              >
                <Ionicons name="person-outline" size={20} color={role === 'customer' ? '#FFF' : THEME.colors.textMuted} />
                <Typography variant="caption" weight="bold" style={{ color: role === 'customer' ? '#FFF' : THEME.colors.textMuted, marginLeft: 8 }}>
                  Customer
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.roleBtn, role === 'provider' && styles.roleBtnActive]} 
                onPress={() => !loading && !googleLoading && setRoleState('provider')}
                disabled={loading || googleLoading}
              >
                <Ionicons name="briefcase-outline" size={20} color={role === 'provider' ? '#FFF' : THEME.colors.textMuted} />
                <Typography variant="caption" weight="bold" style={{ color: role === 'provider' ? '#FFF' : THEME.colors.textMuted, marginLeft: 8 }}>
                  Provider
                </Typography>
              </TouchableOpacity>
            </View>

            <View style={[styles.inputWrapper, (loading || googleLoading) && styles.disabledInput]}>
              <Ionicons name="person-outline" size={20} color={THEME.colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
                editable={!loading && !googleLoading}
              />
            </View>

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

            <Button 
              label="Create Account" 
              onPress={handleRegister}
              customStyle={styles.registerBtn}
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
            <Typography variant="body" color="muted">Already have an account? </Typography>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Typography variant="body" color="primary" weight="bold">Sign In</Typography>
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
    paddingTop: THEME.spacing.xxxl,
  },
  header: {
    marginBottom: THEME.spacing.xxl,
  },
  form: {
    width: '100%',
  },
  roleContainer: {
    flexDirection: 'row',
    marginBottom: THEME.spacing.xl,
    backgroundColor: THEME.colors.surface,
    padding: 4,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 44,
    borderRadius: THEME.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleBtnActive: {
    backgroundColor: THEME.colors.primary,
    ...THEME.shadows.sm,
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
  registerBtn: {
    height: 56,
    borderRadius: THEME.radius.lg,
    marginTop: THEME.spacing.lg,
    ...THEME.shadows.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: THEME.spacing.xxl,
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
  disabledInput: {
    opacity: 0.6,
    backgroundColor: '#F1F5F9',
  }
});
