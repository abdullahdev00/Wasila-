import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, TextInput, Alert } from 'react-native';
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
import { collection, query, where, onSnapshot, limit, orderBy, updateDoc, doc } from 'firebase/firestore';
import { API_BASE_URL } from '../../lib/apiConfig';

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

  // Provider Bookings States & Handlers
  const [providerBookings, setProviderBookings] = React.useState<any[]>([]);
  const [loadingProviderBookings, setLoadingProviderBookings] = React.useState(true);
  const [providerServiceStats, setProviderServiceStats] = React.useState({
    rating: 5.0,
    reliabilityScore: 100,
    completedJobsCount: 0
  });

  // Action Loading States
  const [acceptingBookingId, setAcceptingBookingId] = React.useState<string | null>(null);
  const [decliningBookingId, setDecliningBookingId] = React.useState<string | null>(null);
  const [arrivingBookingId, setArrivingBookingId] = React.useState<string | null>(null);
  const [completingBookingId, setCompletingBookingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (role !== 'provider' || !user) {
      setLoadingProviderBookings(false);
      return;
    }

    const q = query(
      collection(db, 'bookings'),
      where('providerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      fetched.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setProviderBookings(fetched);
      setLoadingProviderBookings(false);
    }, (err) => {
      console.error("Error fetching provider bookings:", err);
      setLoadingProviderBookings(false);
    });

    return () => unsubscribe();
  }, [role, user]);

  React.useEffect(() => {
    if (role !== 'provider' || !user) return;

    const q = query(
      collection(db, 'services'),
      where('providerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) return;
      
      let totalRating = 0;
      let totalReliability = 0;
      let count = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.rating !== undefined) {
          totalRating += data.rating;
        } else {
          totalRating += 4.5;
        }
        if (data.reliabilityScore !== undefined) {
          totalReliability += data.reliabilityScore;
        } else {
          totalReliability += 100;
        }
        count++;
      });

      setProviderServiceStats({
        rating: count > 0 ? totalRating / count : 5.0,
        reliabilityScore: count > 0 ? Math.round(totalReliability / count) : 100,
        completedJobsCount: count > 0 ? snapshot.docs.reduce((sum, doc) => sum + (doc.data().totalCompletedBookings || 0), 0) : 0
      });
    }, (err) => {
      console.error("Error fetching provider services stats:", err);
    });

    return () => unsubscribe();
  }, [role, user]);

  const handleAcceptBooking = async (bookingId: string) => {
    setAcceptingBookingId(bookingId);
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'accepted',
        timestamp: new Date().toISOString()
      });
      Alert.alert("Success", "Booking accepted successfully!");
    } catch (error: any) {
      console.error("Error accepting booking:", error);
      Alert.alert("Error", error.message);
    } finally {
      setAcceptingBookingId(null);
    }
  };

  const handleDeclineBooking = async (bookingId: string) => {
    Alert.alert(
      "Decline Request",
      "Are you sure you want to decline this booking request?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Decline", 
          style: "destructive",
          onPress: async () => {
            setDecliningBookingId(bookingId);
            try {
              const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/provider-cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              });
              const data = await response.json();
              if (response.ok) {
                Alert.alert("Declined", "The booking request has been declined.");
              } else {
                throw new Error(data.error || "Failed to decline booking request");
              }
            } catch (error: any) {
              console.error("Error declining booking:", error);
              Alert.alert("Error", error.message);
            } finally {
              setDecliningBookingId(null);
            }
          }
        }
      ]
    );
  };

  const handleArrivedBooking = async (bookingId: string) => {
    setArrivingBookingId(bookingId);
    try {
      const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/arrived`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert(
          "Arrived", 
          data.isLate 
            ? "Aap late arrive hue hain! Reliability score deduct ho gaya hai." 
            : "Aap time par arrive hue hain!"
        );
      } else {
        throw new Error(data.error || "Failed to mark arrival");
      }
    } catch (error: any) {
      console.error("Error marking arrival:", error);
      Alert.alert("Error", error.message);
    } finally {
      setArrivingBookingId(null);
    }
  };

  const handleCompleteBooking = async (bookingId: string) => {
    Alert.alert(
      "Complete Job",
      "Are you sure you want to mark this job as completed?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Completed", 
          onPress: async () => {
            setCompletingBookingId(bookingId);
            try {
              const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              });
              const data = await response.json();
              if (response.ok) {
                Alert.alert("Success", "Job marked as completed!");
              } else {
                throw new Error(data.error || "Failed to mark completion");
              }
            } catch (error: any) {
              console.error("Error completing booking:", error);
              Alert.alert("Error", error.message);
            } finally {
              setCompletingBookingId(null);
            }
          }
        }
      ]
    );
  };

  const filteredServices = services.filter(service => {
    const sName = service.name || service.providerName || '';
    const sCat = service.category || '';
    const matchesSearch = sName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         sCat.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? sCat === selectedCategory : true;
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

  const renderProviderDashboard = () => {
    const pendingRequests = providerBookings.filter(b => b.status === 'pending' || b.status === 'rescheduled');
    const ongoingTasks = providerBookings.filter(b => b.status === 'accepted' || b.status === 'arrived');
    
    const totalEarnings = providerBookings
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + (Number(b.price) || 0), 0);
      
    const completedJobsCount = providerBookings.filter(b => b.status === 'completed').length;

    return (
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
            <Typography variant="h3" weight="bold" color="primary" numberOfLines={1} adjustsFontSizeToFit>{totalEarnings.toLocaleString()}</Typography>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: '#ECFDF5' }]}>
            <View style={[styles.statIconWrapper, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="star" size={22} color="#10B981" />
            </View>
            <Typography variant="caption" color="muted" style={{ marginTop: 10, fontSize: 12 }}>Rating</Typography>
            <Typography variant="h3" weight="bold" color="secondary" numberOfLines={1} adjustsFontSizeToFit>{providerServiceStats.rating.toFixed(1)}/5</Typography>
            <Typography variant="caption" color="muted" style={{ fontSize: 10 }}>({providerServiceStats.completedJobsCount} jobs)</Typography>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#FFF7ED' }]}>
            <View style={[styles.statIconWrapper, { backgroundColor: '#FFEDD5' }]}>
              <Ionicons name="ribbon" size={22} color="#F59E0B" />
            </View>
            <Typography variant="caption" color="muted" style={{ marginTop: 10, fontSize: 12 }}>Reliability</Typography>
            <Typography variant="h3" weight="bold" style={{ color: '#F59E0B' }} numberOfLines={1} adjustsFontSizeToFit>{providerServiceStats.reliabilityScore}%</Typography>
          </View>
        </View>

        {/* Pending Requests */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Typography variant="h3" weight="bold">New Requests ({pendingRequests.length})</Typography>
          </View>
          
          {loadingProviderBookings ? (
            <ActivityIndicator size="small" color={THEME.colors.primary} />
          ) : pendingRequests.length > 0 ? (
            pendingRequests.map((booking) => (
              <Card key={booking.id} customStyle={[styles.requestCard, { marginBottom: 12 }]}>
                <View style={styles.requestHeader}>
                  <View style={styles.requestUser}>
                    {booking.userPhotoURL ? (
                      <Image source={{ uri: booking.userPhotoURL }} style={styles.cardProviderAvatar} />
                    ) : (
                      <View style={[styles.cardProviderAvatar, { backgroundColor: THEME.colors.primary + '20', justifyContent: 'center', alignItems: 'center' }]}>
                        <Typography variant="caption" color="primary" weight="bold">{(booking.userName || 'G').charAt(0).toUpperCase()}</Typography>
                      </View>
                    )}
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Typography variant="body" weight="bold">{booking.serviceName || 'Service'}</Typography>
                      <Typography variant="caption" color="muted">{booking.userName || 'Customer'} • {booking.date}</Typography>
                      {booking.status === 'rescheduled' && (
                        <View style={{ backgroundColor: '#8B5CF620', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4, alignSelf: 'flex-start' }}>
                          <Typography variant="caption" style={{ color: '#8B5CF6', fontSize: 10 }} weight="bold">RESCHEDULED</Typography>
                        </View>
                      )}
                    </View>
                  </View>
                  <Typography variant="body" weight="bold" color="primary">Rs. {Number(booking.price || 0).toLocaleString()}</Typography>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity 
                    style={[
                      styles.declineBtn, 
                      (decliningBookingId === booking.id || acceptingBookingId === booking.id) && { opacity: 0.7 }
                    ]} 
                    onPress={() => handleDeclineBooking(booking.id)}
                    disabled={decliningBookingId === booking.id || acceptingBookingId === booking.id}
                  >
                    {decliningBookingId === booking.id ? (
                      <ActivityIndicator size="small" color={THEME.colors.primary} />
                    ) : (
                      <Typography variant="caption" weight="bold">Decline</Typography>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.acceptBtn, 
                      (decliningBookingId === booking.id || acceptingBookingId === booking.id) && { opacity: 0.7 }
                    ]} 
                    onPress={() => handleAcceptBooking(booking.id)}
                    disabled={decliningBookingId === booking.id || acceptingBookingId === booking.id}
                  >
                    {acceptingBookingId === booking.id ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Typography variant="caption" color="inverse" weight="bold">Accept Job</Typography>
                    )}
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          ) : (
            <View style={{ padding: 20, alignItems: 'center', backgroundColor: '#FFF', borderRadius: 20 }}>
              <Typography variant="body" color="muted">No pending requests.</Typography>
            </View>
          )}
        </View>

        {/* Active Jobs */}
        <View style={styles.section}>
          <Typography variant="h3" weight="bold" style={{ marginBottom: 16 }}>Ongoing Tasks ({ongoingTasks.length})</Typography>
          
          {loadingProviderBookings ? (
            <ActivityIndicator size="small" color={THEME.colors.primary} />
          ) : ongoingTasks.length > 0 ? (
            ongoingTasks.map((booking) => (
              <Card key={booking.id} customStyle={[styles.ongoingCard, { marginBottom: 12 }]}>
                <View style={styles.ongoingInfo}>
                  <Ionicons name="time-outline" size={24} color="#4F46E5" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Typography variant="body" weight="bold">{booking.serviceName || 'Service'}</Typography>
                    <Typography variant="caption" color="muted">Customer: {booking.userName} • {booking.date}</Typography>
                    <Typography 
                      variant="caption" 
                      color={booking.status === 'arrived' ? 'secondary' : 'primary'} 
                      weight="bold" 
                      style={{ textTransform: 'uppercase', fontSize: 10, marginTop: 2 }}
                    >
                      Status: {booking.status}
                    </Typography>
                  </View>
                  {booking.status === 'accepted' ? (
                    <TouchableOpacity 
                      style={[
                        styles.actionBtn, 
                        arrivingBookingId === booking.id && { opacity: 0.7 }
                      ]} 
                      onPress={() => handleArrivedBooking(booking.id)}
                      disabled={arrivingBookingId === booking.id}
                    >
                      {arrivingBookingId === booking.id ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Typography variant="caption" color="inverse" weight="bold">Arrived</Typography>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={[
                        styles.actionBtn, 
                        { backgroundColor: '#10B981' },
                        completingBookingId === booking.id && { opacity: 0.7 }
                      ]} 
                      onPress={() => handleCompleteBooking(booking.id)}
                      disabled={completingBookingId === booking.id}
                    >
                      {completingBookingId === booking.id ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Typography variant="caption" color="inverse" weight="bold">Complete</Typography>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            ))
          ) : (
            <View style={{ padding: 20, alignItems: 'center', backgroundColor: '#FFF', borderRadius: 20 }}>
              <Typography variant="body" color="muted">No ongoing tasks.</Typography>
            </View>
          )}
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
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Typography variant="body" color="muted">Good Morning, 👋</Typography>
          <Typography variant="h2" weight="bold" color="main">{user?.name || 'Guest'}</Typography>
        </View>
        <TouchableOpacity style={styles.headerAvatar} onPress={() => router.push('/(tabs)/profile')}>
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
    flex: 1,
    marginRight: 12,
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
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
});
