import 'expo-dev-client';
import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import PetPlannerScreen from './src/screens/PetPlannerScreen';

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium: require('./assets/fonts/SpaceGrotesk_500Medium.ttf'),
    SpaceGrotesk_700Bold: require('./assets/fonts/SpaceGrotesk_700Bold.ttf'),
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#08080e' }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <PetPlannerScreen />
    </View>
  );
}
