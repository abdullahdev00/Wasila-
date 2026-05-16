import React from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  SafeAreaView 
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../components/ui/Typography';
import { THEME } from '../../theme';
import { BlurView } from 'expo-blur';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ActivityIndicator } from 'react-native';

const { width } = Dimensions.get('window');

// Service detail screen using dynamic data from Firestore and navigation parameters

export default function ServiceDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  
  // Use data from params immediately
  const [service, setService] = React.useState<any>({
    id: params.id,
    name: params.name,
    price: params.price,
    category: params.category,
    description: params.description,
    imageUrl: params.imageUrl,
    providerName: params.providerName,
    providerPhotoURL: params.providerPhotoURL === 'undefined' ? null : params.providerPhotoURL,
    rating: parseFloat(params.rating as string || '0'),
    reviewCount: parseInt(params.reviewCount as string || '0'),
  });

  const [loading, setLoading] = React.useState(!params.name); // Only load if we don't have basic data
  
  React.useEffect(() => {
    const fetchService = async () => {
      // If we already have the basic data, we don't necessarily need a full-screen loader
      if (!params.id) return;
      
      try {
        const docRef = doc(db, 'services', params.id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const freshData = { id: docSnap.id, ...docSnap.data() };
          setService((prev: any) => ({ ...prev, ...freshData }));
        }
      } catch (error) {
        console.error("Error fetching service:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchService();
  }, [params.id]);

  if (loading && !service.name) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
      </View>
    );
  }

  if (!service.name && !loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Typography variant="body" color="muted">Service not found</Typography>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Typography variant="body" color="primary">Go Back</Typography>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Header Image */}
        <View style={styles.imageContainer}>
          {service.imageUrl ? (
            <Image 
              source={{ uri: service.imageUrl }} 
              style={styles.headerImage} 
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.headerImage, { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="image-outline" size={64} color="#CBD5E1" />
            </View>
          )}
          <SafeAreaView style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.backBtn}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn}>
              <Ionicons name="share-social-outline" size={24} color="#000" />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        <View style={styles.content}>
          {/* Category & Title */}
          <View style={styles.infoRow}>
            <View style={styles.categoryBadge}>
              <Typography variant="caption" color="primary" weight="bold">{service.category}</Typography>
            </View>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Typography variant="body" weight="bold" style={{ marginLeft: 4 }}>{service.rating?.toFixed(1) || '0.0'}</Typography>
              <Typography variant="caption" color="muted"> ({service.reviewCount || 0} reviews)</Typography>
            </View>
          </View>

          <Typography variant="h1" weight="bold" style={styles.title}>{service.name}</Typography>

          {/* Provider Section */}
          <TouchableOpacity style={styles.providerCard} activeOpacity={0.7}>
            {service.providerPhotoURL ? (
            <Image 
              source={{ uri: service.providerPhotoURL }} 
              style={styles.providerAvatar} 
              contentFit="cover"
              transition={200}
            />
          ) : (
              <View style={[styles.providerAvatar, { backgroundColor: THEME.colors.primary + '20', justifyContent: 'center', alignItems: 'center' }]}>
                <Typography variant="h3" color="primary" weight="bold">{(service.providerName || 'P').charAt(0)}</Typography>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Typography variant="body" weight="bold">{service.providerName || 'Professional'}</Typography>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Typography variant="caption" color="muted" style={{ marginLeft: 4 }}>Verified Provider</Typography>
              </View>
            </View>
            <View style={styles.providerActions}>
              <TouchableOpacity style={styles.smallIconBtn}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={THEME.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallIconBtn, { marginLeft: 8 }]}>
                <Ionicons name="call-outline" size={20} color={THEME.colors.primary} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {/* Description */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="information-circle-outline" size={22} color={THEME.colors.primary} />
              <Typography variant="h3" weight="bold" style={{ marginLeft: 8 }}>About Service</Typography>
            </View>
            <Typography variant="body" color="muted" style={styles.descriptionText}>
              {service.description}
            </Typography>
          </View>

          {/* Features */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="list-outline" size={22} color={THEME.colors.primary} />
              <Typography variant="h3" weight="bold" style={{ marginLeft: 8 }}>What's Included</Typography>
            </View>
            <View style={styles.featuresGrid}>
              {(service.features || ['Professional service', 'Verified background', 'On-time guarantee', 'Quality support']).map((feature: string, index: number) => (
                <View key={index} style={styles.featureItem}>
                  <View style={styles.featureCheck}>
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                  </View>
                  <Typography variant="body" style={{ marginLeft: 12, flex: 1 }}>{feature}</Typography>
                </View>
              ))}
            </View>
          </View>
          
          {/* Spacer for bottom bar */}
          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* Fixed Bottom Bar */}
      <BlurView intensity={80} tint="light" style={styles.bottomBar}>
        <View style={styles.priceContainer}>
          <Typography variant="caption" color="muted">Total Price</Typography>
          <Typography variant="h2" weight="bold" color="primary">Rs. {Number(service.price || 0).toLocaleString()}</Typography>
        </View>
        <TouchableOpacity style={styles.bookNowBtn}>
          <Typography variant="body" color="inverse" weight="bold">Book Now</Typography>
        </TouchableOpacity>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  imageContainer: {
    height: 350,
    width: width,
    position: 'relative',
  },
  headerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  headerActions: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.md,
  },
  content: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    marginTop: -40,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: THEME.colors.primary + '10',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    marginBottom: 20,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 24,
    ...THEME.shadows.sm,
    marginBottom: 24,
  },
  providerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  providerActions: {
    flexDirection: 'row',
  },
  smallIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  descriptionText: {
    lineHeight: 24,
    color: '#475569',
  },
  featuresGrid: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  featureCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  priceContainer: {
    flex: 1,
  },
  bookNowBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 20,
    ...THEME.shadows.md,
  },
});
