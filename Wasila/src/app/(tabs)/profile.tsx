import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Text
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';


import Animated, { FadeInDown } from 'react-native-reanimated';
import { THEME } from '../../theme';
import { Typography } from '../../components/ui/Typography';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/useAuthStore';
import { signOut } from 'firebase/auth';
import { auth, db, storage } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const { user, updateUser } = useAuthStore();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  
  const role = user?.role || 'customer';

  // Sync edit state when modal opens
  useEffect(() => {
    if (isEditing) {
      setEditName(user?.name || '');
      setEditPhone(user?.phoneNumber || '');
      setEditAddress(user?.address || '');
      setEditCity(user?.city || '');
      setEditLat(user?.latitude !== undefined && user?.latitude !== null ? String(user.latitude) : '');
      setEditLng(user?.longitude !== undefined && user?.longitude !== null ? String(user.longitude) : '');
    }
  }, [isEditing, user]);

  const getCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Allow location access to get your coordinates.');
      return;
    }

    try {
      let loc = await Location.getCurrentPositionAsync({});
      setEditLat(String(loc.coords.latitude));
      setEditLng(String(loc.coords.longitude));
    } catch (e) {
      Alert.alert('Error', 'Failed to retrieve current location coordinates.');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error) {
              Alert.alert('Error', 'Failed to logout');
            }
          }
        },
      ]
    );
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your photos to update your profile.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });

    if (!result.canceled && result.assets[0].uri) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    if (!user) return;
    setIsUploading(true);
    try {
      const blob: Blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = (e) => reject(new TypeError("Network request failed"));
        xhr.responseType = "blob";
        xhr.open("GET", uri, true);
        xhr.send(null);
      });

      const storageRef = ref(storage, `avatars/${user.uid}`);
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
      const downloadURL = await getDownloadURL(storageRef);
      
      await updateDoc(doc(db, 'users', user.uid), { photoURL: downloadURL });
      updateUser({ photoURL: downloadURL });
      Alert.alert('Success', 'Profile picture updated!');
    } catch (error) {
      Alert.alert('Upload Failed', 'Error updating profile image.');
    } finally {
      setIsUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    if (editName.trim().length < 2) {
      Alert.alert('Invalid Name', 'Please enter a valid name.');
      return;
    }

    const latVal = editLat.trim() ? parseFloat(editLat) : null;
    const lngVal = editLng.trim() ? parseFloat(editLng) : null;

    if (latVal !== null && (isNaN(latVal) || latVal < -90 || latVal > 90)) {
      Alert.alert('Invalid Latitude', 'Please enter a valid latitude between -90 and 90.');
      return;
    }
    if (lngVal !== null && (isNaN(lngVal) || lngVal < -180 || lngVal > 180)) {
      Alert.alert('Invalid Longitude', 'Please enter a valid longitude between -180 and 180.');
      return;
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: editName,
        phoneNumber: editPhone,
        address: editAddress,
        city: editCity,
        latitude: latVal,
        longitude: lngVal,
      });
      updateUser({ 
        name: editName, 
        phoneNumber: editPhone,
        address: editAddress,
        city: editCity,
        latitude: latVal ?? undefined,
        longitude: lngVal ?? undefined,
      });
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Typography variant="h2" weight="bold">Profile</Typography>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color={THEME.colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(100)} style={styles.profileHeader}>
          <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Typography variant="h1" color="inverse">
                  {(user?.name || 'G').charAt(0).toUpperCase()}
                </Typography>
              </View>
            )}
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={16} color="#FFF" />
            </View>
            {isUploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#FFF" />
              </View>
            )}
          </TouchableOpacity>

          <Typography variant="h2" weight="bold" style={{ marginTop: 16 }}>{user?.name}</Typography>
          <Typography variant="body" color="muted">{user?.email}</Typography>
          
          {(user?.city || user?.address) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Ionicons name="location" size={14} color={THEME.colors.textMuted} />
              <Typography variant="caption" color="muted" style={{ marginLeft: 4 }}>
                {user?.city}{user?.city && user?.address ? ', ' : ''}{user?.address}
              </Typography>
            </View>
          )}
          
          <View style={[styles.roleBadge, { backgroundColor: role === 'provider' ? '#F0FDF4' : '#EEF2FF' }]}>
            <Typography variant="caption" weight="bold" color={role === 'provider' ? 'primary' : 'primary'}>
              {role.toUpperCase()}
            </Typography>
          </View>
        </Animated.View>

        <View style={styles.settingsSection}>
          <Typography variant="h3" weight="bold" style={{ marginBottom: 16 }}>Account Settings</Typography>
          
          <TouchableOpacity style={styles.settingRow} onPress={() => setIsEditing(true)}>
            <View style={[styles.settingIcon, { backgroundColor: '#F8FAFC' }]}>
              <Ionicons name="person-outline" size={22} color={THEME.colors.primary} />
            </View>
            <View style={styles.settingText}>
              <Typography variant="body" weight="bold">Edit Profile</Typography>
              <Typography variant="caption" color="muted">Name, Phone number</Typography>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/complaints')}>
            <View style={[styles.settingIcon, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="warning-outline" size={22} color="#EF4444" />
            </View>
            <View style={styles.settingText}>
              <Typography variant="body" weight="bold">Shikayaat (Complaints)</Typography>
              <Typography variant="caption" color="muted">Apni shikayaat aur unka status dekhye</Typography>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        <Button 
          label="Logout" 
          variant="outline" 
          onPress={handleLogout} 
          customStyle={styles.logoutBtn}
          customLabelStyle={{ color: THEME.colors.error }}
        />
      </ScrollView>

      <Modal visible={isEditing} animationType="slide" transparent={true} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBlur} activeOpacity={1} onPress={() => setIsEditing(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <Typography variant="h2" weight="bold">Edit Profile</Typography>
            </View>

            <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.7 }} showsVerticalScrollIndicator={false}>
              <View style={styles.modalBody}>
                <View style={styles.inputGroup}>
                  <Typography variant="caption" color="muted" style={styles.inputLabel}>Full Name</Typography>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={20} color={THEME.colors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Enter name"
                      editable={!isSaving}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Typography variant="caption" color="muted" style={styles.inputLabel}>Phone Number</Typography>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="call-outline" size={20} color={THEME.colors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={editPhone}
                      onChangeText={setEditPhone}
                      placeholder="+92 XXX XXXXXXX"
                      keyboardType="phone-pad"
                      editable={!isSaving}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Typography variant="caption" color="muted" style={styles.inputLabel}>City</Typography>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="business-outline" size={20} color={THEME.colors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={editCity}
                      onChangeText={setEditCity}
                      placeholder="e.g. Lahore, Karachi"
                      editable={!isSaving}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Typography variant="caption" color="muted" style={styles.inputLabel}>Shop Address / Location</Typography>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="location-outline" size={20} color={THEME.colors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={editAddress}
                      onChangeText={setEditAddress}
                      placeholder="Complete shop address"
                      editable={!isSaving}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Typography variant="caption" color="muted" style={styles.inputLabel}>Latitude</Typography>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="compass-outline" size={20} color={THEME.colors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={editLat}
                      onChangeText={setEditLat}
                      placeholder="e.g. 33.6844"
                      keyboardType="numeric"
                      editable={!isSaving}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Typography variant="caption" color="muted" style={styles.inputLabel}>Longitude</Typography>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="compass-outline" size={20} color={THEME.colors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={editLng}
                      onChangeText={setEditLng}
                      placeholder="e.g. 73.0479"
                      keyboardType="numeric"
                      editable={!isSaving}
                    />
                  </View>
                </View>



                <TouchableOpacity 
                  style={styles.currentLocationBtn}
                  onPress={getCurrentLocation}
                >
                  <Ionicons name="locate-outline" size={20} color={THEME.colors.primary} />
                  <Typography variant="body" style={{ marginLeft: 12, color: THEME.colors.primary }} weight="bold">
                    Use Current Location
                  </Typography>
                </TouchableOpacity>

                <View style={styles.modalActions}>
                  <Button label="Cancel" variant="outline" onPress={() => setIsEditing(false)} customStyle={{ flex: 1, marginRight: 12 }} />
                  <Button label="Save" onPress={saveProfile} isLoading={isSaving} customStyle={{ flex: 2 }} />
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    paddingVertical: 20,
    backgroundColor: '#FFF',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: THEME.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: THEME.colors.primary,
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#F8FAFC',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 12,
  },
  settingsSection: {
    marginTop: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    ...THEME.shadows.sm,
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingText: {
    flex: 1,
    marginLeft: 16,
  },
  logoutBtn: {
    marginTop: 20,
    borderColor: THEME.colors.error,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginBottom: 16,
  },
  modalBody: {
    paddingHorizontal: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#0F172A',
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 12,
  },
  locationPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 20,
  },
  locationPickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    padding: 14,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.colors.primary + '30',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFF',
  },
  mapBackBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapFooter: {
    padding: 24,
    backgroundColor: '#FFF',
    ...THEME.shadows.lg,
  },
  map: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  coordsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  coordsText: {
    fontSize: 12,
    color: '#6c757d',
    fontFamily: 'Outfit-Medium',
  },
  mapInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 10,
  },
});
