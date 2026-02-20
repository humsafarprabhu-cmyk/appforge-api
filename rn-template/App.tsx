import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect, Polyline, Polygon, Line } from 'react-native-svg';
import { theme } from './src/theme';
import { store } from './src/store';

// Screen imports (generated per app)
{{SCREEN_IMPORTS}}

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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

function TabNavigator() {
  return (
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
  );
}

export default function App() {
  useEffect(() => {
    store.init();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={DarkTheme}>
        <StatusBar style="light" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={TabNavigator} />
          {{STACK_SCREENS}}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
