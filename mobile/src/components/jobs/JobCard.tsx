import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Job } from '../../services/api/types';
import type { MainTabParamList } from '../../navigation/types';

interface JobCardProps {
  job: Job;
}

export function JobCard({ job }: JobCardProps) {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const handlePress = () => {
    navigation.navigate('JobDetail', { jobId: job.id });
  };

  const statusColor = job.status === 'completed' ? '#22C55E' : '#3B82F6';
  const reminderBadge = job.hasReminder && job.status === 'upcoming';

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress}>
      <View style={styles.header}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{job.status}</Text>
        </View>
        {reminderBadge && (
          <View style={styles.reminderBadge}>
            <Text style={styles.reminderText}>Reminder {job.reminderStage}</Text>
          </View>
        )}
      </View>

      {job.serviceType && <Text style={styles.service}>{job.serviceType}</Text>}
      {job.propertyAddress && <Text style={styles.address}>{job.propertyAddress}</Text>}

      {job.scheduledDate && (
        <Text style={styles.date}>
          Scheduled: {new Date(job.scheduledDate).toLocaleDateString()}
        </Text>
      )}
      {job.completedDate && (
        <Text style={styles.date}>
          Completed: {new Date(job.completedDate).toLocaleDateString()}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  reminderBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reminderText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '600',
  },
  service: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  date: {
    fontSize: 13,
    color: '#999',
  },
});
