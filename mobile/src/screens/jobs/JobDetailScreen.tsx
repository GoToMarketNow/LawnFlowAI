import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { getJobById } from '../../services/api/jobs';
import { QAPhotoViewer } from '../../components/jobs/QAPhotoViewer';
import { analytics } from '../../services/analytics';

type JobDetailRouteProp = RouteProp<{ JobDetail: { jobId: number } }, 'JobDetail'>;

export function JobDetailScreen() {
  const route = useRoute<JobDetailRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { jobId } = route.params;

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJobById(jobId),
  });

  if (isLoading || !job) {
    return (
      <View style={styles.center}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const showReminderCTA = job.hasReminder && job.status === 'upcoming';
  const showReviewCTA = job.status === 'completed';

  const handleReviewPress = () => {
    analytics.track('review_prompt_opened', { jobId, source: 'job_detail' });
    navigation.navigate('ReviewPrompt', { jobId });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{job.serviceType || 'Service'}</Text>
        <View style={[styles.status, job.status === 'completed' && styles.statusCompleted]}>
          <Text style={styles.statusText}>{job.status}</Text>
        </View>
      </View>

      {showReminderCTA && (
        <View style={styles.reminderCTA}>
          <Text style={styles.reminderTitle}>⏰ Reminder: {job.reminderStage}</Text>
          <Text style={styles.reminderText}>
            Your service is scheduled soon. Please confirm you're ready.
          </Text>
          <TouchableOpacity style={styles.acknowledgeButton}>
            <Text style={styles.acknowledgeButtonText}>Acknowledge</Text>
          </TouchableOpacity>
        </View>
      )}

      {showReviewCTA && (
        <View style={styles.reviewCTA}>
          <Text style={styles.reviewTitle}>✨ How was your service?</Text>
          <Text style={styles.reviewText}>
            Share your feedback to help us improve
          </Text>
          <TouchableOpacity style={styles.reviewButton} onPress={handleReviewPress}>
            <Text style={styles.reviewButtonText}>Leave a Review</Text>
          </TouchableOpacity>
        </View>
      )}

      {showReviewCTA && <QAPhotoViewer jobId={jobId} />}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        {job.propertyAddress && (
          <View style={styles.row}>
            <Text style={styles.label}>Address:</Text>
            <Text style={styles.value}>{job.propertyAddress}</Text>
          </View>
        )}
        {job.scheduledDate && (
          <View style={styles.row}>
            <Text style={styles.label}>Scheduled:</Text>
            <Text style={styles.value}>
              {new Date(job.scheduledDate).toLocaleString()}
            </Text>
          </View>
        )}
        {job.completedDate && (
          <View style={styles.row}>
            <Text style={styles.label}>Completed:</Text>
            <Text style={styles.value}>
              {new Date(job.completedDate).toLocaleString()}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  status: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusCompleted: {
    backgroundColor: '#22C55E',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  reminderCTA: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  reminderText: {
    fontSize: 14,
    color: '#78350F',
    marginBottom: 12,
  },
  acknowledgeButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  acknowledgeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reviewCTA: {
    backgroundColor: '#DBEAFE',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E3A8A',
    marginBottom: 8,
  },
  reviewText: {
    fontSize: 14,
    color: '#1E40AF',
    marginBottom: 12,
  },
  reviewButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  reviewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  row: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#000',
  },
});
