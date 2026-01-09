import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { exchangeInviteToken } from '../../services/api/auth';
import { useAuthStore } from '../../store/authStore';
import type { AuthStackParamList, RootStackParamList } from '../../navigation/types';

type InviteLoginScreenRouteProp = RouteProp<AuthStackParamList, 'InviteLogin'>;
type InviteLoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function InviteLoginScreen() {
  const route = useRoute<InviteLoginScreenRouteProp>();
  const navigation = useNavigation<InviteLoginScreenNavigationProp>();
  const [error, setError] = useState<string | null>(null);
  const { token } = route.params;
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    async function login() {
      try {
        const { token: jwtToken, user } = await exchangeInviteToken(token);
        setAuth(jwtToken, user);
        navigation.replace('Main');
      } catch (err: any) {
        setError(err.message || 'Invalid or expired invite link');
      }
    }
    login();
  }, [token]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#22C55E" />
      <Text style={styles.text}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  error: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
