import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useJobStore } from '../../store/jobStore';
import { analytics } from '../../services/analytics';

export function ReminderBanner() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const pendingReminders = useJobStore((state) => state.pendingReminders);

  if (pendingReminders.length === 0) return null;

  const handleAcknowledge = () => {
    analytics.track('reminder_opened', {
      count: pendingReminders.length,
      jobIds: pendingReminders.map((j) => j.id),
    });
    navigation.navigate('Jobs');
  };

  const reminderCount = pendingReminders.length;
  const urgentReminders = pendingReminders.filter((j) => j.reminderStage === 'dayof');

  return (
    <View style={[styles.banner, urgentReminders.length > 0 && styles.urgent]}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {urgentReminders.length > 0 ? '🔔 Urgent Reminder' : '📅 Upcoming Service'}
        </Text>
        <Text style={styles.message}>
          You have {reminderCount} {reminderCount === 1 ? 'job' : 'jobs'} requiring attention
        </Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={handleAcknowledge}>
        <Text style={styles.buttonText}>View</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#DBEAFE',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    marginBottom: 16,
  },
  urgent: {
    backgroundColor: '#FEE2E2',
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#1E40AF',
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
