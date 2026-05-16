import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  Alert,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/useAuthStore';
import { db } from '../../lib/firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, deleteDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function ServicesScreen() {
  const { user } = useAuthStore();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const role = user?.role || 'customer';

  // Fetch services if provider
  useEffect(() => {
    if (role !== 'provider' || !user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'services'),
      where('providerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedServices = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setServices(fetchedServices);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching services:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [role, user]);

  const toggleServiceStatus = async (serviceId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'services', serviceId), {
        isActive: !currentStatus
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to update service status');
    }
  };

  const deleteService = (serviceId: string) => {
    Alert.alert(
      'Delete Service',
      'Are you sure you want to delete this service permanently?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'services', serviceId));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete service');
            }
          } 
        }
      ]
    );
  };

  if (role !== 'provider') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={64} color="#CBD5E1" />
          <Typography variant="h2" weight="bold" style={{ marginTop: 16 }}>Provider Only</Typography>
          <Typography variant="body" color="muted" align="center" style={{ marginTop: 8, paddingHorizontal: 40 }}>
            This section is only available for service providers.
          </Typography>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.headerAvatar}>
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatarMini} />
            ) : (
              <View style={[styles.avatarMini, { backgroundColor: THEME.colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
                <Typography variant="caption" color="inverse" weight="bold">
                  {(user?.name || 'G').charAt(0).toUpperCase()}
                </Typography>
              </View>
            )}
          </TouchableOpacity>
          <Typography variant="h2" weight="bold" style={{ marginLeft: 12 }}>My Services</Typography>
        </View>
        <TouchableOpacity 
          style={styles.addBtn} 
          onPress={() => router.push('/provider/add-service')}
        >
          <Ionicons name="add-circle" size={32} color={THEME.colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      ) : services.length > 0 ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Typography variant="body" color="muted" style={{ marginBottom: 20 }}>
            Manage your published services and their visibility.
          </Typography>

          {services.map((service) => (
            <Card key={service.id} customStyle={styles.serviceCard}>
              {/* Status Badge - Absolute Positioned */}
              <View style={[styles.statusBadgeAbsolute, { backgroundColor: service.isActive ? '#ECFDF5' : '#FEF2F2' }]}>
                <View style={[styles.statusDot, { backgroundColor: service.isActive ? '#10B981' : '#EF4444' }]} />
                <Typography variant="caption" weight="bold" color={service.isActive ? 'primary' : 'error'} style={{ fontSize: 10 }}>
                  {service.isActive ? 'Active' : 'Hidden'}
                </Typography>
              </View>

              <View style={styles.cardHeader}>
                {service.imageUrl ? (
                  <Image source={{ uri: service.imageUrl }} style={styles.serviceImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="image-outline" size={24} color="#CBD5E1" />
                  </View>
                )}
                <View style={styles.serviceInfo}>
                  <View style={{ paddingRight: 70 }}>
                    <Typography variant="body" weight="bold" numberOfLines={1}>{service.name}</Typography>
                    <Typography variant="caption" color="primary" weight="bold">{service.category}</Typography>
                  </View>
                  
                  <View style={styles.ratingRow}>
                    <View style={styles.stars}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Ionicons 
                          key={s} 
                          name={s <= Math.floor(service.rating || 0) ? "star" : "star-outline"} 
                          size={14} 
                          color="#F59E0B" 
                        />
                      ))}
                    </View>
                    <Typography variant="caption" weight="bold" style={{ marginLeft: 6 }}>
                      {service.rating?.toFixed(1) || '0.0'}
                    </Typography>
                    <Typography variant="caption" color="muted" style={{ marginLeft: 8 }}>
                      ({service.reviewCount || 0} reviews)
                    </Typography>
                  </View>

                  <Typography variant="body" weight="bold" color="primary" style={{ marginTop: 6 }}>
                    Rs. {service.price}
                  </Typography>
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity 
                  style={styles.actionBtn}
                  onPress={() => toggleServiceStatus(service.id, service.isActive)}
                >
                  <View style={[styles.actionIcon, { backgroundColor: service.isActive ? '#F1F5F9' : '#EEF2FF' }]}>
                    <Ionicons 
                      name={service.isActive ? "eye-off-outline" : "eye-outline"} 
                      size={18} 
                      color={THEME.colors.primary} 
                    />
                  </View>
                  <Typography variant="caption" weight="bold">
                    {service.isActive ? 'Hide' : 'Show'}
                  </Typography>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionBtn}
                  onPress={() => router.push({
                    pathname: '/provider/add-service',
                    params: { editId: service.id }
                  })}
                >
                  <View style={[styles.actionIcon, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="create-outline" size={18} color={THEME.colors.primary} />
                  </View>
                  <Typography variant="caption" weight="bold">
                    Edit
                  </Typography>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionBtn}
                  onPress={() => deleteService(service.id)}
                >
                  <View style={[styles.actionIcon, { backgroundColor: '#FEF2F2' }]}>
                    <Ionicons name="trash-outline" size={18} color={THEME.colors.error} />
                  </View>
                  <Typography variant="caption" weight="bold" style={{ color: THEME.colors.error }}>
                    Delete
                  </Typography>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.center}>
          <Ionicons name="file-tray-outline" size={64} color="#CBD5E1" />
          <Typography variant="body" color="muted" style={{ marginTop: 16 }}>No services found.</Typography>
          <TouchableOpacity 
            style={styles.addFirstBtn}
            onPress={() => router.push('/provider/add-service')}
          >
            <Typography variant="body" weight="bold" color="inverse">Add Your First Service</Typography>
          </TouchableOpacity>
        </View>
      )}
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
    paddingVertical: 20,
    backgroundColor: '#FFF',
  },
  addBtn: {
    padding: 4,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    ...THEME.shadows.sm,
  },
  avatarMini: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  serviceCard: {
    padding: 16,
    borderRadius: 24,
    marginBottom: 20,
    backgroundColor: '#FFF',
    position: 'relative',
    ...THEME.shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  serviceImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceInfo: {
    flex: 1,
    marginLeft: 16,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadgeAbsolute: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 16,
    paddingTop: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  actionBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFirstBtn: {
    marginTop: 24,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    ...THEME.shadows.md,
  },
});
