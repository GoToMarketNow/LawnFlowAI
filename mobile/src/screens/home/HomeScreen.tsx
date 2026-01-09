import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useJobStore } from '../../store/jobStore';
import { NotificationBanner } from '../../components/notifications/NotificationBanner';
import { ReminderBanner } from '../../components/jobs/ReminderBanner';
import { fetchJobs } from '../../services/api/jobs';

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const user = useAuthStore((state) => state.user);
  const setJobs = useJobStore((state) => state.setJobs);
  const upcomingJobs = useJobStore((state) => state.upcomingJobs);

  const { data: jobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: fetchJobs,
    onSuccess: (data) => {
      setJobs(data);
    },
  });

  return (
    <View style={styles.container}>
      <NotificationBanner />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Welcome to LawnFlow</Text>
        {user && <Text style={styles.subtitle}>{user.email}</Text>}

        <TouchableOpacity
          style={styles.requestButton}
          onPress={() => navigation.navigate('Services')}
        >
          <Text style={styles.requestButtonText}>➕ Request New Service</Text>
        </TouchableOpacity>

        <ReminderBanner />

        {upcomingJobs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Services</Text>
            <Text style={styles.count}>{upcomingJobs.length} scheduled</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  count: {
    fontSize: 14,
    color: '#666',
  },
  requestButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
