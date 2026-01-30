import React, { useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';
import LibraryScreen from './src/screens/LibraryScreen';

type Screen = 'home' | 'library';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      {currentScreen === 'home' ? (
        <HomeScreen onNavigateToLibrary={() => setCurrentScreen('library')} />
      ) : (
        <LibraryScreen onNavigateBack={() => setCurrentScreen('home')} />
      )}
    </View>
  );
}
