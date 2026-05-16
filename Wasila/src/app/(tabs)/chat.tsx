import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  FlatList, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';
import { Typography } from '../../components/ui/Typography';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { API_BASE_URL } from '../../lib/apiConfig';

type Trace = { agent: string; step: string; detail: any };
type ProviderMatch = { name: string; rating: number; pricePerHour: number; location: string; category: string; skills?: string[]; finalScore?: number };

type Message = {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  traces?: Trace[];
  bestMatch?: ProviderMatch;
  workplan?: string[];
  isError?: boolean;
};

const MessageBubble = ({ item }: { item: Message }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isUser = item.sender === 'user';

  return (
    <View style={[styles.messageWrapper, isUser ? styles.messageWrapperUser : styles.messageWrapperAI]}>
      {/* Thinking Traces (Above the reply for AI) */}
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
                    <>
                      <Typography variant="caption" weight="bold" style={{ color: '#4F46E5' }}>⚙ {trace.agent}</Typography>
                      <Typography variant="caption" color="muted">
                        {typeof trace.detail === 'object' ? (trace.detail?.reasoning || trace.detail?.category || JSON.stringify(trace.detail).substring(0, 100)) : String(trace.detail)}
                      </Typography>
                    </>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Main Message Bubble */}
      {isUser ? (
        <LinearGradient
          colors={['#4F46E5', '#3730A3']}
          style={[styles.bubble, styles.userBubble]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Typography color="inverse" variant="body">
            {item.text}
          </Typography>
        </LinearGradient>
      ) : (
        <View style={[styles.bubble, styles.aiBubble, item.isError && styles.errorBubble]}>
          <Typography color={item.isError ? "error" : "main"} variant="body">
            {item.text}
          </Typography>
        </View>
      )}

      {/* Best Match Card (Below the reply) */}
      {!isUser && item.bestMatch && (
        <Card customStyle={styles.matchCard}>
          <Typography variant="h3" color="primary" weight="bold">{item.bestMatch.name}</Typography>
          <Typography variant="caption" color="muted">⭐ {item.bestMatch.rating} • {item.bestMatch.category}</Typography>
          <Typography variant="caption" color="muted">📍 {item.bestMatch.location}</Typography>
          
          <View style={styles.pricingBox}>
            <Typography variant="body" weight="bold">Rate: Rs. {item.bestMatch.pricePerHour}/hr</Typography>
            {item.bestMatch.skills && (
              <Typography variant="caption" color="muted" style={{ marginTop: 4 }}>
                Skills: {item.bestMatch.skills.join(', ')}
              </Typography>
            )}
          </View>

          <TouchableOpacity style={styles.bookNowBtn}>
            <Typography color="inverse" weight="bold">Book Now</Typography>
          </TouchableOpacity>
        </Card>
      )}
    </View>
  );
};

export default function ChatScreen() {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Assalam o Alaikum! Main Wasila AI Orchestrator hoon. Batayen main aapki kya madad kar sakta hoon?',
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: inputText.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.text })
      });
      
      const data = await response.json();

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: data.reply || 'Main samjha nahi, dobara batayen?',
        traces: data.traces,
        bestMatch: data.bestMatch,
        workplan: data.workplan,
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: 'Backend se connect nahi ho pa raha. Server check karein.',
        isError: true,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.headerAvatar}>
            <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          </View>
          <View>
            <Typography variant="h3" weight="bold">Wasila AI</Typography>
            <Typography variant="caption" color="primary">Orchestrator</Typography>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <MessageBubble item={item} />}
          contentContainerStyle={styles.chatList}
          showsVerticalScrollIndicator={false}
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
  }
});
