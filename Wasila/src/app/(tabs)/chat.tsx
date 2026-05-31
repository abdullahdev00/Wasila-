import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text,
  TextInput, 
  FlatList, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  ScrollView,
  Linking
} from 'react-native';
import { db } from '../../lib/firebase';
import { doc, getDoc, collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';
import { Typography } from '../../components/ui/Typography';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { API_BASE_URL } from '../../lib/apiConfig';
import { useAuthStore } from '../../store/useAuthStore';

type Trace = { agent: string; step: string; detail: any };
type ProviderMatch = { 
  id?: string; 
  name: string; 
  providerName?: string; 
  rating: number; 
  pricePerHour: number; 
  location: string; 
  category: string; 
  skills?: string[]; 
  finalScore?: number;
  negotiatedDateTime?: string;
  negotiatedStatus?: string;
  negotiationTraces?: string[];
  isExternal?: boolean;
  phone?: string;
};

type Message = {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  traces?: Trace[];
  bestMatch?: ProviderMatch;
  workplan?: string[];
  isError?: boolean;
  bookingConfirmed?: boolean;
};

const renderFormattedText = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const cleanText = part.slice(2, -2);
      return (
        <Text key={index} style={{ fontFamily: THEME.fonts.bold, fontWeight: '700' }}>
          {cleanText}
        </Text>
      );
    }
    return <Text key={index}>{part}</Text>;
  });
};

