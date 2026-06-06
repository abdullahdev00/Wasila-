import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { THEME } from '../../theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useRouter } from 'expo-router';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, getDoc, addDoc } from 'firebase/firestore';
import { API_BASE_URL } from '../../lib/apiConfig';

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
  const s = status?.toLowerCase() || '';
  if (s === 'accepted') return { bg: '#10B98120', text: '#10B981', label: 'Accepted' };
  if (s === 'arrived') return { bg: '#06B6D420', text: '#06B6D4', label: 'Arrived' };
  if (s === 'declined' || s.includes('cancel')) return { bg: '#EF444420', text: '#EF4444', label: 'Cancelled' };
  if (s === 'completed') return { bg: '#3B82F620', text: '#3B82F6', label: 'Completed' };
  if (s === 'rescheduled') return { bg: '#8B5CF620', text: '#8B5CF6', label: 'Rescheduled' };
  return { bg: '#F59E0B20', text: '#F59E0B', label: 'Pending' };
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

  // Wallet State
  const [walletBalance, setWalletBalance] = React.useState(0);
  const [holdingBalance, setHoldingBalance] = React.useState(0);
  const [transactions, setTransactions] = React.useState<any[]>([]);
  const [walletModalVisible, setWalletModalVisible] = React.useState(false);
  const [depositing, setDepositing] = React.useState(false);

  // Loading states for actions
  const [cancellingBookingId, setCancellingBookingId] = React.useState<string | null>(null);
  const [rescheduling, setRescheduling] = React.useState(false);
  const [ratingSubmitting, setRatingSubmitting] = React.useState(false);

  // Dispute Modal State
  const [disputeModalVisible, setDisputeModalVisible] = React.useState(false);
  const [selectedBookingToDispute, setSelectedBookingToDispute] = React.useState<any | null>(null);
  const [disputeIssueType, setDisputeIssueType] = React.useState<'no_show' | 'overcharge' | 'late_arrival' | 'poor_quality'>('no_show');
  const [disputeDetails, setDisputeDetails] = React.useState('');
  const [disputeSubmitting, setDisputeSubmitting] = React.useState(false);
  
  // Dispute Verdict Modal State
  const [verdictModalVisible, setVerdictModalVisible] = React.useState(false);
  const [disputeVerdict, setDisputeVerdict] = React.useState('');
  const [disputeRefundAmount, setDisputeRefundAmount] = React.useState(0);

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

  React.useEffect(() => {
    if (!user) return;

    // Listen to user doc for balances
    const userRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWalletBalance(data.walletBalance !== undefined ? data.walletBalance : 0);
        setHoldingBalance(data.holdingBalance !== undefined ? data.holdingBalance : 0);
      } else {
        setWalletBalance(0);
        setHoldingBalance(0);
      }
    });

    // Listen to separate transactions collection
    const txQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid)
    );
    const unsubTx = onSnapshot(txQuery, (snapshot) => {
      const fetchedTxs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      // Sort in-memory descending by timestamp
      fetchedTxs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      setTransactions(fetchedTxs);
    }, (err) => {
      console.error("[Transactions Listener] Error fetching transactions:", err);
    });

    return () => {
      unsubUser();
      unsubTx();
    };
  }, [user]);

  const handleDepositSimulation = async (amount: number) => {
    if (!user) return;
    setDepositing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users/${user.uid}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert("Deposit Success", `Rs. ${amount.toLocaleString()} has been added to your spendable wallet!`);
      } else {
        throw new Error(data.error || "Failed to complete deposit");
      }
    } catch (err: any) {
      console.warn("[Deposit Simulation] API error, using direct Firestore fallback:", err.message);
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const currentWallet = userSnap.exists() ? (userSnap.data().walletBalance ?? 0) : 0;
        const name = userSnap.exists() ? (userSnap.data().name || 'Guest User') : 'Guest User';
        
        await updateDoc(userRef, {
          walletBalance: currentWallet + amount
        });

        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          userName: name,
          providerId: 'system',
          providerName: 'Wasila Platform',
          bookingId: 'deposit_simulation',
          amount: amount,
          type: 'deposit',
          description: `Rs. ${amount.toLocaleString()} deposited via simulation card (offline)`,
          timestamp: new Date().toISOString()
        });

        Alert.alert("Deposit Success", `Rs. ${amount.toLocaleString()} has been added via local offline fallback!`);
      } catch (innerErr: any) {
        Alert.alert("Error", innerErr.message || "Failed to simulate deposit");
      }
    } finally {
      setDepositing(false);
    }
  };

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
    setRatingSubmitting(true);
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
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handleLater = () => {
    if (selectedBookingToRate) {
      setDismissedBookingIds(prev => [...prev, selectedBookingToRate.id]);
    }
    setRatingModalVisible(false);
    setSelectedBookingToRate(null);
  };

  const handleCancelBooking = (booking: any) => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Cancel", 
          style: "destructive",
          onPress: async () => {
            setCancellingBookingId(booking.id);
            try {
              if (!user) return;
              if (user.role === 'provider' && (booking.status === 'accepted' || booking.status === 'pending')) {
                const response = await fetch(`${API_BASE_URL}/bookings/${booking.id}/provider-cancel`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();
                if (response.ok) {
                  const alertMsg = booking.status === 'pending'
                    ? "Booking request decline ho gayi hai. Kisi penalty ke baghair recovery trigger ho gayi hai."
                    : "Booking cancel ho gayi hai aur aapka reliability score penalize kiya gaya hai.";
                  Alert.alert("Booking Cancelled", alertMsg);
                } else {
                  throw new Error(data.error || "Failed to cancel booking");
                }
              } else {
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                const currentWallet = userSnap.exists() ? (userSnap.data().walletBalance ?? 0) : 0;
                const currentHolding = userSnap.exists() ? (userSnap.data().holdingBalance ?? 0) : 0;
                const refundAmount = booking.price || 0;

                const txId = 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
                const userName = userSnap.exists() ? (userSnap.data().name || 'Customer') : 'Customer';
                const newTransaction = {
                  id: txId,
                  userId: user.uid,
                  userName: userName,
                  providerId: booking.providerId || booking.serviceId || 'unknown',
                  providerName: booking.providerName || 'Professional',
                  bookingId: booking.id,
                  amount: refundAmount,
                  type: 'refund',
                  description: `Rs. ${refundAmount.toLocaleString()} refunded for cancellation of booking with ${booking.providerName}`,
                  timestamp: new Date().toISOString()
                };

                await updateDoc(userRef, {
                  walletBalance: currentWallet + refundAmount,
                  holdingBalance: Math.max(0, currentHolding - refundAmount)
                });

                await addDoc(collection(db, 'transactions'), newTransaction);

                await updateDoc(doc(db, 'bookings', booking.id), {
                  status: 'declined',
                  paymentStatus: 'refunded',
                  timestamp: new Date().toISOString()
                });

                Alert.alert("Booking Cancelled", "The booking has been successfully cancelled.");
              }
            } catch (error: any) {
              console.error("Error cancelling booking:", error);
              Alert.alert("Error", error.message);
            } finally {
              setCancellingBookingId(null);
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

    setRescheduling(true);
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
    } finally {
      setRescheduling(false);
    }
  };

  const handleOpenDispute = (booking: any) => {
    setSelectedBookingToDispute(booking);
    setDisputeIssueType('no_show');
    setDisputeDetails('');
    setDisputeModalVisible(true);
  };

  const handleDisputeSubmit = async () => {
    if (!selectedBookingToDispute) return;
    if (!disputeDetails.trim()) {
      Alert.alert("Ghalti", "Bara-e-meharbani shikayat ki tafseel likhein.");
      return;
    }

    setDisputeSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: selectedBookingToDispute.id,
          issueType: disputeIssueType,
          details: disputeDetails
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setDisputeVerdict(data.verdict);
        setDisputeRefundAmount(data.refundAmount || 0);
        setDisputeModalVisible(false);
        setVerdictModalVisible(true);
      } else {
        throw new Error(data.error || "Dispute processing failed");
      }
    } catch (error: any) {
      console.error("Error submitting dispute:", error);
      Alert.alert("Ghalti", error.message || "Shikayat submit karne mein masla pesh aya.");
    } finally {
      setDisputeSubmitting(false);
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
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
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

            <TouchableOpacity style={styles.walletHeaderBtn} onPress={() => setWalletModalVisible(true)}>
              <Ionicons name="wallet-outline" size={18} color={THEME.colors.primary} />
              <Typography variant="body" weight="bold" style={styles.walletHeaderBalance}>
                Rs. {walletBalance.toLocaleString()}
              </Typography>
            </TouchableOpacity>
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
                  
                  {/* Action buttons if not completed/declined/cancelled */}
                  {booking.status !== 'completed' && 
                   booking.status !== 'declined' && 
                   !booking.status?.toLowerCase().includes('cancel') && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity 
                        style={[styles.rescheduleBtn, rescheduleBookingId === booking.id && { opacity: 0.7 }]} 
                        onPress={() => handleOpenReschedule(booking)}
                        disabled={rescheduleBookingId === booking.id || cancellingBookingId === booking.id}
                      >
                        <Typography variant="caption" weight="bold">Reschedule</Typography>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.cancelBtn, cancellingBookingId === booking.id && { opacity: 0.7 }]} 
                        onPress={() => handleCancelBooking(booking)}
                        disabled={rescheduleBookingId === booking.id || cancellingBookingId === booking.id}
                      >
                        {cancellingBookingId === booking.id ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Typography variant="caption" weight="bold" color="inverse">Cancel</Typography>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Dispute/Shikayat button for customer on active/completed bookings */}
                  {user.role !== 'provider' && 
                   ['accepted', 'arrived', 'completed'].includes(booking.status?.toLowerCase()) && (
                    <View style={styles.disputeRow}>
                      <TouchableOpacity 
                        style={styles.disputeBtn} 
                        onPress={() => handleOpenDispute(booking)}
                      >
                        <Ionicons name="warning-outline" size={16} color="#EF4444" />
                        <Typography variant="caption" weight="bold" style={{ color: '#EF4444', marginLeft: 6 }}>
                          Report Issue (Shikayat)
                        </Typography>
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
                style={[styles.modalBtn, styles.modalSubmitBtn, rescheduling && { opacity: 0.7 }]} 
                onPress={handleRescheduleSubmit}
                disabled={rescheduling}
              >
                {rescheduling ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Typography variant="body" color="inverse" weight="bold">Save</Typography>
                )}
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
                style={[styles.modalBtn, styles.modalSubmitBtn, ratingSubmitting && { opacity: 0.7 }]} 
                onPress={handleRatingSubmit}
                disabled={ratingSubmitting}
              >
                {ratingSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Typography variant="body" color="inverse" weight="bold">Submit</Typography>
                )}
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </Modal>

      {/* Dispute Modal */}
      <Modal
        visible={disputeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDisputeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card customStyle={styles.modalCard}>
            <Typography variant="h2" weight="bold" style={{ marginBottom: 8 }}>Shikayat Darj Karein</Typography>
            <Typography variant="body" color="muted" style={{ marginBottom: 16 }}>
              Apni booking ke mutaliq masla select karein aur tafseel faraham karein.
            </Typography>
            
            {/* Issue Selection */}
            <Typography variant="caption" weight="bold" style={{ marginBottom: 8, color: '#4F46E5' }}>MASLA SELECT KAREIN:</Typography>
            
            <View style={{ gap: 8, marginBottom: 16 }}>
              {/* Option 1: No-Show (Active) */}
              <TouchableOpacity 
                style={[
                  styles.issueOption, 
                  disputeIssueType === 'no_show' && styles.issueOptionSelected
                ]}
                onPress={() => setDisputeIssueType('no_show')}
              >
                <Ionicons name="calendar-outline" size={20} color={disputeIssueType === 'no_show' ? '#FFF' : '#EF4444'} />
                <Typography 
                  variant="body" 
                  weight="medium" 
                  style={{ marginLeft: 8, color: disputeIssueType === 'no_show' ? '#FFF' : '#1E293B' }}
                >
                  Provider nahi aya (No-Show)
                </Typography>
              </TouchableOpacity>

              {/* Option 2: Overcharge (Coming Soon) */}
              <TouchableOpacity 
                style={[
                  styles.issueOption, 
                  styles.issueOptionDisabled,
                  disputeIssueType === 'overcharge' && styles.issueOptionSelected
                ]}
                onPress={() => {
                  Alert.alert("Notice", "Ziada paise lene ki shikayat aglay chunk me active hogi. Abhi testing ke liye sirf 'Provider nahi aya' select karein.");
                }}
              >
                <Ionicons name="cash-outline" size={20} color="#94A3B8" />
                <Typography variant="body" style={{ marginLeft: 8, color: '#94A3B8' }}>
                  Ziada paise liye (Overcharge) - Jald Asy
                </Typography>
              </TouchableOpacity>

              {/* Option 3: Late Arrival (Coming Soon) */}
              <TouchableOpacity 
                style={[
                  styles.issueOption, 
                  styles.issueOptionDisabled
                ]}
                onPress={() => {
                  Alert.alert("Notice", "Late aane ki shikayat aglay chunk me active hogi. Abhi testing ke liye sirf 'Provider nahi aya' select karein.");
                }}
              >
                <Ionicons name="time-outline" size={20} color="#94A3B8" />
                <Typography variant="body" style={{ marginLeft: 8, color: '#94A3B8' }}>
                  Late aya (Late Arrival) - Jald Asy
                </Typography>
              </TouchableOpacity>

              {/* Option 4: Poor Quality (Coming Soon) */}
              <TouchableOpacity 
                style={[
                  styles.issueOption, 
                  styles.issueOptionDisabled
                ]}
                onPress={() => {
                  Alert.alert("Notice", "Kaam kharab hone ki shikayat aglay chunk me active hogi. Abhi testing ke liye sirf 'Provider nahi aya' select karein.");
                }}
              >
                <Ionicons name="alert-circle-outline" size={20} color="#94A3B8" />
                <Typography variant="body" style={{ marginLeft: 8, color: '#94A3B8' }}>
                  Kaam kharab kiya (Poor Quality) - Jald Asy
                </Typography>
              </TouchableOpacity>
            </View>

            {/* Details Input */}
            <Typography variant="caption" weight="bold" style={{ marginBottom: 6, color: '#4F46E5' }}>TAFSEEL (DETAILS):</Typography>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
              placeholder="Shikayat ki tafseel likhein, e.g., Plumber scheduled time par nahi aya aur call bhi attend nahi ki..."
              placeholderTextColor="#94A3B8"
              value={disputeDetails}
              onChangeText={setDisputeDetails}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalCancelBtn]} 
                onPress={() => setDisputeModalVisible(false)}
              >
                <Typography variant="body" weight="bold">Wapas</Typography>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalSubmitBtn, disputeSubmitting && { opacity: 0.7 }]} 
                onPress={handleDisputeSubmit}
                disabled={disputeSubmitting}
              >
                {disputeSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Typography variant="body" color="inverse" weight="bold">Bheinjein</Typography>
                )}
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </Modal>

      {/* Dispute Verdict Modal */}
      <Modal
        visible={verdictModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setVerdictModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card customStyle={styles.modalCard}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ 
                width: 56, 
                height: 56, 
                borderRadius: 28, 
                backgroundColor: disputeRefundAmount > 0 ? '#10B98115' : '#EF444415',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 12
              }}>
                <Ionicons 
                  name={disputeRefundAmount > 0 ? "checkmark-circle-outline" : "close-circle-outline"} 
                  size={36} 
                  color={disputeRefundAmount > 0 ? "#10B981" : "#EF4444"} 
                />
              </View>
              <Typography variant="h2" weight="bold">Dispute Resolution</Typography>
            </View>

            <Typography variant="body" style={{ textAlign: 'center', marginBottom: 20, lineHeight: 22 }}>
              {disputeVerdict}
            </Typography>

            {disputeRefundAmount > 0 && (
              <View style={{ 
                backgroundColor: '#F1F5F9', 
                borderRadius: 12, 
                padding: 16, 
                marginBottom: 24,
                alignItems: 'center'
              }}>
                <Typography variant="caption" color="muted">REFUNDED TO WALLET</Typography>
                <Typography variant="h2" weight="bold" color="primary" style={{ marginTop: 4 }}>
                  Rs. {disputeRefundAmount.toLocaleString()}
                </Typography>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.modalBtn, styles.modalSubmitBtn, { width: '100%' }]} 
              onPress={() => setVerdictModalVisible(false)}
            >
              <Typography variant="body" color="inverse" weight="bold">Theek Hai</Typography>
            </TouchableOpacity>
          </Card>
        </View>
      </Modal>

      {/* Wallet Modal */}
      <Modal
        visible={walletModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWalletModalVisible(false)}
      >
        <View style={styles.walletModalOverlay}>
          <View style={styles.walletModalContainer}>
            {/* Header */}
            <View style={styles.walletModalHeader}>
              <Typography variant="h2" weight="bold">Wasila Wallet</Typography>
              <TouchableOpacity onPress={() => setWalletModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Premium Wallet Balances Card */}
            <View style={styles.glassWalletCard}>
              <View style={{ marginBottom: 14 }}>
                <Typography variant="caption" style={{ color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Spendable Balance
                </Typography>
                <Typography variant="h1" weight="bold" style={{ color: '#FFFFFF', fontSize: 32, marginTop: 4 }}>
                  Rs. {walletBalance.toLocaleString()}
                </Typography>
              </View>
              
              <View style={styles.walletCardDivider} />
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Typography variant="caption" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    Locked in Escrow (Holding)
                  </Typography>
                  <Typography variant="body" weight="bold" style={{ color: '#FFFFFF', marginTop: 2 }}>
                    Rs. {holdingBalance.toLocaleString()}
                  </Typography>
                </View>
                <Ionicons name="lock-closed" size={20} color="rgba(255, 255, 255, 0.8)" />
              </View>
            </View>

            {/* Deposit Simulator Section */}
            <View style={styles.depositSection}>
              <Typography variant="body" weight="bold" style={{ marginBottom: 10 }}>
                Demo Deposit Simulator
              </Typography>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity 
                  style={[styles.depositBtn, depositing && { opacity: 0.7 }]} 
                  onPress={() => handleDepositSimulation(2000)}
                  disabled={depositing}
                >
                  {depositing ? (
                    <ActivityIndicator size="small" color={THEME.colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={16} color={THEME.colors.primary} />
                      <Typography variant="caption" weight="bold" style={{ marginLeft: 6, color: THEME.colors.primary }}>
                        + Rs. 2,000
                      </Typography>
                    </>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.depositBtn, depositing && { opacity: 0.7 }]} 
                  onPress={() => handleDepositSimulation(5000)}
                  disabled={depositing}
                >
                  {depositing ? (
                    <ActivityIndicator size="small" color={THEME.colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={16} color={THEME.colors.primary} />
                      <Typography variant="caption" weight="bold" style={{ marginLeft: 6, color: THEME.colors.primary }}>
                        + Rs. 5,000
                      </Typography>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Transaction History List */}
            <Typography variant="body" weight="bold" style={{ marginBottom: 12 }}>
              Transaction History
            </Typography>

            {transactions.length > 0 ? (
              <ScrollView style={styles.transList} showsVerticalScrollIndicator={false}>
                {transactions.map((item) => {
                  const isCredit = item.type === 'deposit' || item.type === 'refund';
                  return (
                    <View key={item.id} style={styles.transItem}>
                      <View style={[styles.transIconWrapper, { backgroundColor: isCredit ? '#10B98115' : '#EF444415' }]}>
                        <Ionicons 
                          name={isCredit ? "arrow-down-outline" : "arrow-up-outline"} 
                          size={18} 
                          color={isCredit ? "#10B981" : "#EF4444"} 
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Typography variant="body" weight="medium" style={{ fontSize: 13 }} numberOfLines={1}>
                          {item.description}
                        </Typography>
                        <Typography variant="caption" color="muted" style={{ fontSize: 10, marginTop: 2 }}>
                          {new Date(item.timestamp).toLocaleString()}
                        </Typography>
                      </View>
                      <Typography 
                        variant="body" 
                        weight="bold" 
                        style={{ color: isCredit ? "#10B981" : "#EF4444", fontSize: 14 }}
                      >
                        {isCredit ? '+' : '-'} Rs. {Number(item.amount).toLocaleString()}
                      </Typography>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="receipt-outline" size={36} color="#CBD5E1" />
                <Typography variant="caption" color="muted" style={{ marginTop: 8 }}>
                  No transactions yet.
                </Typography>
              </View>
            )}
          </View>
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
  },
  walletHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...THEME.shadows.sm,
  },
  walletHeaderBalance: {
    marginLeft: 6,
    color: '#0F172A',
    fontSize: 14,
  },
  walletModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  walletModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    height: '80%',
    ...THEME.shadows.lg,
  },
  walletModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  glassWalletCard: {
    backgroundColor: '#4F46E5',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    ...THEME.shadows.md,
  },
  walletCardDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginVertical: 14,
  },
  depositSection: {
    marginBottom: 24,
  },
  depositBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  depositBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  transList: {
    flex: 1,
  },
  transItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  transIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disputeRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  disputeBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF444430',
    backgroundColor: '#EF444408',
    flexDirection: 'row',
  },
  issueOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  issueOptionSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#4F46E5',
  },
  issueOptionDisabled: {
    opacity: 0.6,
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
});
