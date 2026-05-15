import * as React from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Alert } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID, // Use same if shared or user provides separate
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  });

  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      
      setLoading(true);
      signInWithCredential(auth, credential)
        .catch((error) => {
          console.error('Firebase Google Auth Error:', error);
          Alert.alert('Authentication Failed', 'Could not sign in with Google.');
        })
        .finally(() => setLoading(false));
    }
  }, [response]);

  return {
    signIn: () => promptAsync(),
    loading: loading || !request,
  };
}
