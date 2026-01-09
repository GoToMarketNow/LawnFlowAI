import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { JobStatus, JobStatusType, getJobStatusLabel, getJobStatusColors } from '../../types/enums';

// ============================================
// Job Status Selector Component
// ============================================

interface JobStatusSelectorProps {
  currentStatus: JobStatusType;
  onStatusChange: (status: JobStatusType, reason?: string) => void;
  disabled?: boolean;
  allowedStatuses?: JobStatusType[];
}

export function JobStatusSelector({
  currentStatus,
  onStatusChange,
  disabled = false,
  allowedStatuses,
}: JobStatusSelectorProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const statuses: JobStatusType[] = allowedStatuses || [
    JobStatus.PENDING,
    JobStatus.IN_PROGRESS,
    JobStatus.COMPLETE,
    JobStatus.DELAYED,
    JobStatus.RESCHEDULED,
  ];

  const handleSelectStatus = (status: JobStatusType) => {
    onStatusChange(status);
    setModalVisible(false);
  };

  const currentColors = getJobStatusColors(currentStatus);
  const currentLabel = getJobStatusLabel(currentStatus);

  return (
    <>
      <TouchableOpacity
        style={[styles.selector, disabled && styles.disabled]}
        onPress={() => !disabled && setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.label}>Status:</Text>
        <View style={[styles.statusBadge, { backgroundColor: currentColors.bg }]}>
          <Text style={[styles.statusText, { color: currentColors.text }]}>{currentLabel}</Text>
        </View>
        {!disabled && <Text style={styles.arrow}>▼</Text>}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Job Status</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={statuses}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const colors = getJobStatusColors(item);
                const label = getJobStatusLabel(item);
                const isSelected = item === currentStatus;

                return (
                  <TouchableOpacity
                    style={[styles.statusOption, isSelected && styles.selectedOption]}
                    onPress={() => handleSelectStatus(item)}
                  >
                    <View style={[styles.statusIndicator, { backgroundColor: colors.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: colors.text }]} />
                    </View>
                    <Text style={[styles.statusLabel, isSelected && styles.selectedLabel]}>
                      {label}
                    </Text>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 12,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flex: 1,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  arrow: {
    fontSize: 12,
    color: '#999',
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
    paddingBottom: 34,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
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
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  selectedOption: {
    backgroundColor: '#F0F9FF',
  },
  statusIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  selectedLabel: {
    fontWeight: '600',
    color: '#2196F3',
  },
  checkmark: {
    fontSize: 20,
    color: '#2196F3',
    fontWeight: 'bold',
  },
});
