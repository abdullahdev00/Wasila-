import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, SafeAreaView, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Shield, Zap, Heart } from 'lucide-react-native';

const WASILA_LOGO = require('./assets/adaptive-icon.png'); // Placeholder until we use the generated one

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0f172a', '#1e1b4b', '#312e81']}
        style={styles.background}
      >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <View style={styles.logoBackground}>
              <Image 
                source={require('./assets/wasila-logo.png')} 
                style={{ width: 100, height: 100, borderRadius: 20 }}
              />
            </View>
            <Text style={styles.title}>Wasila</Text>
            <Text style={styles.tagline}>Aapka Bharosa, Hamara Wasila</Text>
          </View>

          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <Shield color="#818cf8" size={24} />
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>Verified Experts</Text>
                <Text style={styles.featureDesc}>Plumbers, Electricians, Tutors & more.</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Zap color="#818cf8" size={24} />
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>Instant Booking</Text>
                <Text style={styles.featureDesc}>Get services at your doorstep in minutes.</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Heart color="#818cf8" size={24} />
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>Trusted Quality</Text>
                <Text style={styles.featureDesc}>100% satisfaction guaranteed.</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.button} activeOpacity={0.8}>
            <LinearGradient
              colors={['#6366f1', '#4f46e5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Get Started</Text>
              <ArrowRight color="white" size={20} />
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            Join 10,000+ happy users in Pakistan
          </Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  background: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoBackground: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 5,
    fontStyle: 'italic',
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 60,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  featureText: {
    marginLeft: 15,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  featureDesc: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  button: {
    width: '100%',
    height: 60,
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  buttonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  footerText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 20,
    textAlign: 'center',
  },
});
