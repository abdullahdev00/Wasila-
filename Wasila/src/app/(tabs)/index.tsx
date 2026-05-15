import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { THEME } from '../../theme';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/useAuthStore';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: '1', name: 'Cleaning', icon: 'sparkles-outline', color: '#4F46E5' },
  { id: '2', name: 'Repair', icon: 'build-outline', color: '#F59E0B' },
  { id: '3', name: 'Plumbing', icon: 'water-outline', color: '#3B82F6' },
  { id: '4', name: 'Electrician', icon: 'flash-outline', color: '#10B981' },
];

const POPULAR_SERVICES = [
  { id: 's1', title: 'Deep Home Cleaning', rating: '4.8', price: 'Rs. 2500', icon: 'home-outline' },
  { id: 's2', title: 'AC Service & Repair', rating: '4.9', price: 'Rs. 1500', icon: 'snow-outline' },
  { id: 's3', title: 'Full House Painting', rating: '4.7', price: 'Rs. 15000', icon: 'brush-outline' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const role = user?.role || 'customer';

  const renderCustomerDashboard = () => (
    <>
      {/* AI Banner */}
      <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/chat')}>
        <LinearGradient
          colors={['#4F46E5', '#312E81']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiBanner}
        >
          <View style={styles.aiBannerContent}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Typography variant="h3" color="inverse" weight="bold">Wasila AI Orchestrator</Typography>
              <Typography variant="caption" color="inverse" style={styles.aiDescription}>
                Just tell us what you need. AI will find the best match instantly.
              </Typography>
            </View>
            <View style={styles.aiIconContainer}>
              <Ionicons name="sparkles" size={24} color="#4F46E5" />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Categories */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Typography variant="h3" weight="bold">Categories</Typography>
          <TouchableOpacity>
            <Typography variant="caption" color="primary">See All</Typography>
          </TouchableOpacity>
        </View>
        <View style={styles.grid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity key={cat.id} style={styles.categoryCard}>
              <View style={[styles.iconWrapper, { backgroundColor: `${cat.color}10` }]}>
                <Ionicons name={cat.icon as any} size={24} color={cat.color} />
              </View>
              <Typography variant="caption" weight="medium" style={{ marginTop: 8 }}>
                {cat.name}
              </Typography>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Popular Services */}
      <View style={styles.section}>
        <Typography variant="h3" weight="bold" style={{ marginBottom: THEME.spacing.md }}>
          Popular Services
        </Typography>
        {POPULAR_SERVICES.map((service) => (
          <Card key={service.id} customStyle={styles.serviceCard}>
            <View style={styles.serviceIconContainer}>
               <Ionicons name={service.icon as any} size={24} color="#4F46E5" />
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Typography variant="body" weight="bold" color="main">{service.title}</Typography>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Typography variant="caption" color="muted" style={{ marginLeft: 4 }}>
                  {service.rating}
                </Typography>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Typography variant="body" weight="bold" color="primary" style={{ marginBottom: 8 }}>{service.price}</Typography>
              <TouchableOpacity style={styles.bookBtn}>
                <Typography variant="caption" color="inverse" weight="bold">Book</Typography>
              </TouchableOpacity>
            </View>
          </Card>
        ))}
      </View>
    </>
  );

  const renderProviderDashboard = () => (
    <>
      <View style={styles.statsRow}>
        <Card customStyle={styles.statCard}>
          <Typography variant="caption" color="muted">Total Earnings</Typography>
          <Typography variant="h3" weight="bold" color="primary">Rs. 45,000</Typography>
        </Card>
        <Card customStyle={styles.statCard}>
          <Typography variant="caption" color="muted">New Requests</Typography>
          <Typography variant="h3" weight="bold" color="secondary">12</Typography>
        </Card>
      </View>

      <View style={styles.section}>
        <Typography variant="h3" weight="bold" style={{ marginBottom: THEME.spacing.md }}>
          Recent Activity
        </Typography>
        <Card customStyle={styles.activityCard}>
          <View style={styles.activityItem}>
            <View style={[styles.iconWrapper, { backgroundColor: '#10B98115' }]}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#10B981" />
            </View>
            <View style={{ flex: 1, marginLeft: THEME.spacing.md }}>
              <Typography variant="body" weight="bold">Job Completed</Typography>
              <Typography variant="caption" color="muted">Home Cleaning - Rs. 2500</Typography>
            </View>
            <Typography variant="caption" color="muted">2h ago</Typography>
          </View>
        </Card>
      </View>

      <TouchableOpacity style={styles.postServiceBtn}>
        <LinearGradient
          colors={['#4F46E5', '#3730A3']}
          style={styles.gradientBtn}
        >
          <Ionicons name="add-circle-outline" size={24} color="#FFF" />
          <Typography variant="body" weight="bold" color="inverse" style={{ marginLeft: 8 }}>
            Post New Service
          </Typography>
        </LinearGradient>
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Typography variant="body" color="muted">Good Morning, 👋</Typography>
          <Typography variant="h2" weight="bold" color="main">{user?.name || 'Guest'}</Typography>
        </View>
        <TouchableOpacity style={styles.headerAvatar} onPress={() => router.push('/profile')}>
          <LinearGradient
            colors={['#4F46E5', '#3730A3']}
            style={styles.avatarGradient}
          >
            <Typography variant="h3" color="inverse" weight="bold">
              {(user?.name || 'G').charAt(0).toUpperCase()}
            </Typography>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {role === 'provider' ? renderProviderDashboard() : renderCustomerDashboard()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    ...THEME.shadows.sm,
  },
  avatarGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 120,
  },
  aiBanner: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    ...THEME.shadows.md,
  },
  aiBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiDescription: {
    marginTop: 8,
    opacity: 0.9,
    lineHeight: 20,
  },
  aiIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.sm,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: (width - 48 - 36) / 4,
    alignItems: 'center',
    marginBottom: 16,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    ...THEME.shadows.sm,
  },
  serviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    padding: 16,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    ...THEME.shadows.sm,
  },
  serviceIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statCard: {
    width: '48%',
    padding: 20,
    borderRadius: 20,
  },
  activityCard: {
    padding: 20,
    borderRadius: 20,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postServiceBtn: {
    marginTop: 16,
    ...THEME.shadows.md,
  },
  gradientBtn: {
    flexDirection: 'row',
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
