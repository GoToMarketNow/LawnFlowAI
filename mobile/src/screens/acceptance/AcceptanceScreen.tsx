import React, { useState } from 'react';
import { View, ScrollView, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { getScheduleToday } from '../../services/api/queries';
import { acceptSchedule, requestScheduleChanges } from '../../services/api/commands';
import { AddressLink } from '../../components/common/AddressLink';
import { trackEvent } from '../../services/analytics';
import { secureStorage } from '../../services/storage/secureStorage';

// ============================================
// Daily Schedule Acceptance Screen
// ============================================

export function AcceptanceScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);

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

  const { data, isLoading } = useQuery({
    queryKey: ['schedule-today'],
    queryFn: async () => {
      const result = await getScheduleToday();
      return result.data;
    },
  });

  const acceptMutation = useMutation({
    mutationFn: acceptSchedule,
    onSuccess: () => {
      trackEvent('schedule_accepted', { jobCount: jobs.length, role: userRole });
      queryClient.invalidateQueries({ queryKey: ['dashboard-today'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-today'] });

      Alert.alert(
        'Schedule Accepted',
        "You've confirmed today's jobs. Have a great day!",
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to accept schedule. Please try again.');
    },
  });

  const requestChangesMutation = useMutation({
    mutationFn: (note: string) => requestScheduleChanges(note),
    onSuccess: () => {
      trackEvent('schedule_changes_requested', { role: userRole });
      queryClient.invalidateQueries({ queryKey: ['dashboard-today'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-today'] });

      setShowRequestChanges(false);
      setChangeNote('');

      Alert.alert(
        'Request Submitted',
        'Your change request has been sent to dispatch. They will contact you shortly.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to submit request. Please try again.');
    },
  });

  const handleAccept = () => {
    acceptMutation.mutate();
  };

  const handleRequestChanges = () => {
    setShowRequestChanges(true);
  };

  const handleSubmitChangeRequest = () => {
    if (!changeNote.trim()) {
      Alert.alert('Note Required', 'Please describe the changes you need.');
      return;
    }
    requestChangesMutation.mutate(changeNote);
  };

  const jobs = data?.jobs || [];
  const acceptanceState = data?.acceptanceState;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading schedule...</Text>
      </View>
    );
  }

  if (acceptanceState?.accepted) {
    return (
      <View style={styles.container}>
        <View style={styles.alreadyAcceptedContainer}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.alreadyAcceptedTitle}>Schedule Already Accepted</Text>
          <Text style={styles.alreadyAcceptedText}>
            You accepted this schedule on{' '}
            {acceptanceState.acceptedAt
              ? new Date(acceptanceState.acceptedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'earlier today'}
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Review Today's Schedule</Text>
          <Text style={styles.subtitle}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        {/* Job Count */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Jobs:</Text>
            <View style={styles.jobCountBadge}>
              <Text style={styles.jobCountText}>{jobs.length}</Text>
            </View>
          </View>
        </View>

        {/* Jobs List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Jobs</Text>
          {jobs.map((job, index) => (
            <View key={job.id} style={styles.jobCard}>
              <View style={styles.jobNumber}>
                <Text style={styles.jobNumberText}>#{index + 1}</Text>
              </View>
              <View style={styles.jobContent}>
                <Text style={styles.jobCustomer}>{job.customerName || 'Customer'}</Text>
                <AddressLink
                  address={job.address || job.propertyAddress || ''}
                  coords={job.coords}
                  jobId={job.id}
                  role={userRole || undefined}
                  style={styles.jobAddress}
                />
                <View style={styles.jobMeta}>
                  <Text style={styles.jobService}>🔧 {job.serviceType}</Text>
                  {job.timeWindow && (
                    <Text style={styles.jobTime}>⏰ {job.timeWindow}</Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsText}>
            Please review your schedule and confirm you're ready for these jobs. If you need any
            changes, tap "Request Changes" to let dispatch know.
          </Text>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.requestChangesButton}
          onPress={handleRequestChanges}
          disabled={acceptMutation.isPending || requestChangesMutation.isPending}
        >
          <Text style={styles.requestChangesText}>Request Changes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.acceptButton}
          onPress={handleAccept}
          disabled={acceptMutation.isPending || requestChangesMutation.isPending}
        >
          <Text style={styles.acceptButtonText}>
            {acceptMutation.isPending ? 'Accepting...' : 'Accept Jobs'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Request Changes Modal */}
      <Modal
        visible={showRequestChanges}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRequestChanges(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Schedule Changes</Text>
              <TouchableOpacity onPress={() => setShowRequestChanges(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>What changes do you need?</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Describe the changes you need..."
              value={changeNote}
              onChangeText={setChangeNote}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowRequestChanges(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitButton}
                onPress={handleSubmitChangeRequest}
                disabled={requestChangesMutation.isPending}
              >
                <Text style={styles.modalSubmitText}>
                  {requestChangesMutation.isPending ? 'Submitting...' : 'Submit Request'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  summaryCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  jobCountBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 36,
    alignItems: 'center',
  },
  jobCountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  jobCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  jobNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  jobNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  jobContent: {
    flex: 1,
  },
  jobCustomer: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  jobAddress: {
    marginBottom: 8,
  },
  jobMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jobService: {
    fontSize: 14,
    color: '#666',
  },
  jobTime: {
    fontSize: 13,
    color: '#666',
  },
  instructionsCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  instructionsText: {
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 20,
  },
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  requestChangesButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  requestChangesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  acceptButton: {
    flex: 2,
    paddingVertical: 16,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Already accepted state
  alreadyAcceptedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successIcon: {
    fontSize: 64,
    color: '#4CAF50',
    marginBottom: 16,
  },
  alreadyAcceptedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  alreadyAcceptedText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#2196F3',
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    fontSize: 24,
    color: '#999',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 100,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalSubmitButton: {
    flex: 2,
    paddingVertical: 12,
    backgroundColor: '#FF9800',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
