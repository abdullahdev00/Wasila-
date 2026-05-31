import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { THEME } from '../../theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useRouter } from 'expo-router';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, getDoc } from 'firebase/firestore';

const getCategoryConfig = (category: string) => {
  const cat = category?.toLowerCase() || '';
  if (cat.includes('clean')) return { icon: 'sparkles-outline', color: '#6366F1' };
  if (cat.includes('repair')) return { icon: 'build-outline', color: '#F59E0B' };
  if (cat.includes('plumb')) return { icon: 'water-outline', color: '#3B82F6' };
  if (cat.includes('elect')) return { icon: 'flash-outline', color: '#10B981' };
  if (cat.includes('paint')) return { icon: 'brush-outline', color: '#EC4899' };
  if (cat.includes('wash')) return { icon: 'car-outline', color: '#06B6D4' };
  if (cat.includes('gard')) return { icon: 'leaf-outline', color: '#84CC16' };
  return { icon: 'briefcase-outline', color: '#4F46E5' };
};

const getStatusBadgeStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'accepted':
      return { bg: '#10B98120', text: '#10B981', label: 'Accepted' };
    case 'declined':
      return { bg: '#EF444420', text: '#EF4444', label: 'Declined' };
    case 'completed':
      return { bg: '#3B82F620', text: '#3B82F6', label: 'Completed' };
    case 'rescheduled':
      return { bg: '#8B5CF620', text: '#8B5CF6', label: 'Rescheduled' };
    default:
      return { bg: '#F59E0B20', text: '#F59E0B', label: 'Pending' };
  }
};

