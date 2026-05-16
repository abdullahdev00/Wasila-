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

type Trace = string;
type Pricing = { base: number; distance: number; urgency: number; total: number };
type ProviderMatch = { name: string; rating: number; pricing: Pricing; skills: string[] };

type Message = {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  traces?: Trace[];
  bestMatch?: ProviderMatch;
  suggestion?: string;
  isError?: boolean;
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
  const [showTraces, setShowTraces] = useState(true);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: inputText.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      // NOTE: Use 'localhost' for emulator, or your PC's IP address (e.g. 192.168.1.10) for physical device
      const response = await fetch('http://localhost:5000/api/chat', {
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
        suggestion: data.suggestion,
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

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.messageWrapper, isUser ? styles.messageWrapperUser : styles.messageWrapperAI]}>
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
          <View style={[styles.bubble, styles.aiBubble]}>
            <Typography color="main" variant="body">
              {item.text}
            </Typography>
          </View>
        )}

        {!isUser && item.traces && showTraces && (
          <View style={styles.traceContainer}>
            <Typography variant="caption" weight="bold" color="primary">🧠 Agent Reasoning Traces:</Typography>
            {item.traces.map((trace, i) => (
              <Typography key={i} variant="caption" color="muted">- {trace}</Typography>
            ))}
          </View>
        )}

        {!isUser && item.bestMatch && (
          <Card customStyle={styles.matchCard}>
            <Typography variant="h3" color="primary" weight="bold">{item.bestMatch.name}</Typography>
            <Typography variant="caption" color="muted">Rating: ⭐ {item.bestMatch.rating}</Typography>
            
            <View style={styles.pricingBox}>
              <Typography variant="body" weight="bold">Pricing Breakdown:</Typography>
              <Typography variant="caption">Base: Rs. {item.bestMatch.pricing?.base}</Typography>
              <Typography variant="caption">Surge: Rs. {item.bestMatch.pricing?.distance}</Typography>
              <View style={styles.divider} />
              <Typography variant="body" weight="bold" color="success">
                Total: Rs. {item.bestMatch.pricing?.total}
              </Typography>
            </View>

            <TouchableOpacity style={styles.bookNowBtn}>
              <Typography color="inverse" weight="bold">Book Now</Typography>
            </TouchableOpacity>
          </Card>
        )}
      </View>
    );
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
          renderItem={renderMessage}
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
    paddingBottom: 100, // Increased to clear floating input
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
  traceContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
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
