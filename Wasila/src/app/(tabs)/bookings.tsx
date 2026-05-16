import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { THEME } from '../../theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useRouter } from 'expo-router';

const BOOKINGS = [
  { 
    id: '1', 
    service: 'AC Repair & Service', 
    provider: 'Ali Raza', 
    date: 'Tomorrow, 10:00 AM', 
    status: 'Confirmed',
    price: 'Rs. 1500',
    icon: 'snow-outline',
    color: '#3B82F6'
  },
  { 
    id: '2', 
    service: 'Deep Home Cleaning', 
    provider: 'Usman Khan', 
    date: 'May 12, 2026', 
    status: 'Completed',
    price: 'Rs. 2500',
    icon: 'sparkles-outline',
    color: '#4F46E5'
  },
];

export default function BookingsScreen() {
  const { user } = useAuthStore();
  const router = useRouter();

  return (
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
          <Typography variant="h2" weight="bold" style={{ marginLeft: 12 }}>My Bookings</Typography>
        </View>
        <TouchableOpacity style={styles.filterBtn}>
          <Ionicons name="filter-outline" size={20} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {BOOKINGS.map((booking) => (
          <Card key={booking.id} customStyle={styles.bookingCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrapper, { backgroundColor: `${booking.color}15` }]}>
                <Ionicons name={booking.icon as any} size={24} color={booking.color} />
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Typography variant="body" weight="bold">{booking.service}</Typography>
                <Typography variant="caption" color="muted">{booking.date}</Typography>
              </View>
              <View style={[
                styles.statusBadge, 
                { backgroundColor: booking.status === 'Confirmed' ? '#F59E0B20' : '#10B98120' }
              ]}>
                <Typography 
                  variant="caption" 
                  weight="bold" 
                  style={{ color: booking.status === 'Confirmed' ? '#F59E0B' : '#10B981' }}
                >
                  {booking.status}
                </Typography>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.cardFooter}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="person-circle-outline" size={20} color="#64748B" />
                <Typography variant="caption" style={{ marginLeft: 6 }}>{booking.provider}</Typography>
              </View>
              <Typography variant="body" weight="bold" color="primary">{booking.price}</Typography>
            </View>
            
            {booking.status === 'Confirmed' && (
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.rescheduleBtn}>
                  <Typography variant="caption" weight="bold">Reschedule</Typography>
                </TouchableOpacity>
                <TouchableOpacity style={styles.detailsBtn}>
                  <Typography variant="caption" weight="bold" color="inverse">View Details</Typography>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        ))}
      </View>
    </ScrollView>
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
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.sm,
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
  detailsBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
  }
});
