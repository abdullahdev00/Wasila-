import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';
import { Typography } from '../../components/ui/Typography';
import { useAuthStore } from '../../store/useAuthStore';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { user } = useAuthStore();
  const role = user?.role || 'customer';
  const focusedRoute = state.routes[state.index].name;
  if (focusedRoute === 'chat') return null;

  return (
    <View style={styles.tabBarWrapper}>
      <BlurView intensity={80} tint="light" style={styles.tabBarContainer}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label = options.title !== undefined ? options.title : route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const getIcon = (color: string) => {
            switch (route.name) {
              case 'index': return <Ionicons name={isFocused ? "home" : "home-outline"} size={22} color={color} />;
              case 'chat': return <Ionicons name={isFocused ? "sparkles" : "sparkles-outline"} size={22} color={color} />;
              case 'bookings': return <Ionicons name={isFocused ? "calendar" : "calendar-outline"} size={22} color={color} />;
              case 'services': return <Ionicons name={isFocused ? "briefcase" : "briefcase-outline"} size={22} color={color} />;
              case 'profile': return <Ionicons name={isFocused ? "person" : "person-outline"} size={22} color={color} />;
              default: return <Ionicons name="square" size={22} color={color} />;
            }
          };

          // Hide Services for customers, hide Profile for providers in the bottom bar
          if (route.name === 'services' && role !== 'provider') return null;
          if (route.name === 'profile' && role === 'provider') return null;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={[
                styles.tabItem,
                isFocused && styles.tabItemActive
              ]}
              activeOpacity={0.7}
            >
              {getIcon(isFocused ? '#FFFFFF' : '#64748B')}
              {isFocused && (
                <Typography variant="caption" weight="bold" style={styles.tabLabel}>
                  {label}
                </Typography>
              )}
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="chat" options={{ title: 'Wasila AI' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
      <Tabs.Screen name="services" options={{ title: 'Services' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  tabBarContainer: {
    flexDirection: 'row',
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...THEME.shadows.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  tabItem: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  tabItemActive: {
    backgroundColor: THEME.colors.primary, 
    flex: 1.5,
  },
  tabLabel: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 12,
  },
});