export default function BookingsScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  
  const [bookings, setBookings] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Rescheduling Modal State
  const [rescheduleBookingId, setRescheduleBookingId] = React.useState<string | null>(null);
  const [newDate, setNewDate] = React.useState('');
  const [rescheduleModalVisible, setRescheduleModalVisible] = React.useState(false);

  // Rating Modal State
  const [ratingModalVisible, setRatingModalVisible] = React.useState(false);
  const [selectedBookingToRate, setSelectedBookingToRate] = React.useState<any | null>(null);
  const [userRatingScore, setUserRatingScore] = React.useState(5);
  const [dismissedBookingIds, setDismissedBookingIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!user) {
      console.log("[Bookings Debug] No user is logged in.");
      setLoading(false);
      return;
    }

    console.log("[Bookings Debug] Active User:", { uid: user.uid, role: user.role, email: user.email });

    const q = user.role === 'provider'
      ? query(collection(db, 'bookings'), where('providerId', '==', user.uid))
      : query(collection(db, 'bookings'), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`[Bookings Debug] Query snapshot returned ${snapshot.docs.length} documents.`);
      const fetchedBookings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // Sort by timestamp desc
      fetchedBookings.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setBookings(fetchedBookings);
      setLoading(false);
    }, (err) => {
      console.error("[Bookings Debug] Error fetching bookings:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Auto-popup rating modal when bookings update
  React.useEffect(() => {
    if (user && user.role !== 'provider' && bookings.length > 0) {
      const unratedCompletedBooking = bookings.find(
        b => b.status === 'completed' && !b.ratingSubmitted && !dismissedBookingIds.includes(b.id)
      );
      if (unratedCompletedBooking && !ratingModalVisible && !selectedBookingToRate) {
        setSelectedBookingToRate(unratedCompletedBooking);
        setUserRatingScore(5);
        setRatingModalVisible(true);
      }
    }
  }, [bookings, dismissedBookingIds, user]);

  const handleRatingSubmit = async () => {
    if (!selectedBookingToRate) return;
    try {
      const bookingId = selectedBookingToRate.id;
      const serviceId = selectedBookingToRate.serviceId;
      
      // 1. Update booking doc in Firestore
      await updateDoc(doc(db, 'bookings', bookingId), {
        ratingSubmitted: true,
        ratingScore: userRatingScore,
        timestamp: new Date().toISOString()
      });

      // 2. Fetch and update service rating and reviewCount in services collection
      if (serviceId) {
        const serviceRef = doc(db, 'services', serviceId);
        const serviceSnap = await getDoc(serviceRef);
        if (serviceSnap.exists()) {
          const serviceData = serviceSnap.data();
          const oldRating = Number(serviceData.rating || 0);
          const oldReviews = Number(serviceData.reviewCount || 0);
          const newReviews = oldReviews + 1;
          const newRating = oldReviews === 0 
            ? userRatingScore 
            : ((oldRating * oldReviews) + userRatingScore) / newReviews;

          await updateDoc(serviceRef, {
            rating: newRating,
            reviewCount: newReviews
          });
        }
      }

      setRatingModalVisible(false);
      setSelectedBookingToRate(null);
      Alert.alert("Thank you!", "Your review has been submitted successfully.");
    } catch (error: any) {
      console.error("Error submitting rating:", error);
      Alert.alert("Error", error.message);
    }
  };

  const handleLater = () => {
    if (selectedBookingToRate) {
      setDismissedBookingIds(prev => [...prev, selectedBookingToRate.id]);
    }
    setRatingModalVisible(false);
    setSelectedBookingToRate(null);
  };

  const handleCancelBooking = (bookingId: string) => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Cancel", 
          style: "destructive",
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'bookings', bookingId), {
                status: 'declined',
                timestamp: new Date().toISOString()
              });
              Alert.alert("Booking Cancelled", "The booking has been successfully cancelled.");
            } catch (error: any) {
              console.error("Error cancelling booking:", error);
              Alert.alert("Error", error.message);
            }
          }
        }
      ]
    );
  };

  const handleOpenReschedule = (booking: any) => {
    setRescheduleBookingId(booking.id);
    setNewDate(booking.date || 'Tomorrow, 10:00 AM');
    setRescheduleModalVisible(true);
  };

  const handleRescheduleSubmit = async () => {
    if (!newDate.trim()) {
      Alert.alert("Error", "Please enter a valid date and time.");
      return;
    }
    if (!rescheduleBookingId) return;

    try {
      await updateDoc(doc(db, 'bookings', rescheduleBookingId), {
        date: newDate,
        status: 'rescheduled',
        timestamp: new Date().toISOString()
      });
      setRescheduleModalVisible(false);
      setNewDate('');
      setRescheduleBookingId(null);
      Alert.alert("Success", "Booking rescheduled successfully!");
    } catch (error: any) {
      console.error("Error rescheduling booking:", error);
      Alert.alert("Error", error.message);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Ionicons name="calendar-outline" size={64} color="#CBD5E1" />
        <Typography variant="h2" weight="bold" style={{ marginTop: 16 }}>My Bookings</Typography>
        <Typography variant="body" color="muted" style={{ textAlign: 'center', marginTop: 8, marginBottom: 24 }}>
          Log in to see and manage your service bookings.
        </Typography>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/(auth)/login')}>
          <Typography variant="body" color="inverse" weight="bold">Log In</Typography>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
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
            <Typography variant="h2" weight="bold" style={{ marginLeft: 12 }}>
              {user.role === 'provider' ? 'Assigned Jobs' : 'My Bookings'}
            </Typography>
          </View>
        </View>

        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator size="large" color={THEME.colors.primary} style={{ marginTop: 40 }} />
          ) : bookings.length > 0 ? (
            bookings.map((booking) => {
              const catConfig = getCategoryConfig(booking.category);
              const badge = getStatusBadgeStyle(booking.status);
              
              return (
                <Card key={booking.id} customStyle={styles.bookingCard}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.iconWrapper, { backgroundColor: `${catConfig.color}15` }]}>
                      <Ionicons name={catConfig.icon as any} size={24} color={catConfig.color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                      <Typography variant="body" weight="bold">{booking.serviceName || 'Service'}</Typography>
                      <Typography variant="caption" color="muted">{booking.date}</Typography>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Typography 
                        variant="caption" 
                        weight="bold" 
                        style={{ color: badge.text }}
                      >
                        {badge.label}
                      </Typography>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.cardFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      {user.role === 'provider' ? (
                        booking.userPhotoURL ? (
                          <Image source={{ uri: booking.userPhotoURL }} style={styles.providerMiniAvatar} />
                        ) : (
                          <Ionicons name="person-circle-outline" size={20} color="#64748B" />
                        )
                      ) : (
                        booking.providerPhotoURL ? (
                          <Image source={{ uri: booking.providerPhotoURL }} style={styles.providerMiniAvatar} />
                        ) : (
                          <Ionicons name="person-circle-outline" size={20} color="#64748B" />
                        )
                      )}
                      <Typography variant="caption" style={{ marginLeft: 6, flex: 1 }} numberOfLines={1}>
                        {user.role === 'provider'
                          ? `Client: ${booking.userName || 'Client User'}`
                          : `Provider: ${booking.providerName || 'Professional'}`}
                      </Typography>
                    </View>
                    <Typography variant="body" weight="bold" color="primary">Rs. {Number(booking.price || 0).toLocaleString()}</Typography>
                  </View>
                  
                  {/* Action buttons if not completed/declined */}
                  {booking.status !== 'completed' && booking.status !== 'declined' && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.rescheduleBtn} onPress={() => handleOpenReschedule(booking)}>
                        <Typography variant="caption" weight="bold">Reschedule</Typography>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancelBooking(booking.id)}>
                        <Typography variant="caption" weight="bold" color="inverse">Cancel</Typography>
                      </TouchableOpacity>
                    </View>
                  )}
                </Card>
              );
            })
          ) : (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Ionicons name="calendar-outline" size={48} color="#94A3B8" />
              <Typography variant="body" color="muted" style={{ marginTop: 12 }}>
                No bookings found.
              </Typography>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Reschedule Modal */}
      <Modal
        visible={rescheduleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRescheduleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card customStyle={styles.modalCard}>
            <Typography variant="h2" weight="bold" style={{ marginBottom: 12 }}>Reschedule Booking</Typography>
            <Typography variant="body" color="muted" style={{ marginBottom: 20 }}>
              Enter the new date and time you want to schedule this service for.
            </Typography>
            
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Tomorrow, 4:00 PM"
              placeholderTextColor="#94A3B8"
              value={newDate}
              onChangeText={setNewDate}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalCancelBtn]} 
                onPress={() => setRescheduleModalVisible(false)}
              >
                <Typography variant="body" weight="bold">Cancel</Typography>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalSubmitBtn]} 
                onPress={handleRescheduleSubmit}
              >
                <Typography variant="body" color="inverse" weight="bold">Save</Typography>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </Modal>

      {/* Rating Modal */}
      <Modal
        visible={ratingModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleLater}
      >
        <View style={styles.modalOverlay}>
          <Card customStyle={styles.modalCard}>
            <Typography variant="h2" weight="bold" style={{ marginBottom: 12, textAlign: 'center' }}>Rate Service</Typography>
            <Typography variant="body" color="muted" style={{ marginBottom: 20, textAlign: 'center' }}>
              How was your service with {selectedBookingToRate?.providerName || 'your provider'}?
            </Typography>
            
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setUserRatingScore(star)}>
                  <Ionicons 
                    name={userRatingScore >= star ? "star" : "star-outline"} 
                    size={36} 
                    color="#F59E0B" 
                  />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalCancelBtn]} 
                onPress={handleLater}
              >
                <Typography variant="body" weight="bold">Later</Typography>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalSubmitBtn]} 
                onPress={handleRatingSubmit}
              >
                <Typography variant="body" color="inverse" weight="bold">Submit</Typography>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </Modal>
    </View>
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
    paddingTop: 64,
    paddingBottom: 16,
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
  providerMiniAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  content: {
    padding: 24,
    paddingBottom: 120,
  },
  bookingCard: {
    marginBottom: 20,
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    ...THEME.shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  rescheduleBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EF4444',
  },
  loginBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    ...THEME.shadows.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    padding: 24,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    ...THEME.shadows.lg,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtn: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalSubmitBtn: {
    backgroundColor: THEME.colors.primary,
  }
});
