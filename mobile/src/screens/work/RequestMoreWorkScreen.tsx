import React, { useState } from 'react';
import { View, ScrollView, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { submitWorkRequest } from '../../services/api/commands';
import { trackEvent } from '../../services/analytics';
import { secureStorage } from '../../services/storage/secureStorage';

// ============================================
// Request More Work Screen
// ============================================

type TimeframeType = 'today' | 'this_week';

export function RequestMoreWorkScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeType>('today');
  const [note, setNote] = useState('');
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

  const submitMutation = useMutation({
    mutationFn: () => submitWorkRequest({ timeframe: selectedTimeframe, note }),
    onSuccess: () => {
      trackEvent('work_request_submitted', {
        timeframe: selectedTimeframe,
        hasNote: !!note,
        role: userRole,
      });

      queryClient.invalidateQueries({ queryKey: ['dashboard-today'] });

      Alert.alert(
        'Request Submitted',
        'Your request for more work has been sent to dispatch. They will contact you soon!',
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

  const handleSubmit = () => {
    if (!note.trim()) {
      Alert.alert(
        'Add Details',
        'Please provide some details about your availability or preferences.',
        [{ text: 'OK' }]
      );
      return;
    }

    submitMutation.mutate();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Request More Work</Text>
        <Text style={styles.subtitle}>
          Let dispatch know you're available for additional jobs
        </Text>
      </View>

      {/* Timeframe Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>When are you available?</Text>

        <TouchableOpacity
          style={[
            styles.optionCard,
            selectedTimeframe === 'today' && styles.optionCardSelected,
          ]}
          onPress={() => setSelectedTimeframe('today')}
          activeOpacity={0.7}
        >
          <View style={styles.optionContent}>
            <View>
              <Text style={styles.optionTitle}>Today</Text>
              <Text style={styles.optionDescription}>
                I can take on more work today
              </Text>
            </View>
            {selectedTimeframe === 'today' && (
              <View style={styles.radioSelected}>
                <View style={styles.radioDot} />
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.optionCard,
            selectedTimeframe === 'this_week' && styles.optionCardSelected,
          ]}
          onPress={() => setSelectedTimeframe('this_week')}
          activeOpacity={0.7}
        >
          <View style={styles.optionContent}>
            <View>
              <Text style={styles.optionTitle}>This Week</Text>
              <Text style={styles.optionDescription}>
                I'm available for more work this week
              </Text>
            </View>
            {selectedTimeframe === 'this_week' && (
              <View style={styles.radioSelected}>
                <View style={styles.radioDot} />
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Additional Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Additional Details</Text>
        <Text style={styles.sectionSubtitle}>
          Tell us about your availability, preferences, or any other details
        </Text>

        <TextInput
          style={styles.noteInput}
          placeholder="Example: Available all day, prefer mowing jobs, have truck available..."
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoIcon}>💡</Text>
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>What happens next?</Text>
          <Text style={styles.infoText}>
            Dispatch will review your request and contact you if additional work becomes available that matches your availability.
          </Text>
        </View>
      </View>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={submitMutation.isPending}
          activeOpacity={0.8}
        >
          <Text style={styles.submitButtonText}>
            {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={submitMutation.isPending}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    lineHeight: 21,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  optionCardSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#F0F9FF',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
  },
  radioSelected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2196F3',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#333',
    minHeight: 140,
    backgroundColor: '#FFFFFF',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1565C0',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    gap: 12,
  },
  submitButton: {
    paddingVertical: 16,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
});
