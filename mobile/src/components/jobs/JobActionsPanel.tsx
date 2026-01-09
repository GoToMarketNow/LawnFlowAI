import React, { useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useJobActions } from '../../hooks/useJobActions';
import type { Job } from '../../services/api/queries';

// ============================================
// Job Actions Panel - Field Crew Interface
// ============================================

interface JobActionsPanelProps {
  job: Job;
  onActionComplete?: () => void;
}

export function JobActionsPanel({ job, onActionComplete }: JobActionsPanelProps) {
  const [showNoteInput, setShowNoteInput] = useState(false);

  const {
    startJob,
    pauseJob,
    resumeJob,
    completeJob,
    isStarting,
    isPausing,
    isResuming,
    isCompleting,
    isLoading,
  } = useJobActions(job.id, {
    onSuccess: () => {
      onActionComplete?.();
    },
  });

  // ============================================
  // Action Handlers
  // ============================================

  const handleStartJob = () => {
    Alert.alert(
      'Start Job',
      `Start ${job.serviceType} for ${job.customerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: () => startJob(),
        },
      ]
    );
  };

  const handlePauseJob = () => {
    Alert.alert(
      'Pause Job',
      'Select pause reason:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Break', onPress: () => pauseJob('break') },
        { text: 'Equipment Issue', onPress: () => pauseJob('equipment') },
        { text: 'Weather', onPress: () => pauseJob('weather') },
        { text: 'Other', onPress: () => pauseJob('other') },
      ]
    );
  };

  const handleResumeJob = () => {
    resumeJob();
  };

  const handleCompleteJob = () => {
    // Check if QA requirements met
    if (job.requiredPhotos && job.uploadedPhotos < job.requiredPhotos) {
      Alert.alert(
        'Photos Required',
        `Please upload ${job.requiredPhotos - job.uploadedPhotos} more photo(s) before completing.`,
        [{ text: 'OK' }]
      );
      return;
    }

    if (job.checklistComplete === false) {
      Alert.alert(
        'Checklist Incomplete',
        'Please complete the QA checklist before marking job as complete.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Complete Job',
      'Mark this job as complete? Payment will be processed automatically.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'default',
          onPress: () => completeJob(),
        },
      ]
    );
  };

  // ============================================
  // Render Action Buttons
  // ============================================

  const renderActions = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      );
    }

    switch (job.status) {
      case 'scheduled':
        return (
          <Button
            mode="contained"
            onPress={handleStartJob}
            disabled={isStarting}
            loading={isStarting}
            style={styles.startButton}
            icon="play"
          >
            Start Job
          </Button>
        );

      case 'in_progress':
        return (
          <View style={styles.actionsRow}>
            <Button
              mode="outlined"
              onPress={handlePauseJob}
              disabled={isPausing}
              loading={isPausing}
              style={[styles.actionButton, styles.pauseButton]}
              icon="pause"
            >
              Pause
            </Button>
            <Button
              mode="contained"
              onPress={handleCompleteJob}
              disabled={isCompleting}
              loading={isCompleting}
              style={[styles.actionButton, styles.completeButton]}
              icon="check"
            >
              Complete
            </Button>
          </View>
        );

      case 'paused':
        return (
          <Button
            mode="contained"
            onPress={handleResumeJob}
            disabled={isResuming}
            loading={isResuming}
            style={styles.resumeButton}
            icon="play"
          >
            Resume Job
          </Button>
        );

      case 'completed':
        return (
          <View style={styles.completedContainer}>
            <Text style={styles.completedText}>✓ Job Completed</Text>
            {job.paymentStatus && (
              <Text style={styles.paymentStatus}>
                {job.paymentStatus === 'captured' && '✓ Payment Processed'}
                {job.paymentStatus === 'pending' && '⏳ Payment Processing...'}
                {job.paymentStatus === 'failed' && '⚠ Payment Issue - Contact Ops'}
              </Text>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>{job.status.replace('_', ' ').toUpperCase()}</Text>
      </View>

      {renderActions()}

      {job.status === 'in_progress' && (
        <View style={styles.timerContainer}>
          <Text style={styles.timerLabel}>Started:</Text>
          <Text style={styles.timerValue}>
            {job.actualStartISO ? new Date(job.actualStartISO).toLocaleTimeString() : '--'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  pauseButton: {
    borderColor: '#FF9800',
  },
  completeButton: {
    backgroundColor: '#2196F3',
  },
  resumeButton: {
    backgroundColor: '#4CAF50',
  },
  completedContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  completedText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 8,
  },
  paymentStatus: {
    fontSize: 14,
    color: '#666',
  },
  timerContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timerLabel: {
    fontSize: 14,
    color: '#666',
  },
  timerValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
});
