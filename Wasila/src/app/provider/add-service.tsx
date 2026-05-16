import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { THEME } from '../../theme';
import * as ImagePicker from 'expo-image-picker';
import { Switch, Image, Alert, ActivityIndicator } from 'react-native';
import { db, storage, auth } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuthStore } from '../../store/useAuthStore';

const CATEGORIES = [
  { id: '1', name: 'Cleaning', icon: 'sparkles-outline' },
  { id: '2', name: 'Repair', icon: 'build-outline' },
  { id: '3', name: 'Plumbing', icon: 'water-outline' },
  { id: '4', name: 'Electrician', icon: 'flash-outline' },
  { id: '5', name: 'Painting', icon: 'brush-outline' },
  { id: '6', name: 'Car Wash', icon: 'car-outline' },
  { id: '7', name: 'Gardening', icon: 'leaf-outline' },
];

export default function AddServiceScreen() {
  const router = useRouter();
  const { editId } = useLocalSearchParams();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(!!editId);
  const [image, setImage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Cleaning',
    price: '',
    description: '',
    isActive: true,
  });

  // Fetch service data if editing
  React.useEffect(() => {
    if (editId) {
      fetchServiceData();
    }
  }, [editId]);

  const fetchServiceData = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'services', editId as string));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFormData({
          name: data.name,
          category: data.category,
          price: data.price.toString(),
          description: data.description,
          isActive: data.isActive,
        });
        setImage(data.imageUrl);
      }
    } catch (error) {
      console.error('Error fetching service:', error);
      Alert.alert('Error', 'Failed to load service data.');
    } finally {
      setFetchingData(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to upload images!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    // If it's already a firebase URL, don't re-upload
    if (uri.startsWith('http')) return uri;

    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `services/${Date.now()}-${auth.currentUser?.uid}.jpg`;
      const storageRef = ref(storage, filename);
      
      await uploadBytes(storageRef, blob);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const saveToFirestore = async (serviceData: any) => {
    try {
      if (editId) {
        await updateDoc(doc(db, 'services', editId as string), serviceData);
      } else {
        serviceData.createdAt = serverTimestamp();
        serviceData.rating = 0.0;
        serviceData.reviewCount = 0;
        await addDoc(collection(db, 'services'), serviceData);
      }
      
      Alert.alert('Success', `Your service has been ${editId ? 'updated' : 'published'}!`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error in saveToFirestore:', error);
      Alert.alert('Error', 'Failed to save to database.');
    }
  };

  const handlePublish = async () => {
    if (!formData.name || !formData.price || !formData.description) {
      Alert.alert('Missing Info', 'Please fill all fields before publishing.');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to publish a service.');
      return;
    }

    setLoading(true);
    try {
      let imageUrl = image;
      if (image && !image.startsWith('http')) {
        imageUrl = await uploadImage(image);
      }

      const serviceData: any = {
        name: formData.name,
        category: formData.category,
        price: parseFloat(formData.price),
        description: formData.description,
        isActive: formData.isActive,
        imageUrl: imageUrl,
        providerId: user.uid,
        providerName: user.name,
        providerPhotoURL: user.photoURL || '',
        city: user.city || '',
        address: user.address || '',
        latitude: user.latitude || null,
        longitude: user.longitude || null,
        updatedAt: serverTimestamp(),
      };

      if (!user.latitude || !user.longitude) {
        Alert.alert(
          'Location Missing', 
          'Your shop location is not set in your profile. Customers might not find you based on distance. Please set it in your profile later.',
          [{ 
            text: 'Publish Anyway', 
            onPress: () => saveToFirestore(serviceData) 
          }, { 
            text: 'Go to Profile', 
            onPress: () => router.push('/(tabs)/profile') 
          }]
        );
        setLoading(false);
        return;
      }

      await saveToFirestore(serviceData);
    } catch (error) {
      console.error('Error saving service:', error);
      Alert.alert('Error', 'Failed to save service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: editId ? 'Edit Service' : 'Add New Service',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#F8FAFC' },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 8 }}>
              <Ionicons name="arrow-back" size={24} color={THEME.colors.textMain} />
            </TouchableOpacity>
          ),
        }} 
      />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Upload Section */}
        <Typography variant="body" weight="bold" style={{ marginBottom: 12 }}>Service Image</Typography>
        <TouchableOpacity style={styles.imageUploadPlaceholder} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image || undefined }} style={styles.previewImage} />
          ) : (
            <LinearGradient
              colors={['#F1F5F9', '#E2E8F0']}
              style={styles.imageGradient}
            >
              <View style={styles.uploadIconCircle}>
                <Ionicons name="camera" size={32} color={THEME.colors.primary} />
              </View>
              <Typography variant="body" color="muted" style={{ marginTop: 12 }}>
                Tap to upload a professional photo
              </Typography>
            </LinearGradient>
          )}
        </TouchableOpacity>

        {/* Category Selection */}
        <View style={{ marginBottom: 24 }}>
          <Typography variant="body" weight="bold" style={{ marginBottom: 12 }}>Select Category</Typography>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity 
                key={cat.id} 
                style={[
                  styles.categoryChip, 
                  formData.category === cat.name && styles.categoryChipActive
                ]}
                onPress={() => setFormData({ ...formData, category: cat.name })}
              >
                <Ionicons 
                  name={cat.icon as any} 
                  size={16} 
                  color={formData.category === cat.name ? '#FFF' : THEME.colors.primary} 
                />
                <Typography 
                  variant="caption" 
                  weight="bold" 
                  style={{ 
                    marginLeft: 6, 
                    color: formData.category === cat.name ? '#FFF' : THEME.colors.textMain 
                  }}
                >
                  {cat.name}
                </Typography>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          <View style={styles.inputGroup}>
            <Typography variant="caption" weight="bold" color="muted" style={styles.label}>
              SERVICE NAME
            </Typography>
            <TextInput
              style={styles.input}
              placeholder="e.g. Professional AC Deep Cleaning"
              placeholderTextColor="#94A3B8"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Typography variant="caption" weight="bold" color="muted" style={styles.label}>
              PRICE (Rs.)
            </Typography>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="numeric"
              placeholderTextColor="#94A3B8"
              value={formData.price}
              onChangeText={(text) => setFormData({ ...formData, price: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Typography variant="caption" weight="bold" color="muted" style={styles.label}>
              DESCRIPTION
            </Typography>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe what's included in this service..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
            />
          </View>

          {/* Active Status Toggle */}
          <Card customStyle={styles.statusCard}>
            <View style={{ flex: 1 }}>
              <Typography variant="body" weight="bold">Active Status</Typography>
              <Typography variant="caption" color="muted">Make this service visible to customers</Typography>
            </View>
            <Switch
              value={formData.isActive}
              onValueChange={(val) => setFormData({ ...formData, isActive: val })}
              trackColor={{ false: '#CBD5E1', true: THEME.colors.primary + '80' }}
              thumbColor={formData.isActive ? THEME.colors.primary : '#F4F3F4'}
            />
          </Card>
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          style={styles.publishBtn}
          disabled={loading}
          onPress={handlePublish}
        >
          <LinearGradient
            colors={loading ? ['#94A3B8', '#64748B'] : ['#4F46E5', '#3730A3']}
            style={styles.gradientBtn}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Typography variant="body" weight="bold" color="inverse">
                {editId ? 'Update Service' : 'Publish Service'}
              </Typography>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  imageUploadPlaceholder: {
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  imageGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.sm,
  },
  formSection: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    letterSpacing: 1,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: THEME.colors.textMain,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  textArea: {
    height: 120,
    paddingTop: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  categoryScroll: {
    paddingRight: 20,
    gap: 12,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFF',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  publishBtn: {
    marginTop: 32,
    borderRadius: 16,
    overflow: 'hidden',
    ...THEME.shadows.md,
  },
  gradientBtn: {
    paddingVertical: 18,
    alignItems: 'center',
  },
});
