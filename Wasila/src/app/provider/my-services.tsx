import React, { useEffect, useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuthStore } from '../../store/useAuthStore';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { THEME } from '../../theme';

export default function MyServicesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

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
      console.error("Error fetching my services:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

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

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: 'My Services',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#F8FAFC' },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 8 }}>
              <Ionicons name="arrow-back" size={24} color={THEME.colors.textMain} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/provider/add-service')} style={{ marginRight: 8 }}>
              <Ionicons name="add-circle" size={28} color={THEME.colors.primary} />
            </TouchableOpacity>
          )
        }} 
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      ) : services.length > 0 ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Typography variant="body" color="muted" style={{ marginBottom: 20 }}>
            You have {services.length} active service listings.
          </Typography>

          {services.map((service) => (
            <Card key={service.id} customStyle={styles.serviceCard}>
              <View style={styles.cardHeader}>
                {service.imageUrl ? (
                  <Image source={{ uri: service.imageUrl }} style={styles.serviceImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="image-outline" size={24} color="#CBD5E1" />
                  </View>
                )}
                <View style={styles.serviceInfo}>
                  <Typography variant="body" weight="bold">{service.name}</Typography>
                  <Typography variant="caption" color="primary" weight="bold">{service.category}</Typography>
                  <Typography variant="body" weight="bold" color="primary" style={{ marginTop: 4 }}>
                    Rs. {service.price}
                  </Typography>
                </View>
                <View style={styles.statusBadge}>
                  <View style={[styles.statusDot, { backgroundColor: service.isActive ? '#10B981' : '#EF4444' }]} />
                  <Typography variant="caption" weight="bold">
                    {service.isActive ? 'Active' : 'Inactive'}
                  </Typography>
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity 
                  style={styles.actionBtn}
                  onPress={() => toggleServiceStatus(service.id, service.isActive)}
                >
                  <Ionicons 
                    name={service.isActive ? "eye-off-outline" : "eye-outline"} 
                    size={18} 
                    color={THEME.colors.primary} 
                  />
                  <Typography variant="caption" weight="bold" style={{ marginLeft: 6 }}>
                    {service.isActive ? 'Deactivate' : 'Activate'}
                  </Typography>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionBtn}
                  onPress={() => deleteService(service.id)}
                >
                  <Ionicons name="trash-outline" size={18} color={THEME.colors.error} />
                  <Typography variant="caption" weight="bold" style={{ marginLeft: 6, color: THEME.colors.error }}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  serviceCard: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    backgroundColor: '#FFF',
    ...THEME.shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  imagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
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
    gap: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addFirstBtn: {
    marginTop: 24,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    ...THEME.shadows.md,
  }
});
