import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { CrewStatus, CrewStatusType, getCrewStatusLabel, getCrewStatusColor } from '../../types/enums';

// ============================================
// Crew Status Selector Component
// Allows crew members to update their current status
// ============================================

interface CrewStatusSelectorProps {
  currentStatus: CrewStatusType;
  onStatusChange: (status: CrewStatusType) => void;
  disabled?: boolean;
}

export function CrewStatusSelector({ currentStatus, onStatusChange, disabled = false }: CrewStatusSelectorProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const statuses: CrewStatusType[] = [
    CrewStatus.ON_SITE,
    CrewStatus.EN_ROUTE,
    CrewStatus.ON_BREAK,
  ];

  const handleSelectStatus = (status: CrewStatusType) => {
    onStatusChange(status);
    setModalVisible(false);
  };

  const currentColor = getCrewStatusColor(currentStatus);
  const currentLabel = getCrewStatusLabel(currentStatus);

  return (
    <>
      <TouchableOpacity
        style={[styles.selector, disabled && styles.disabled]}
        onPress={() => !disabled && setModalVisible(true)}
        activeOpacity={0.7}
      >
        <View style={styles.content}>
          <Text style={styles.label}>My Status:</Text>
          <View style={[styles.statusBadge, { backgroundColor: currentColor }]}>
            <Text style={styles.statusText}>{currentLabel}</Text>
          </View>
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
              <Text style={styles.modalTitle}>Update Your Status</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={statuses}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const color = getCrewStatusColor(item);
                const label = getCrewStatusLabel(item);
                const isSelected = item === currentStatus;

                return (
                  <TouchableOpacity
                    style={[styles.statusOption, isSelected && styles.selectedOption]}
                    onPress={() => handleSelectStatus(item)}
                  >
                    <View style={[styles.statusIndicator, { backgroundColor: color }]} />
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
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  disabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
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
    maxHeight: '50%',
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
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
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
