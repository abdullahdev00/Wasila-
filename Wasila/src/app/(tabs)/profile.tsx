import React from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME } from '../../theme';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/useAuthStore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function ProfileScreen() {
  const { user, updateUser } = useAuthStore();

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error) {
              Alert.alert('Error', 'Failed to logout');
            }
          }
        },
      ]
    );
  };

  const toggleAvailability = async () => {
    if (!user || user.role !== 'provider') return;
    
    const newStatus = !user.isAvailable;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isAvailable: newStatus
      });
      updateUser({ isAvailable: newStatus });
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const menuItems = [
    { icon: 'person-outline', label: 'Edit Profile', color: '#4F46E5' },
    { icon: 'notifications-outline', label: 'Notifications', color: '#F59E0B' },
    { icon: 'shield-checkmark-outline', label: 'Security', color: '#10B981' },
    { icon: 'help-circle-outline', label: 'Help Center', color: '#6366F1' },
    { icon: 'log-out-outline', label: 'Logout', color: '#EF4444', onPress: handleLogout },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={['#4F46E5', '#3730A3']}
              style={styles.avatarGradient}
            >
              <Typography variant="h1" color="inverse" weight="bold">
                {user?.name?.[0] || 'U'}
              </Typography>
            </LinearGradient>
            <TouchableOpacity style={styles.editAvatarBtn}>
              <Ionicons name="camera" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
          
          <Typography variant="h2" weight="bold" style={{ marginTop: 16 }}>
            {user?.name || 'Loading...'}
          </Typography>
          <Typography variant="body" color="muted">
            {user?.email || 'email@example.com'}
          </Typography>
          
          <View style={styles.badgeContainer}>
            <View style={[styles.badge, { backgroundColor: '#EEF2FF' }]}>
              <Typography variant="caption" color="primary" weight="bold">
                {user?.role?.toUpperCase() || 'USER'}
              </Typography>
            </View>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <Card customStyle={styles.statCard}>
            <Typography variant="h3" weight="bold">12</Typography>
            <Typography variant="caption" color="muted">Bookings</Typography>
          </Card>
          <Card customStyle={styles.statCard}>
            <Typography variant="h3" weight="bold">4.9</Typography>
            <Typography variant="caption" color="muted">Rating</Typography>
          </Card>
          <Card customStyle={styles.statCard}>
            <Typography variant="h3" weight="bold">24</Typography>
            <Typography variant="caption" color="muted">Reviews</Typography>
          </Card>
        </View>

        {/* Provider Controls */}
        {user?.role === 'provider' && (
          <Card customStyle={styles.availabilityCard}>
            <View>
              <Typography variant="body" weight="bold">Work Availability</Typography>
              <Typography variant="caption" color="muted">Toggle your online status</Typography>
            </View>
            <TouchableOpacity 
              style={[styles.toggle, user.isAvailable && styles.toggleActive]}
              onPress={toggleAvailability}
            >
              <View style={[styles.toggleCircle, user.isAvailable && styles.toggleCircleActive]} />
            </TouchableOpacity>
          </Card>
        )}

        {/* Settings Menu */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={[styles.iconBox, { backgroundColor: item.color + '15' }]}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
              </View>
              <Typography variant="body" weight="medium" style={styles.menuLabel}>
                {item.label}
              </Typography>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    ...THEME.shadows.sm,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.md,
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#4F46E5',
    width: 32,
    height: 32,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  badgeContainer: {
    marginTop: 12,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 20,
  },
  availabilityCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 24,
  },
  toggle: {
    width: 52,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#4F46E5',
  },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    ...THEME.shadows.sm,
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
  },
  menuContainer: {
    paddingHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuLabel: {
    flex: 1,
  },
});
