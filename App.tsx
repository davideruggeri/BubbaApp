import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import { Image, View, BackHandler, ActivityIndicator } from 'react-native'; // Import Image and ActivityIndicator
import { Ionicons } from '@expo/vector-icons'; // Import Ionicons
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import HomeScreen from './screens/HomeScreen';

import AttendanceScreen from './screens/AttendanceScreen';
import CalendarScreen from './screens/CalendarScreen';
import DirectoryScreen from './screens/DirectoryScreen';
import HallOfFameScreen from './screens/HallOfFameScreen'; // Import HallOfFame
import RosterScreen from './screens/RosterScreen'; // Import RosterScreen

import MoreScreen from './screens/MoreScreen';
import LeagueScreen from './screens/LeagueScreen'; // Import LeagueScreen
import LoginScreen from './screens/LoginScreen'; // Import LoginScreen
import AccountScreen from './screens/AccountScreen'; // Import AccountScreen
import FinancialScreen from './screens/FinancialScreen'; // Import FinancialScreen
import SettingsScreen from './screens/SettingsScreen'; // Import SettingsScreen
import WorldMapScreen from './screens/WorldMapScreen'; // Import WorldMapScreen
import AnalisiPartitaScreen from './screens/AnalisiPartitaScreen'; // Import AnalisiPartitaScreen
import MatchDetailScreen from './screens/MatchDetailScreen';
import LiveMatchScreen from './screens/LiveMatchScreen'; // Import MatchDetailScreen
import TacticsGameScreen from './screens/TacticsGameScreen'; // Import TacticsGameScreen
import PresenzeHistoryScreen from './screens/PresenzeHistoryScreen';
import { subscribeToEvents, Event, MatchAnalysis } from './services/firestore'; // Import subscribeToEvents and Event typeh
import { AuthProvider, useAuth } from './context/AuthContext'; // Import AuthProvider and useAuth
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { EasterEggProvider } from './context/EasterEggContext';
import { SeasonProvider } from './context/SeasonContext';
import GlobalEffects from './components/GlobalEffects';
import FallingSnow from './components/FallingSnow';
import GlobalAlertModal from './components/GlobalAlertModal';
import { isChristmasPeriod } from './utils/date';

// Define the param list for the tabs
export type RootTabParamList = {
  Home: undefined;
  HallOfFame: undefined; // Moved to main tabs
  Attendance: undefined;
  Calendar: undefined;
  More: undefined;
};

// Define the param list for the root stack
export type RootStackParamList = {
  MainTabs: undefined;

  Login: undefined;
  // Screens moved from MoreStack and HallOfFame
  Directory: undefined;
  Roster: undefined;

  Account: undefined;
  HallOfFame: undefined;
  Financial: undefined;
  MoreModal: undefined;
  Settings: undefined;
  WorldMap: undefined;
  AnalisiPartita: undefined;
  MatchDetail: { match: MatchAnalysis };
  LiveMatch: { matchId: string; initialMatch: MatchAnalysis; mode?: 'normal' | 'live' };
  TacticsGame: undefined;
  League: undefined;
  PresenzeHistory: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();



import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type MainTabsNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

function MainTabs() {
  const navigation = useNavigation<MainTabsNavigationProp>();
  const { theme } = useTheme();

  useEffect(() => {
    const backAction = () => {
      // Get the current route name
      // Note: This is a simplified way to check. For nested navigators, you might need more logic.
      // But for a simple tab navigator, we can check the navigation state.
      const state = navigation.getState();
      const route = state.routes[state.index];

      if (route.name !== 'Home') {
        navigation.navigate('Home');
        return true; // Prevent default behavior (exit)
      }

      return false; // Allow default behavior (exit)
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [navigation]);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconSource;

          if (route.name === 'Home') {
            iconSource = require('./assets/home.png');
          } else if (route.name === 'Attendance') {
            iconSource = require('./assets/list.png');
          } else if (route.name === 'Calendar') {
            iconSource = require('./assets/calendar.png');
          } else if (route.name === 'HallOfFame') {
            iconSource = require('./assets/trophy.png');
          } else if (route.name === 'More') {
            iconSource = require('./assets/more.png');
          }

          return (
            <Image
              source={iconSource}
              style={{
                width: size,
                height: size,
                tintColor: color, // Apply tint color
                resizeMode: 'contain'
              }}
            />
          );
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          height: 60,
          paddingBottom: 10,
          paddingTop: 10,
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
        }
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendario' }} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} options={{ title: 'Presenze' }} />
      <Tab.Screen name="HallOfFame" component={HallOfFameScreen} options={{ title: 'Albo d\'Oro' }} />
      <Tab.Screen
        name="More"
        component={View} // Dummy component
        listeners={() => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('MoreModal');
          },
        })}
        options={{
          title: 'Altro',
        }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { firebaseUser, loading } = useAuth();
  const { theme } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }
  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: 'transparent',
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {firebaseUser ? (
          // Authenticated Stack
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />


            {/* Screens moved from MoreStack */}
            <Stack.Screen name="Directory" component={DirectoryScreen} />
            <Stack.Screen name="Roster" component={RosterScreen} />

            <Stack.Screen name="Account" component={AccountScreen} />
            <Stack.Screen name="HallOfFame" component={HallOfFameScreen} />
            <Stack.Screen name="Financial" component={FinancialScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="WorldMap" component={WorldMapScreen} />
            <Stack.Screen name="AnalisiPartita" component={AnalisiPartitaScreen} />
            <Stack.Screen name="MatchDetail" component={MatchDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="LiveMatch" component={LiveMatchScreen} options={{ headerShown: false }} />
            <Stack.Screen name="TacticsGame" component={TacticsGameScreen} options={{ headerShown: false }} />
            <Stack.Screen name="League" component={LeagueScreen} />
            <Stack.Screen name="PresenzeHistory" component={PresenzeHistoryScreen} options={{ headerShown: false }} />
            {/* Transparent Modal */}
            <Stack.Screen
              name="MoreModal"
              component={MoreScreen}
              options={{
                presentation: 'transparentModal',
                animation: 'fade',
                headerShown: false
              }}
            />
          </>
        ) : (
          // Non-Authenticated Stack
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function AppContent() {
  const { isChristmasEnabled, theme } = useTheme();
  const isChristmas = isChristmasPeriod() && isChristmasEnabled;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {isChristmas && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} pointerEvents="none">
          <FallingSnow />
        </View>
      )}
      <GlobalEffects />
      <RootNavigator />
      <GlobalAlertModal />
    </View>
  );
}

export default function App() {
  const [loaded, error] = useFonts({
    'NBAMilwaukeeBucks': require('./assets/NBAMilwaukeeBucks2015.otf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <EasterEggProvider>
            <SeasonProvider>
              <AppContent />
            </SeasonProvider>
          </EasterEggProvider>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