const MessageBubble = ({ item }: { item: Message }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [showSlotSheet, setShowSlotSheet] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('Tomorrow');
  const [selectedSlot, setSelectedSlot] = useState<string>('11:00 AM - 01:00 PM');
  
  const isUser = item.sender === 'user';
  const { user } = useAuthStore();

  const handleBookNow = () => {
    if (!user) {
      Alert.alert(
        "Login Required",
        "You must be logged in to book a service.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Login", onPress: () => router.push('/(auth)/login') }
        ]
      );
      return;
    }

    if (!item.bestMatch || !item.bestMatch.id) {
      Alert.alert("Error", "Invalid service provider selection.");
      return;
    }

    setShowSlotSheet(true);
  };

  const confirmBookingWithSlot = async () => {
    const match = item.bestMatch;
    if (!match || !match.id || !user) return;

    try {
      setIsBookingLoading(true);
      setShowSlotSheet(false);

      const serviceSnap = await getDoc(doc(db, 'services', match.id));
      if (!serviceSnap.exists()) {
        setIsBookingLoading(false);
        Alert.alert("Error", "Service details not found in database.");
        return;
      }
      const serviceData = serviceSnap.data();

      const bookingsCol = collection(db, 'bookings');
      const newBooking = {
        userId: user.uid,
        userName: user.name || 'Guest User',
        userPhotoURL: user.photoURL || '',
        serviceId: match.id,
        serviceName: serviceData.name || match.name,
        category: serviceData.category || match.category || 'General',
        price: match.pricePerHour || serviceData.price || 0,
        providerId: serviceData.providerId || match.id,
        providerName: serviceData.providerName || match.name,
        providerPhotoURL: serviceData.providerPhotoURL || '',
        status: 'pending',
        date: `${selectedDate}, ${selectedSlot}`,
        timestamp: new Date().toISOString(),
        notes: 'Booking created via AI search suggestion card.'
      };

      console.log("[Chat Match Booking] Creating booking with slot:", newBooking);
      await addDoc(bookingsCol, newBooking);
      
      setIsBookingLoading(false);
      Alert.alert(
        "Booking Confirmed!",
        `Your booking for ${selectedDate} at ${selectedSlot} has been successfully created.`,
        [{ text: "OK", onPress: () => router.replace('/(tabs)/bookings') }]
      );
    } catch (error: any) {
      setIsBookingLoading(false);
      console.error("Error creating match booking:", error);
      Alert.alert("Booking Failed", error.message);
    }
  };

  return (
    <View style={[styles.messageWrapper, isUser ? styles.messageWrapperUser : styles.messageWrapperAI]}>
      {!isUser && item.traces && (
        <View style={styles.thinkingWrapper}>
          <TouchableOpacity 
            onPress={() => setIsExpanded(!isExpanded)}
            style={styles.thinkingHeader}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="sparkles" size={14} color="#6366F1" style={{ marginRight: 6 }} />
              <Typography variant="caption" weight="bold" style={{ color: '#6366F1' }}>
                Thinking...
              </Typography>
            </View>
            <Ionicons 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={16} 
              color="#6366F1" 
            />
          </TouchableOpacity>
          
          {isExpanded && (
            <View style={styles.traceContainer}>
              {item.traces.map((trace: any, i) => (
                <View key={i} style={{ marginTop: 6 }}>
                  {typeof trace === 'string' ? (
                    <Typography variant="caption" color="muted">
                      {trace}
                    </Typography>
                  ) : (
                    <View key={i}>
                      <Typography variant="caption" weight="bold" style={{ color: '#4F46E5' }}>⚙ {trace.agent}</Typography>
                      <Typography variant="caption" color="muted">
                        {typeof trace.detail === 'object' ? (trace.detail?.reasoning || trace.detail?.category || JSON.stringify(trace.detail).substring(0, 100)) : String(trace.detail)}
                      </Typography>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble, item.isError && styles.errorBubble]}>
        <Typography variant="body" style={{ color: isUser ? '#FFFFFF' : '#1E293B' }}>
          {renderFormattedText(item.text)}
        </Typography>
      </View>

      {!isUser && item.bestMatch && (
        <Card customStyle={styles.matchCard}>
          {item.bestMatch.isExternal && (
            <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 8, borderWidth: 1, borderColor: '#C7D2FE' }}>
              <Typography variant="caption" style={{ color: '#4F46E5', fontWeight: 'bold' }}>📍 Google Maps Search Listing</Typography>
            </View>
          )}
          <Typography variant="h3" color="primary" weight="bold">{item.bestMatch.name}</Typography>
          {item.bestMatch.providerName && (
            <Typography variant="body" weight="medium" style={{ marginTop: 2, marginBottom: 4, color: '#4B5563' }}>
              by {item.bestMatch.providerName}
            </Typography>
          )}
          <Typography variant="caption" color="muted">★ {item.bestMatch.rating || '5.0'} • {item.bestMatch.category}</Typography>
          {item.bestMatch.location && (
            <Typography variant="caption" color="muted">📍 {item.bestMatch.location}</Typography>
          )}
          
          <View style={styles.divider} />

          {item.bestMatch.isExternal ? (
            <View style={styles.pricingBox}>
              <Typography variant="body" weight="bold" style={{ color: '#0F172A' }}>
                Estimated Price: Rs. {item.bestMatch.pricePerHour || 1500}
              </Typography>
              {item.bestMatch.phone && (
                <Typography variant="body" style={{ marginTop: 6, color: '#4F46E5', fontWeight: 'bold' }}>
                  📞 {item.bestMatch.phone}
                </Typography>
              )}
            </View>
          ) : (
            <View style={styles.pricingBox}>
              <Typography variant="body" weight="bold">
                Price: Rs. {item.bestMatch.pricePerHour ? `${item.bestMatch.pricePerHour}` : 'Dynamic'}
              </Typography>
              {item.bestMatch.skills && (
                <Typography variant="caption" color="muted" style={{ marginTop: 4 }}>
                  Skills: {item.bestMatch.skills.join(', ')}
                </Typography>
              )}
            </View>
          )}

          {item.bestMatch.isExternal ? (
            <TouchableOpacity 
              style={[styles.bookNowBtn, { backgroundColor: '#10B981', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]} 
              onPress={() => {
                if (item.bestMatch?.phone) {
                  Linking.openURL(`tel:${item.bestMatch.phone}`);
                } else {
                  Alert.alert("Contact Unavailable", "Is provider ka contact number dastyab nahi hai.");
                }
              }}
            >
              <Ionicons name="call" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Typography color="inverse" weight="bold">Call Provider</Typography>
            </TouchableOpacity>
          ) : item.bookingConfirmed ? (
            <View style={[styles.bookNowBtn, { backgroundColor: '#10B981', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Typography color="inverse" weight="bold">Booked Successfully</Typography>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.bookNowBtn, isBookingLoading && { backgroundColor: '#CBD5E1' }]} 
              onPress={handleBookNow}
              disabled={isBookingLoading}
            >
              {isBookingLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Typography color="inverse" weight="bold">Book Now</Typography>
              )}
            </TouchableOpacity>
          )}
        </Card>
      )}

      <Modal
        visible={showSlotSheet}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSlotSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetContent}>
            <View style={styles.sheetHeader}>
              <Typography variant="h3" weight="bold">Select Time Slot</Typography>
              <TouchableOpacity onPress={() => setShowSlotSheet(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <Typography variant="body" color="muted" style={{ marginBottom: 16 }}>
              Choose a date and arrival time slot for {item.bestMatch?.name}
            </Typography>

            <Typography variant="body" weight="bold" style={{ marginBottom: 10 }}>Select Date</Typography>
            <View style={styles.dateRow}>
              {['Today', 'Tomorrow', 'Day After'].map((d) => {
                const isSel = selectedDate === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.dateTab, isSel && styles.dateTabActive]}
                    onPress={() => setSelectedDate(d)}
                  >
                    <Typography 
                      variant="body" 
                      weight="bold" 
                      style={{ color: isSel ? '#FFFFFF' : '#0F172A' }}
                    >
                      {d}
                    </Typography>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Typography variant="body" weight="bold" style={{ marginTop: 20, marginBottom: 10 }}>Select Time Slot</Typography>
            <ScrollView contentContainerStyle={styles.slotsGrid}>
              {[
                "09:00 AM - 11:00 AM",
                "11:00 AM - 01:00 PM",
                "01:00 PM - 03:00 PM",
                "03:00 PM - 05:00 PM",
                "05:00 PM - 07:00 PM"
              ].map((slot) => {
                const isSel = selectedSlot === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.slotItem, isSel && styles.slotItemActive]}
                    onPress={() => setSelectedSlot(slot)}
                  >
                    <Ionicons 
                      name="time-outline" 
                      size={16} 
                      color={isSel ? '#FFFFFF' : '#4F46E5'} 
                      style={{ marginRight: 8 }} 
                    />
                    <Typography 
                      variant="body" 
                      weight="medium" 
                      style={{ color: isSel ? '#FFFFFF' : '#0F172A' }}
                    >
                      {slot}
                    </Typography>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity 
              style={styles.confirmBtn}
              onPress={confirmBookingWithSlot}
            >
              <Typography color="inverse" weight="bold">Confirm & Book Now</Typography>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const THINKING_STAGES = [
  { agent: 'ParserAgent', detail: 'Parsing request intent and category...' },
  { agent: 'MatchmakerAgent', detail: 'Scanning active service providers...' },
  { agent: 'PricingAgent', detail: 'Evaluating base fee, distance, and surge quote...' },
  { agent: 'ConciergeAgent', detail: 'Formulating natural language response...' }
];

const ThinkingTraceLoader = ({ activeStep }: { activeStep: number }) => {
  return (
    <View style={styles.loaderWrapper}>
      <View style={styles.thinkingHeaderLoading}>
        <Ionicons name="sparkles" size={14} color="#6366F1" style={{ marginRight: 6 }} />
        <Typography variant="caption" weight="bold" style={{ color: '#6366F1' }}>
          Wasila AI is thinking...
        </Typography>
        <ActivityIndicator size="small" color="#6366F1" style={{ marginLeft: 8 }} />
      </View>
      
      <View style={styles.loaderTraceContainer}>
        {THINKING_STAGES.map((stage, idx) => {
          const isDone = idx < activeStep;
          const isActive = idx === activeStep;
          const isPending = idx > activeStep;
          
          return (
            <View key={idx} style={[styles.loaderTraceRow, isActive && styles.loaderTraceRowActive]}>
              <View style={styles.loaderStatusIcon}>
                {isDone && <Ionicons name="checkmark-circle" size={16} color="#10B981" />}
                {isActive && <ActivityIndicator size="small" color="#6366F1" style={{ transform: [{ scale: 0.8 }] }} />}
                {isPending && <Ionicons name="ellipse-outline" size={12} color="#94A3B8" />}
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Typography 
                  variant="caption" 
                  weight="bold" 
                  style={{ color: isActive ? '#4F46E5' : isDone ? '#10B981' : '#64748B' }}
                >
                  ⚙ {stage.agent}
                </Typography>
                <Typography 
                  variant="caption" 
                  style={{ color: isActive ? '#0F172A' : '#94A3B8', fontSize: 11 }}
                >
                  {stage.detail}
                </Typography>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default function ChatScreen() {
  const { user } = useAuthStore();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Assalam o Alaikum! Main Wasila AI Orchestrator hoon. Batayen main aapki kya madad kar sakta hoon?',
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const flatListRef = useRef<FlatList<any>>(null);

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [userChats, setUserChats] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [providerChats, setProviderChats] = useState<any[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);

  // Sync real-time query for customer (user) chats
  useEffect(() => {
    if (!user || user.role === 'provider') return;

    const q = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by updatedAt desc
      chats.sort((a: any, b: any) => {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA;
      });
      setUserChats(chats);
    }, (error) => {
      console.error("Error loading user chats:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Auto-hydrate screen with the messages of the most recent session on load
  useEffect(() => {
    if (userChats.length > 0 && !currentSessionId) {
      const latest = userChats[0];
      setCurrentSessionId(latest.id);
      if (latest.messages && latest.messages.length > 0) {
        setMessages(latest.messages);
      }
    }
  }, [userChats]);

  const startNewSession = () => {
    const newId = `chat_${user?.uid || 'guest'}_${Date.now()}`;
    setCurrentSessionId(newId);
    setMessages([
      {
        id: 'welcome',
        sender: 'ai',
        text: 'Assalam o Alaikum! Main Wasila AI Orchestrator hoon. Batayen main aapki kya madad kar sakta hoon?',
      }
    ]);
  };

  // Sync real-time query for provider chats
  useEffect(() => {
    if (!user || user.role !== 'provider') return;

    setLoadingChats(true);
    const q = query(
      collection(db, 'chats'),
      where('providerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by updatedAt desc
      chats.sort((a: any, b: any) => {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA;
      });
      setProviderChats(chats);
      setLoadingChats(false);
    }, (error) => {
      console.error("Error loading provider chats:", error);
      setLoadingChats(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Keep selected chat updated when Firestore messages sync
  useEffect(() => {
    if (selectedChat) {
      const updated = providerChats.find(c => c.id === selectedChat.id);
      if (updated) {
        setSelectedChat(updated);
      }
    }
  }, [providerChats]);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: inputText.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);
    setActiveStep(0);

    const sessionIdToUse = currentSessionId || `chat_${user?.uid || 'guest'}_${Date.now()}`;
    if (!currentSessionId) {
      setCurrentSessionId(sessionIdToUse);
    }

    const interval = setInterval(() => {
      setActiveStep(prev => {
        if (prev < THINKING_STAGES.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1500);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMsg.text,
          userId: user?.uid || 'guest',
          userName: user?.name || '',
          sessionId: sessionIdToUse,
          location: user?.address || user?.city || '',
          latitude: user?.latitude || null,
          longitude: user?.longitude || null
        })
      });
      
      const data = await response.json();

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: data.reply || 'Main samjha nahi, dobara batayen?',
        traces: data.traces,
        bestMatch: data.bestMatch,
        workplan: data.workplan,
        bookingConfirmed: data.bookingConfirmed,
      };

      setMessages(prev => [...prev, aiMsg]);

      if (data.bookingConfirmed) {
        Alert.alert(
          "Booking Confirmed!",
          `Aap ki booking ${data.bestMatch?.providerName || data.bestMatch?.name || 'Professional'} ke saath Rs. ${data.bestMatch?.pricePerHour || ''} mein confirm ho gayi hai!`,
          [{ text: "OK", onPress: () => router.replace('/(tabs)/bookings') }]
        );
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: 'Backend se connect nahi ho pa raha. Server check karein.',
        isError: true,
      }]);
    } finally {
      clearInterval(interval);
      setIsLoading(false);
      setActiveStep(0);
    }
  };

  const renderChatItem = ({ item }: { item: any }) => {
    const formattedDate = item.updatedAt 
      ? new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      : '';

    return (
      <TouchableOpacity 
        style={styles.chatCard}
        onPress={() => setSelectedChat(item)}
        activeOpacity={0.7}
      >
        <View style={styles.chatCardLeft}>
          {item.userPhotoURL ? (
            <Image source={{ uri: item.userPhotoURL }} style={styles.chatAvatar} />
          ) : (
            <View style={styles.chatAvatarPlaceholder}>
              <Text style={styles.chatAvatarText}>
                {(item.userName || 'C').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.chatCardInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Typography variant="body" weight="bold" color="main" style={{ flex: 1 }} numberOfLines={1}>
                {item.userName || 'Client'}
              </Typography>
              <Typography variant="caption" color="muted">
                {formattedDate}
              </Typography>
            </View>
            
            <Typography variant="caption" color="muted" style={{ marginTop: 2, marginBottom: 6, width: '90%' }} numberOfLines={1}>
              {item.lastMessage || 'Negotiating...'}
            </Typography>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <View style={styles.categoryBadge}>
                <Typography variant="caption" weight="bold" style={{ fontSize: 10, color: THEME.colors.primary }}>
                  {item.category?.toUpperCase() || 'GENERAL'}
                </Typography>
              </View>
              <Typography variant="caption" color="primary" weight="medium">
                View Logs →
              </Typography>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TouchableOpacity 
            onPress={() => {
              if (user?.role === 'provider' && selectedChat) {
                setSelectedChat(null);
              } else {
                router.back();
              }
            }}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          
          {user?.role === 'provider' && selectedChat ? (
            selectedChat.userPhotoURL ? (
              <Image source={{ uri: selectedChat.userPhotoURL }} style={styles.headerAvatarImg} />
            ) : (
              <View style={[styles.headerAvatar, { backgroundColor: '#4F46E5' }]}>
                <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>
                  {(selectedChat.userName || 'C').charAt(0).toUpperCase()}
                </Text>
              </View>
            )
          ) : (
            <View style={styles.headerAvatar}>
              <Ionicons name="sparkles" size={20} color="#FFFFFF" />
            </View>
          )}

          <View style={{ marginLeft: user?.role === 'provider' && selectedChat ? 12 : 0, flex: 1 }}>
            <Typography variant="h3" weight="bold">
              {user?.role === 'provider' 
                ? (selectedChat ? selectedChat.userName : 'Agent negotiations')
                : 'Wasila AI'
              }
            </Typography>
            <Typography variant="caption" color="primary">
              {user?.role === 'provider'
                ? (selectedChat ? `Category: ${selectedChat.category || 'General'}` : 'AI Supplier Agent Logs')
                : 'Orchestrator'
              }
            </Typography>
          </View>

          {user?.role !== 'provider' && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity 
                style={{ padding: 6, marginRight: 8 }}
                onPress={startNewSession}
              >
                <Ionicons name="add-circle-outline" size={26} color="#4F46E5" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ padding: 6 }}
                onPress={() => setShowHistoryModal(true)}
              >
                <Ionicons name="time-outline" size={26} color="#4F46E5" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {user?.role === 'provider' ? (
        selectedChat === null ? (
          loadingChats ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#4F46E5" />
            </View>
          ) : providerChats.length === 0 ? (
            <View style={styles.blankState}>
              <Ionicons name="chatbubbles-outline" size={64} color="#CBD5E1" />
              <Typography variant="h3" weight="bold" style={{ marginTop: 16 }}>No active negotiations</Typography>
              <Typography variant="body" color="muted" style={{ textAlign: 'center', marginTop: 8, paddingHorizontal: 32 }}>
                When customers chat with Wasila AI and get matched with you, your AI Supplier Agent's negotiation logs will appear here.
              </Typography>
            </View>
          ) : (
            <FlatList
              data={providerChats}
              keyExtractor={(item, index) => item.id || index.toString()}
              renderItem={renderChatItem}
              contentContainerStyle={{ padding: 20 }}
              showsVerticalScrollIndicator={false}
            />
          )
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              data={selectedChat.messages}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => <MessageBubble item={item} />}
              contentContainerStyle={styles.chatList}
              showsVerticalScrollIndicator={false}
            />
            <View style={styles.agentFooter}>
              <Ionicons name="shield-checkmark" size={20} color="#10B981" style={{ marginRight: 8 }} />
              <Typography variant="caption" style={{ color: '#065F46', flex: 1 }} weight="medium">
                Autonomous mode active. Your Supplier Agent is negotiating automatically.
              </Typography>
            </View>
          </View>
        )
      ) : (
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => item.id || index.toString()}
            renderItem={({ item }) => <MessageBubble item={item} />}
            contentContainerStyle={styles.chatList}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={isLoading ? <ThinkingTraceLoader activeStep={activeStep} /> : null}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="How can I help you?"
              value={inputText}
              onChangeText={setInputText}
              placeholderTextColor="#94A3B8"
              multiline
            />
            <TouchableOpacity 
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="send" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Past History Modal */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Typography variant="h3" weight="bold">Chat History</Typography>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {/* List */}
            {userChats.length === 0 ? (
              <View style={styles.modalEmptyState}>
                <Ionicons name="chatbox-ellipses-outline" size={48} color="#CBD5E1" />
                <Typography variant="body" color="muted" style={{ marginTop: 12 }}>No previous chats found.</Typography>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.modalListContainer}>
                {userChats.map((chat) => {
                  const isSelected = chat.id === currentSessionId;
                  const formattedDate = chat.updatedAt 
                    ? new Date(chat.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
                      new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <TouchableOpacity
                      key={chat.id}
                      style={[
                        styles.historyItem,
                        isSelected && styles.historyItemActive
                      ]}
                      onPress={() => {
                        setCurrentSessionId(chat.id);
                        if (chat.messages) {
                          setMessages(chat.messages);
                        }
                        setShowHistoryModal(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography 
                            variant="body" 
                            weight="bold" 
                            style={{ color: isSelected ? '#4F46E5' : '#0F172A' }}
                          >
                            {chat.category?.toUpperCase() || 'GENERAL CHAT'}
                          </Typography>
                          <Typography variant="caption" color="muted">
                            {formattedDate}
                          </Typography>
                        </View>
                        <Typography 
                          variant="caption" 
                          color="muted" 
                          numberOfLines={1} 
                          style={{ marginTop: 4 }}
                        >
                          {chat.lastMessage || 'No messages yet'}
                        </Typography>
                      </View>
                      <Ionicons 
                        name={isSelected ? "checkmark-circle" : "chevron-forward"} 
                        size={20} 
                        color={isSelected ? "#4F46E5" : "#94A3B8"} 
                        style={{ marginLeft: 12 }} 
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Start New Chat Button */}
            <TouchableOpacity 
              style={styles.newChatBtn}
              onPress={() => {
                startNewSession();
                setShowHistoryModal(false);
              }}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Typography color="inverse" weight="bold">Start New Chat</Typography>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#FFFFFF',
    ...THEME.shadows.sm,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  traceToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4F46E5',
  },
  traceToggleActive: {
    backgroundColor: '#4F46E5',
  },
  chatList: {
    padding: 24,
    paddingBottom: 100,
  },
  messageWrapper: {
    marginBottom: 24,
    maxWidth: '85%',
  },
  messageWrapperUser: {
    alignSelf: 'flex-end',
  },
  messageWrapperAI: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    ...THEME.shadows.sm,
  },
  userBubble: {
    backgroundColor: '#4F46E5',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  errorBubble: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  thinkingWrapper: {
    marginBottom: 8,
    alignSelf: 'flex-start',
    width: '100%',
  },
  thinkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignSelf: 'flex-start',
  },
  traceContainer: {
    marginTop: 6,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  matchCard: {
    marginTop: 12,
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    ...THEME.shadows.md,
  },
  pricingBox: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  bookNowBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 32,
    ...THEME.shadows.lg,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  backBtn: {
    marginRight: 12,
    padding: 4,
  },
  input: {
    flex: 1,
    minHeight: 50,
    maxHeight: 120,
    backgroundColor: 'transparent',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F172A',
  },
  sendBtn: {
    marginLeft: 12,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.md,
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  chatCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...THEME.shadows.sm,
  },
  chatCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatAvatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
  },
  chatAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4F46E5',
    fontFamily: THEME.fonts.bold,
  },
  chatCardInfo: {
    flex: 1,
    marginLeft: 16,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
  },
  headerAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  blankState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  agentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#A7F3D0',
  },
  loaderWrapper: {
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...THEME.shadows.sm,
  },
  thinkingHeaderLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  loaderTraceContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  loaderTraceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    opacity: 0.5,
  },
  loaderTraceRowActive: {
    opacity: 1,
  },
  loaderStatusIcon: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalListContainer: {
    paddingBottom: 24,
  },
  modalEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  historyItemActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  newChatBtn: {
    flexDirection: 'row',
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateTabActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  slotsGrid: {
    paddingBottom: 8,
  },
  slotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  slotItemActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  confirmBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
});
