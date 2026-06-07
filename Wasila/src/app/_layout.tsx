import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ThemeProvider, DefaultTheme } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuthStore, UserRole, UserProfile } from '../store/useAuthStore';
import { View, ActivityIndicator, Alert } from 'react-native';
import { API_BASE_URL } from '../lib/apiConfig';

export default function RootLayout() {
  const { user, setUser, isLoading, setLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;
    let unsubscribeNotifications: (() => void) | null = null;
    const appStartTime = new Date().toISOString();

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous snapshot listeners if exist
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
      if (unsubscribeNotifications) {
        unsubscribeNotifications();
        unsubscribeNotifications = null;
      }

      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        // Listen to the Firestore user profile in real-time
        unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: userData.name || 'User',
              role: userData.role || 'customer',
              photoURL: userData.photoURL,
              isAvailable: userData.isAvailable,
              phoneNumber: userData.phoneNumber || '',
              address: userData.address || '',
              city: userData.city || '',
              latitude: userData.latitude,
              longitude: userData.longitude
            });
          } else {
            // Create new user document for social logins if not exists
            const newUser: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'User',
              role: 'customer' as UserRole,
            };
            
            setDoc(userDocRef, {
              ...newUser,
              createdAt: new Date().toISOString(),
            }).catch(e => console.error("Error creating user doc:", e));

            setUser(newUser);
          }
          setLoading(false);
        }, (error) => {
          console.error("Firestore user onSnapshot error:", error);
          setLoading(false);
        });

        const mockProviderUids = [
          'AhmedRazaPlumber123',
          'zSD9lp4TReUdoOehPpl0OR9I54l2',
          'IrfanACMech789',
          'SajidKhanElectrician456',
          'ZeeshanAliTutor202',
          'BilalHussainPlumber101',
          'xWiyYEXPAmgUnEhNrqyxS9hEAcq2',
          'NGrzLqRy0pD211OTn2Te',
          'ZpjVtQHosL6q108Ucz71',
          's1',
          's2',
          's3'
        ];

        // Listen to the Firestore notifications in real-time for push alert simulation
        const notifQuery = query(
          collection(db, 'notifications'),
          where('userId', 'in', [firebaseUser.uid, ...mockProviderUids])
        );
        unsubscribeNotifications = onSnapshot(notifQuery, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data.timestamp && data.timestamp > appStartTime) {
                if (data.type === 'poor_quality_alert') {
                  Alert.alert(
                    "Poor Quality Work Reported",
                    data.message,
                    [
                      {
                        text: "Main Aa Raha Hoon",
                        onPress: async () => {
                          try {
                            const res = await fetch(`${API_BASE_URL}/bookings/${data.bookingId}/poor-quality-response`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ response: 'rectify' })
                            });
                            const resData = await res.json();
                            if (res.ok) {
                              Alert.alert("Success", "Aap ka response send ho gaya hai. Customer ko notify kar diya gaya hai.");
                            } else {
                              Alert.alert("Error", resData.error || "Response send karne mein masla pesh aya.");
                            }
                          } catch (e: any) {
                            Alert.alert("Error", e.message);
                          }
                        }
                      },
                      {
                        text: "Main Nahi Aa Raha",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            const res = await fetch(`${API_BASE_URL}/bookings/${data.bookingId}/poor-quality-response`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ response: 'decline' })
                            });
                            const resData = await res.json();
                            if (res.ok) {
                              Alert.alert("Response Sent", "Humne customer ko inform kar diya hai aur rating penalty apply kar di hai.");
                            } else {
                              Alert.alert("Error", resData.error || "Response send karne mein masla pesh aya.");
                            }
                          } catch (e: any) {
                            Alert.alert("Error", e.message);
                          }
                        }
                      }
                    ],
                    { cancelable: false }
                  );
                } else {
                  Alert.alert("Wasila Notification", data.message);
                }
              }
            }
          });
        }, (error) => {
          console.error("Firestore notifications onSnapshot error:", error);
        });

      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
      if (unsubscribeNotifications) {
        unsubscribeNotifications();
      }
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, segments, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
