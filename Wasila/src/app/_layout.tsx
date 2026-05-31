import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ThemeProvider, DefaultTheme } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuthStore, UserRole, UserProfile } from '../store/useAuthStore';
import { View, ActivityIndicator, Alert } from 'react-native';

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

        // Listen to the Firestore notifications in real-time for push alert simulation
        const notifQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', firebaseUser.uid)
        );
        unsubscribeNotifications = onSnapshot(notifQuery, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data.timestamp && data.timestamp > appStartTime) {
                Alert.alert("Wasila Notification", data.message);
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
