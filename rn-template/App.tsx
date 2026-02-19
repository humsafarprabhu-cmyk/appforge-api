import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect, Polyline, Polygon, Line } from 'react-native-svg';
import { theme } from './src/theme';
import { auth, ads, notifications } from './src/services';
import { config } from './src/config';

// Screen imports (generated per app)
{{SCREEN_IMPORTS}}

const Tab = createBottomTabNavigator();

const DarkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#050507',
    card: 'rgba(5,5,7,0.95)',
    text: '#fff',
    border: 'rgba(255,255,255,0.06)',
    primary: theme.colors.primary[0],
  },
};

// Icon components for tab bar
const icons: Record<string, (props: { color: string; size: number }) => React.ReactNode> = {
  {{TAB_ICONS}}
};

export default function App() {
  useEffect(() => {
    // Initialize services
    (async () => {
      if (config.features.auth) await auth.restoreSession();
      if (config.features.ads) await ads.initialize();
      if (config.features.pushNotifications) await notifications.register();
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={DarkTheme}>
        <StatusBar style="light" />
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: 'rgba(5,5,7,0.95)',
              borderTopColor: 'rgba(255,255,255,0.06)',
              borderTopWidth: 1,
              height: 64,
              paddingBottom: 8,
              paddingTop: 4,
            },
            tabBarActiveTintColor: theme.colors.primary[0],
            tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
            tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
          }}
        >
          {{TAB_SCREENS}}
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
