import 'expo-dev-client';
import React, { useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import SplashScreen from './src/screens/SplashScreen';
import HomeScreen from './src/screens/HomeScreen';
import LibraryScreen from './src/screens/LibraryScreen';

type Screen = 'splash' | 'home' | 'library';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium: require('./assets/fonts/SpaceGrotesk_500Medium.ttf'),
    SpaceGrotesk_700Bold: require('./assets/fonts/SpaceGrotesk_700Bold.ttf'),
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#08080e' }} />;
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'splash':
        return <SplashScreen onFinish={() => setCurrentScreen('home')} />;
      case 'home':
        return <HomeScreen onNavigateToLibrary={() => setCurrentScreen('library')} />;
      case 'library':
        return <LibraryScreen onNavigateBack={() => setCurrentScreen('home')} />;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      {renderScreen()}
    </View>
  );
}
