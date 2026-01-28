import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import LibraryScreen from './src/screens/LibraryScreen';

type Screen = 'home' | 'library';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {currentScreen === 'home' ? (
        <HomeScreen onNavigateToLibrary={() => setCurrentScreen('library')} />
      ) : (
        <LibraryScreen onNavigateBack={() => setCurrentScreen('home')} />
      )}
    </SafeAreaProvider>
  );
}
