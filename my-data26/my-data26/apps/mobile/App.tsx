import 'react-native-url-polyfill/auto';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import SearchScreen from './screens/SearchScreen';
import TeacherDetailScreen from './screens/TeacherDetailScreen';
import WalletScreen from './screens/WalletScreen';

export type RootStackParamList = {
  Search: undefined;
  TeacherDetail: { teacherId: string };
  Wallet: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#ffffff' },
          headerTitleStyle: { fontWeight: '800', color: '#0f172a' },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Dạy Lái Xe Gần Bạn' }} />
        <Stack.Screen name="TeacherDetail" component={TeacherDetailScreen} options={{ title: 'Hồ sơ giáo viên' }} />
        <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: 'Ví của tôi' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
