import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { THEME } from '../theme';
import { Typography } from '../components/ui/Typography';
import { useAuthStore } from '../store/useAuthStore';
import { db } from '../lib/firebase';

const { width } = Dimensions.get('window');

interface Dispute {
  id: string;
  bookingId: string;
  userId: string;
  userName: string;
  providerId: string;
  providerName: string;
  issueType: 'overcharge' | 'no_show' | 'late_arrival' | 'poor_quality';
  details: string;
  status: 'pending' | 'resolved' | 'rejected' | 'pending_provider_response';
  resolutionAction: string;
  refundAmount: number;
  verdictSummary: string;
  timestamp: string;
}

export default function ComplaintsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [complaints, setComplaints] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'resolved'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Filter disputes based on user role
    const disputesRef = collection(db, 'disputes');
    let disputesQuery = query(
      disputesRef,
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    if (user.role === 'provider') {
      disputesQuery = query(
        disputesRef,
        where('providerId', '==', user.uid),
        orderBy('timestamp', 'desc')
      );
    }

    const unsubscribe = onSnapshot(disputesQuery, (snapshot) => {
      const docsList: Dispute[] = [];
      snapshot.forEach((doc) => {
        docsList.push(doc.data() as Dispute);
      });
      setComplaints(docsList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching disputes:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredComplaints = complaints.filter((c) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') {
      return c.status === 'pending' || c.status === 'pending_provider_response';
    }
    if (activeTab === 'resolved') {
      return c.status === 'resolved' || c.status === 'rejected';
    }
    return true;
  });

  const getIssueLabel = (type: string) => {
    switch (type) {
      case 'no_show': return 'Provider Nahi Aya (No-Show)';
      case 'overcharge': return 'Ziada Paise Liye (Overcharge)';
      case 'late_arrival': return 'Late Arrival (Deeri)';
      case 'poor_quality': return 'Kharab Kaam (Poor Quality)';
      default: return type;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'resolved':
        return { 
          bg: '#D1FAE5', 
          text: '#065F46', 
          label: 'Hal Shuda (Resolved)', 
          icon: 'checkmark-circle-outline' as const 
        };
      case 'rejected':
        return { 
          bg: '#FEE2E2', 
          text: '#991B1B', 
          label: 'Radd Shuda (Rejected)', 
          icon: 'close-circle-outline' as const 
        };
      case 'pending':
      case 'pending_provider_response':
      default:
        return { 
          bg: '#FEF3C7', 
          text: '#92400E', 
          label: 'Zair-e-Ghor (Pending)', 
          icon: 'time-outline' as const 
        };
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Typography variant="h2" weight="bold">Shikayaat (Complaints)</Typography>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Typography 
            variant="body" 
            weight={activeTab === 'all' ? 'bold' : 'medium'}
            style={{ color: activeTab === 'all' ? THEME.colors.primary : '#64748B' }}
          >
            Sab (All)
          </Typography>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Typography 
            variant="body" 
            weight={activeTab === 'pending' ? 'bold' : 'medium'}
            style={{ color: activeTab === 'pending' ? THEME.colors.primary : '#64748B' }}
          >
            Zair-e-Ghor
          </Typography>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'resolved' && styles.activeTab]}
          onPress={() => setActiveTab('resolved')}
        >
          <Typography 
            variant="body" 
            weight={activeTab === 'resolved' ? 'bold' : 'medium'}
            style={{ color: activeTab === 'resolved' ? THEME.colors.primary : '#64748B' }}
          >
            Faisla Shuda
          </Typography>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      ) : filteredComplaints.length > 0 ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {filteredComplaints.map((item) => {
            const statusConfig = getStatusStyle(item.status);
            const isExpanded = expandedId === item.id;

            return (
              <TouchableOpacity 
                key={item.id} 
                style={[
                  styles.card,
                  { borderLeftColor: item.status === 'resolved' ? '#10B981' : item.status === 'rejected' ? '#EF4444' : '#F59E0B' }
                ]}
                activeOpacity={0.9}
                onPress={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Typography variant="caption" color="muted" style={{ fontSize: 10 }}>
                      DISPUTE ID: {item.id}
                    </Typography>
                    <Typography variant="body" weight="bold" style={{ fontSize: 15, marginTop: 2 }}>
                      {getIssueLabel(item.issueType)}
                    </Typography>
                  </View>
                  
                  {/* Status Badge */}
                  <View style={[styles.badge, { backgroundColor: statusConfig.bg }]}>
                    <Ionicons name={statusConfig.icon} size={12} color={statusConfig.text} />
                    <Typography variant="caption" weight="bold" style={{ color: statusConfig.text, marginLeft: 4, fontSize: 10 }}>
                      {statusConfig.label}
                    </Typography>
                  </View>
                </View>

                <View style={styles.cardMeta}>
                  <View style={styles.metaRow}>
                    <Ionicons name="person-outline" size={14} color="#64748B" />
                    <Typography variant="caption" style={{ marginLeft: 6, color: '#475569' }}>
                      {user?.role === 'provider' ? `Customer: ${item.userName}` : `Provider: ${item.providerName}`}
                    </Typography>
                  </View>

                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={14} color="#64748B" />
                    <Typography variant="caption" style={{ marginLeft: 6, color: '#475569' }}>
                      {new Date(item.timestamp).toLocaleDateString()}
                    </Typography>
                  </View>
                </View>

                {/* Expanded Section */}
                {isExpanded ? (
                  <View style={styles.expandedContent}>
                    <View style={styles.divider} />
                    
                    <Typography variant="caption" weight="bold" style={{ color: '#4F46E5', marginBottom: 4 }}>
                      AAP KI DETAILS (COMPLAINT):
                    </Typography>
                    <Typography variant="body" style={styles.detailsText}>
                      "{item.details}"
                    </Typography>

                    {item.verdictSummary ? (
                      <View style={styles.verdictBox}>
                        <Typography variant="caption" weight="bold" style={{ color: '#059669', marginBottom: 4 }}>
                          📌 DISPUTE AGENT DECISION (FAISLA):
                        </Typography>
                        <Typography variant="body" weight="medium" style={styles.verdictText}>
                          {item.verdictSummary}
                        </Typography>
                        {item.refundAmount > 0 && (
                          <Typography variant="body" weight="bold" style={{ color: '#059669', marginTop: 8 }}>
                            Refunded Wallet Amount: Rs. {item.refundAmount}
                          </Typography>
                        )}
                      </View>
                    ) : (
                      <View style={styles.pendingBox}>
                        <Typography variant="body" style={{ color: '#D97706', fontSize: 13 }} weight="medium">
                          🕒 Dispute Resolution Agent is currently investigating evidence.
                        </Typography>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.expandPrompt}>
                    <Typography variant="caption" color="muted">
                      Tap card to see verdict & details
                    </Typography>
                    <Ionicons name="chevron-down" size={14} color="#94A3B8" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={64} color="#94A3B8" />
          <Typography variant="h3" style={{ marginTop: 16 }}>No complaints found.</Typography>
          <Typography variant="caption" color="muted" style={{ marginTop: 6 }}>
            Aap ne abhi tak koi shikayat darj nahi ki hai.
          </Typography>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: THEME.colors.primary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandPrompt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  expandedContent: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
  },
  detailsText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  verdictBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verdictText: {
    fontSize: 13,
    color: '#047857',
    lineHeight: 18,
  },
  pendingBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
});
