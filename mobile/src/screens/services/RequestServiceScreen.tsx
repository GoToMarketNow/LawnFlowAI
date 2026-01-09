import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { createServiceRequest } from '../../services/api/serviceRequests';
import { useServiceStore } from '../../store/serviceStore';
import { analytics } from '../../services/analytics';

export function RequestServiceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const selectedService = useServiceStore((state) => state.selectedService);

  const [preferredDate, setPreferredDate] = useState('');
  const [notes, setNotes] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      createServiceRequest({
        serviceId: selectedService!.id,
        preferredDate: preferredDate || undefined,
        notes: notes || undefined,
      }),
    onSuccess: (request) => {
      analytics.track('service_request_submitted', {
        serviceId: selectedService!.id,
        requiresApproval: selectedService!.requiresApproval,
      });
      navigation.navigate('ServiceRequestDetail', { requestId: request.id });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    },
  });

  if (!selectedService) {
    return (
      <View style={styles.center}>
        <Text>No service selected</Text>
      </View>
    );
  }

  const handleSubmit = () => {
    if (notes.length > 200) {
      Alert.alert('Error', 'Notes must be 200 characters or less');
      return;
    }
    createMutation.mutate();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>Service</Text>
        <Text style={styles.serviceName}>{selectedService.name}</Text>
        <Text style={styles.serviceDesc}>{selectedService.description}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Preferred Date (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="ASAP (or YYYY-MM-DD)"
          value={preferredDate}
          onChangeText={setPreferredDate}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Notes (optional, max 200 chars)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Any special instructions..."
          multiline
          numberOfLines={4}
          value={notes}
          onChangeText={setNotes}
          maxLength={200}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{notes.length}/200</Text>
      </View>

      <TouchableOpacity
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={createMutation.isLoading}
      >
        <Text style={styles.submitButtonText}>
          {createMutation.isLoading ? 'Submitting...' : 'Submit Request'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  label: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8 },
  serviceName: { fontSize: 18, fontWeight: '600', color: '#000', marginBottom: 4 },
  serviceDesc: { fontSize: 14, color: '#666' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16 },
  textArea: { minHeight: 100 },
  charCount: { fontSize: 12, color: '#999', marginTop: 4, textAlign: 'right' },
  submitButton: { backgroundColor: '#3B82F6', margin: 20, padding: 16, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
