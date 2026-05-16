import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { THEME } from '../../theme';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/useAuthStore';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';

const { width } = Dimensions.get('window');

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(1);
}

const CATEGORIES = [
  { id: '1', name: 'Cleaning', icon: 'sparkles-outline', color: '#6366F1' },
  { id: '2', name: 'Repair', icon: 'build-outline', color: '#F59E0B' },
  { id: '3', name: 'Plumbing', icon: 'water-outline', color: '#3B82F6' },
  { id: '4', name: 'Electrician', icon: 'flash-outline', color: '#10B981' },
  { id: '5', name: 'Painting', icon: 'brush-outline', color: '#EC4899' },
  { id: '6', name: 'Car Wash', icon: 'car-outline', color: '#06B6D4' },
  { id: '7', name: 'Gardening', icon: 'leaf-outline', color: '#84CC16' },
];

const POPULAR_SERVICES = [
  { 
    id: 's1', 
    title: 'Professional Deep Cleaning', 
    category: 'Cleaning',
    rating: '4.9', 
    reviews: '128',
    price: '2500', 
    image: 'file:///C:/Users/Dell/.gemini/antigravity/brain/36b02cfe-f820-478f-8d12-4dde5ac8beba/service_cleaning_1778885105872.png',
    provider: 'Ali Cleaners'
  },
  { 
    id: 's2', 
    title: 'AC Gas Refill & Service', 
    category: 'Repair',
    rating: '4.8', 
    reviews: '85',
    price: '1500', 
    image: 'file:///C:/Users/Dell/.gemini/antigravity/brain/36b02cfe-f820-478f-8d12-4dde5ac8beba/service_ac_repair_1778885229550.png',
    provider: 'CoolTech Solutions'
  },
  { 
    id: 's3', 
    title: 'Kitchen Sink Plumbing', 
    category: 'Plumbing',
    rating: '4.7', 
    reviews: '56',
    price: '800', 
    image: 'file:///C:/Users/Dell/.gemini/antigravity/brain/36b02cfe-f820-478f-8d12-4dde5ac8beba/service_plumbing_1778885253794.png',
    provider: 'Expert Plumbers'
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [services, setServices] = React.useState<any[]>([]);
  const [loadingServices, setLoadingServices] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [userLocation, setUserLocation] = React.useState<{ latitude: number, longitude: number } | null>(null);
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const role = user?.role || 'customer';

  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         service.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? service.category === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });
  
  React.useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    })();
  }, []);

  React.useEffect(() => {
    const q = query(
      collection(db, 'services'),
      where('isActive', '==', true),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedServices = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort client-side to avoid needing a composite index
      fetchedServices.sort((a: any, b: any) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });

      setServices(fetchedServices);
      setLoadingServices(false);
    }, (error) => {
      console.error("Error fetching services:", error);
      setLoadingServices(false);
    });

    return () => unsubscribe();
  }, []);

  const renderCustomerDashboard = () => (
    <>
      {/* Search Bar */}
      <View style={[styles.searchSection, { paddingHorizontal: 0 }]}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={THEME.colors.textMuted} />
          <TextInput
            placeholder="Search for services..."
            placeholderTextColor={THEME.colors.textMuted}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

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
            <Typography variant="caption" color="primary" weight="bold">View All</Typography>
          </TouchableOpacity>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.categoriesScroll}
        >
          <TouchableOpacity 
            style={[
              styles.categoryCapsule, 
              !selectedCategory && { backgroundColor: THEME.colors.primary, borderColor: THEME.colors.primary }
            ]}
            onPress={() => setSelectedCategory(null)}
          >
            <Ionicons name="grid-outline" size={18} color={!selectedCategory ? '#FFF' : THEME.colors.primary} />
            <Typography variant="caption" weight="bold" style={{ marginLeft: 8, color: !selectedCategory ? '#FFF' : THEME.colors.primary }}>
              All
            </Typography>
          </TouchableOpacity>

          {CATEGORIES.map((cat) => (
            <TouchableOpacity 
              key={cat.id} 
              style={[
                styles.categoryCapsule, 
                { backgroundColor: cat.color + '10' },
                selectedCategory === cat.name && { backgroundColor: cat.color, borderColor: cat.color }
              ]}
              onPress={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
            >
              <Ionicons name={cat.icon as any} size={18} color={selectedCategory === cat.name ? '#FFF' : cat.color} />
              <Typography variant="caption" weight="bold" style={{ marginLeft: 8, color: selectedCategory === cat.name ? '#FFF' : cat.color }}>
                {cat.name}
              </Typography>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Popular Services */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Typography variant="h3" weight="bold">Popular Services</Typography>
          <TouchableOpacity>
            <Typography variant="caption" color="primary" weight="bold">Nearby</Typography>
          </TouchableOpacity>
        </View>
        
        {loadingServices ? (
          <ActivityIndicator size="small" color={THEME.colors.primary} />
        ) : filteredServices.length > 0 ? (
          filteredServices.map((service) => (
            <TouchableOpacity 
              key={service.id} 
              activeOpacity={0.9}
              onPress={() => router.push({
                pathname: '/service/[id]',
                params: { 
                  id: service.id,
                  name: service.name,
                  price: service.price.toString(),
                  category: service.category,
                  description: service.description,
                  imageUrl: service.imageUrl,
                  providerName: service.providerName,
                  providerPhotoURL: service.providerPhotoURL,
                  rating: service.rating?.toString() || '0.0',
                  reviewCount: service.reviewCount?.toString() || '0'
                }
              })}
            >
              <Card customStyle={styles.serviceCard}>
                <View style={styles.serviceImageContainer}>
                  {service.imageUrl ? (
                    <Image 
                      source={{ uri: service.imageUrl }} 
                      style={styles.serviceImage} 
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <View style={[styles.serviceImage, { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="image-outline" size={32} color="#CBD5E1" />
                    </View>
                  )}

                </View>
                
                <View style={styles.serviceInfo}>
                  <View>
                    <Typography variant="caption" color="primary" weight="bold" style={{ textTransform: 'uppercase', fontSize: 10 }}>
                      {service.category}
                    </Typography>
                    {userLocation && service.latitude && service.longitude && (
                      <View style={styles.distanceBadge}>
                        <Ionicons name="location" size={10} color={THEME.colors.primary} />
                        <Typography variant="caption" weight="bold" style={{ marginLeft: 2, fontSize: 10 }}>
                          {calculateDistance(userLocation.latitude, userLocation.longitude, service.latitude, service.longitude)} km away
                        </Typography>
                      </View>
                    )}
                    <Typography variant="body" weight="bold" style={{ marginTop: 2 }} numberOfLines={1}>
                      {service.name}
                    </Typography>
                    <View style={styles.providerRow}>
                      {service.providerPhotoURL ? (
                        <Image source={{ uri: service.providerPhotoURL }} style={styles.cardProviderAvatar} />
                      ) : (
                        <Ionicons name="person-circle-outline" size={14} color={THEME.colors.textMuted} />
                      )}
                      <Typography variant="caption" color="muted" style={{ marginLeft: 4, fontSize: 10 }}>
                        {service.providerName || 'Professional'}
                      </Typography>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <View style={{ flexDirection: 'row' }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Ionicons 
                            key={s} 
                            name={s <= (service.rating || 0) ? "star" : "star-outline"} 
                            size={10} 
                            color="#F59E0B" 
                          />
                        ))}
                      </View>
                      <Typography variant="caption" color="muted" style={{ marginLeft: 4, fontSize: 10 }}>
                        {service.rating?.toFixed(1) || '0.0'} ({service.reviewCount || 0})
                      </Typography>
                    </View>
                  </View>
                  
                  <View style={styles.priceRow}>
                    <View>
                      <Typography variant="caption" color="muted">Starting from</Typography>
                      <Typography variant="h3" weight="bold" color="primary">Rs. {service.price}</Typography>
                    </View>
                    <View style={styles.arrowBtn}>
                      <Ionicons name="arrow-forward" size={18} color="#FFF" />
                    </View>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        ) : (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Typography variant="body" color="muted">
              {searchQuery ? "No matching services found." : "No services available yet."}
            </Typography>
          </View>
        )}
      </View>
    </>
  );

  const renderProviderDashboard = () => (
    <>
      {/* Welcome Message */}
      <View style={{ marginBottom: 24 }}>
        <Typography variant="h2" weight="bold">Dashboard Overview</Typography>
        <Typography variant="body" color="muted">Monitor your business performance</Typography>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#EEF2FF' }]}>
          <View style={styles.statIconWrapper}>
            <Ionicons name="wallet" size={22} color="#4F46E5" />
          </View>
          <Typography variant="caption" color="muted" style={{ marginTop: 10, fontSize: 12 }}>Earnings</Typography>
          <Typography variant="h2" weight="bold" color="primary">Rs. 45.2k</Typography>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: '#ECFDF5' }]}>
          <View style={[styles.statIconWrapper, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="star" size={22} color="#10B981" />
          </View>
          <Typography variant="caption" color="muted" style={{ marginTop: 10, fontSize: 12 }}>Rating</Typography>
          <Typography variant="h2" weight="bold" color="secondary">4.9/5</Typography>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#FFF7ED' }]}>
          <View style={[styles.statIconWrapper, { backgroundColor: '#FFEDD5' }]}>
            <Ionicons name="calendar" size={22} color="#F59E0B" />
          </View>
          <Typography variant="caption" color="muted" style={{ marginTop: 10, fontSize: 12 }}>Jobs</Typography>
          <Typography variant="h2" weight="bold" style={{ color: '#F59E0B' }}>128</Typography>
        </View>
      </View>

      {/* Pending Requests */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Typography variant="h3" weight="bold">New Requests (2)</Typography>
          <Typography variant="caption" color="primary" weight="bold">See All</Typography>
        </View>
        
        <Card customStyle={styles.requestCard}>
          <View style={styles.requestHeader}>
            <View style={styles.requestUser}>
              <View style={styles.miniAvatar} />
              <View style={{ marginLeft: 10 }}>
                <Typography variant="body" weight="bold">Deep Cleaning</Typography>
                <Typography variant="caption" color="muted">Ayesha Malik • 2.4 km</Typography>
              </View>
            </View>
            <Typography variant="body" weight="bold" color="primary">Rs. 2500</Typography>
          </View>
          <View style={styles.requestActions}>
            <TouchableOpacity style={styles.declineBtn}>
              <Typography variant="caption" weight="bold">Decline</Typography>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn}>
              <Typography variant="caption" color="inverse" weight="bold">Accept Job</Typography>
            </TouchableOpacity>
          </View>
        </Card>
      </View>

      {/* Active Jobs */}
      <View style={styles.section}>
        <Typography variant="h3" weight="bold" style={{ marginBottom: 16 }}>Ongoing Tasks</Typography>
        <Card customStyle={styles.ongoingCard}>
          <View style={styles.ongoingInfo}>
            <Ionicons name="time-outline" size={24} color="#4F46E5" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Typography variant="body" weight="bold">AC Repair in Progress</Typography>
              <Typography variant="caption" color="muted">DHA Phase 6, Sector C</Typography>
            </View>
            <TouchableOpacity style={styles.viewJobBtn}>
              <Ionicons name="chevron-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </Card>
      </View>

      <TouchableOpacity 
        style={styles.postServiceBtn}
        onPress={() => router.push('/provider/add-service')}
      >
        <LinearGradient
          colors={['#4F46E5', '#3730A3']}
          style={styles.gradientBtn}
        >
          <Ionicons name="add-circle" size={24} color="#FFF" />
          <Typography variant="body" weight="bold" color="inverse" style={{ marginLeft: 8 }}>
            Upload New Service
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
          {user?.photoURL ? (
            <Image 
              key={user.photoURL}
              source={{ uri: user.photoURL }} 
              style={styles.avatarImage} 
              contentFit="cover"
              transition={200}
            />
          ) : (
            <LinearGradient
              colors={['#4F46E5', '#3730A3']}
              style={styles.avatarGradient}
            >
              <Typography variant="h3" color="inverse" weight="bold">
                {(user?.name || 'G').charAt(0).toUpperCase()}
              </Typography>
            </LinearGradient>
          )}
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
    paddingVertical: 12,
  },
  searchSection: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    height: 56,
    borderRadius: 28,
    ...THEME.shadows.md,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: THEME.colors.textMain,
    fontFamily: THEME.fonts.regular,
  },
  filterBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: THEME.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.sm,
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
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
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
  categoriesScroll: {
    paddingLeft: 24,
    paddingRight: 24,
    gap: 12,
  },
  categoryCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  serviceCard: {
    flexDirection: 'row',
    marginBottom: 20,
    padding: 12,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    ...THEME.shadows.md,
  },
  serviceImageContainer: {
    width: 110,
    height: 120,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  serviceImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    ...THEME.shadows.sm,
  },
  serviceInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: THEME.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.sm,
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
    gap: 12,
  },
  statCard: {
    flex: 1,
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadows.sm,
  },
  statIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#DDE2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#FFF',
    marginBottom: 24,
    ...THEME.shadows.sm,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    marginRight: 12,
  },
  toggleBtn: {
    padding: 4,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF',
    alignSelf: 'flex-end',
  },
  requestCard: {
    padding: 20,
    borderRadius: 28,
    backgroundColor: '#FFF',
    ...THEME.shadows.md,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  requestUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  declineBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    flex: 2,
    height: 44,
    borderRadius: 12,
    backgroundColor: THEME.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.sm,
  },
  ongoingCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  ongoingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewJobBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  cardProviderAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F1F5F9',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
});
