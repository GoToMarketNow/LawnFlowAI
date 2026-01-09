import React, { useState } from 'react';
import { View, ScrollView, Text, StyleSheet, TouchableOpacity, Linking, Alert, TextInput } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getJob } from '../../services/api/queries';
import { updateJobStatus } from '../../services/api/commands';
import { AddressLink } from '../../components/common/AddressLink';
import { StatusPill } from '../../components/common/StatusPill';
import { JobStatusSelector } from '../../components/jobs/JobStatusSelector';
import { JobStatusType } from '../../types/enums';
import { trackEvent } from '../../services/analytics';
import { secureStorage } from '../../services/storage/secureStorage';

// ============================================
// Enhanced Job Detail Screen (Execution View)
// ============================================

export function EnhancedJobDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { jobId } = route.params as { jobId: number };

  const [userRole, setUserRole] = useState<string | null>(null);
  const [showTasksExpanded, setShowTasksExpanded] = useState(true);
  const [completionNotes, setCompletionNotes] = useState('');

  React.useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    const userJson = await secureStorage.getItem('user');
    if (userJson) {
      const user = JSON.parse(userJson);
      setUserRole(user.role);
    }
  };

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const result = await getJob(jobId);
      return result.data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (params: { status: JobStatusType; reason?: string }) =>
      updateJobStatus({ jobId, ...params }),
    onSuccess: (_, variables) => {
      trackEvent('job_status_changed', {
        jobId,
        newStatus: variables.status,
        role: userRole,
      });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-today'] });
      queryClient.invalidateQueries({ queryKey: ['today-jobs'] });
    },
  });

  const handleStatusChange = (status: JobStatusType, reason?: string) => {
    updateStatusMutation.mutate({ status, reason });
  };

  const handleCallCustomer = () => {
    if (job?.customerPhone) {
      Linking.openURL(`tel:${job.customerPhone}`);
    }
  };

  const handleMessageOwner = () => {
    navigation.navigate('Messages' as never, {
      screen: 'Thread',
      params: { threadType: 'ops', jobId },
    } as never);
  };

  const handleMessageCustomer = () => {
    navigation.navigate('Messages' as never, {
      screen: 'Thread',
      params: { threadType: 'customer_proxy', jobId },
    } as never);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading job details...</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Job not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.customerName}>{job.customerName || 'Customer'}</Text>
          <Text style={styles.serviceType}>{job.serviceType}</Text>
        </View>
        <StatusPill status={job.status as JobStatusType} size="medium" />
      </View>

      {/* Address & Directions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <AddressLink
          address={job.address || job.propertyAddress || ''}
          coords={job.coords}
          jobId={job.id}
          role={userRole || undefined}
        />
      </View>

      {/* Time Window */}
      {job.timeWindow && (
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>⏰ Time Window:</Text>
            <Text style={styles.infoValue}>{job.timeWindow}</Text>
          </View>
        </View>
      )}

      {/* Status Selector */}
      <View style={styles.section}>
        <JobStatusSelector
          currentStatus={job.status as JobStatusType}
          onStatusChange={handleStatusChange}
          disabled={updateStatusMutation.isPending}
        />
      </View>

      {/* What We're Doing */}
      {job.whatWereDoing && job.whatWereDoing.length > 0 && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowTasksExpanded(!showTasksExpanded)}
          >
            <Text style={styles.sectionTitle}>What We're Doing</Text>
            <Text style={styles.expandIcon}>{showTasksExpanded ? '▼' : '▶'}</Text>
          </TouchableOpacity>

          {showTasksExpanded && (
            <View style={styles.tasksList}>
              {job.whatWereDoing.map((task, index) => (
                <View key={task.id || index} style={styles.taskItem}>
                  <View style={styles.taskBullet}>
                    <Text style={styles.taskBulletText}>•</Text>
                  </View>
                  <Text style={styles.taskText}>{task.description}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Customer Notes */}
      {job.customerNotes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Notes</Text>
          <View style={styles.notesCard}>
            <Text style={styles.notesText}>{job.customerNotes}</Text>
          </View>
        </View>
      )}

      {/* Access Instructions */}
      {job.accessInstructions && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Access Instructions</Text>
          <View style={styles.accessCard}>
            <Text style={styles.accessIcon}>🔑</Text>
            <Text style={styles.accessText}>{job.accessInstructions}</Text>
          </View>
        </View>
      )}

      {/* Communication Shortcuts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Communication</Text>
        <View style={styles.communicationButtons}>
          {job.customerPhone && (
            <TouchableOpacity style={styles.commButton} onPress={handleCallCustomer}>
              <Text style={styles.commIcon}>📞</Text>
              <Text style={styles.commText}>Call Customer</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.commButton} onPress={handleMessageCustomer}>
            <Text style={styles.commIcon}>💬</Text>
            <Text style={styles.commText}>Message Customer</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.commButton} onPress={handleMessageOwner}>
            <Text style={styles.commIcon}>👔</Text>
            <Text style={styles.commText}>Message Owner</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Completion Flow (if status allows) */}
      {job.status === 'IN_PROGRESS' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Complete Job</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add completion notes (optional)..."
            value={completionNotes}
            onChangeText={setCompletionNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => handleStatusChange('COMPLETE' as JobStatusType, completionNotes)}
            disabled={updateStatusMutation.isPending}
          >
            <Text style={styles.completeButtonText}>
              {updateStatusMutation.isPending ? 'Completing...' : 'Mark Complete'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  errorText: {
    fontSize: 16,
    color: '#D32F2F',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  customerName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  serviceType: {
    fontSize: 15,
    color: '#2196F3',
    fontWeight: '500',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    marginBottom: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  expandIcon: {
    fontSize: 14,
    color: '#999',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  tasksList: {
    gap: 12,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  taskBullet: {
    width: 24,
    paddingTop: 2,
  },
  taskBulletText: {
    fontSize: 18,
    color: '#2196F3',
  },
  taskText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  notesCard: {
    padding: 12,
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FFB300',
  },
  notesText: {
    fontSize: 14,
    color: '#5D4037',
    lineHeight: 20,
  },
  accessCard: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  accessIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  accessText: {
    flex: 1,
    fontSize: 14,
    color: '#2E7D32',
    lineHeight: 20,
  },
  communicationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  commButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 8,
  },
  commIcon: {
    fontSize: 18,
  },
  commText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 100,
    marginBottom: 12,
  },
  completeButton: {
    paddingVertical: 16,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
