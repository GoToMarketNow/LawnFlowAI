import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNotificationPermission } from '../../hooks/useNotificationPermission';
import { analytics } from '../../services/analytics';

export function NotificationBanner() {
  const { hasPermission, requestPermission } = useNotificationPermission();

  if (hasPermission !== false) return null;

  const handleEnable = async () => {
    analytics.track('notification_opened', {});
    const granted = await requestPermission();
    if (granted) {
      console.log('[NotificationBanner] Permission granted');
    }
  };

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Enable notifications to stay updated on your jobs</Text>
      <TouchableOpacity onPress={handleEnable} style={styles.button}>
        <Text style={styles.buttonText}>Enable</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
    marginRight: 12,
  },
  button: {
    backgroundColor: '#856404',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
