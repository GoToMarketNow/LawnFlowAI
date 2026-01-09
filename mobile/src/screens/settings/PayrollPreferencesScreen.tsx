import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { getPayrollPreferences } from '../../services/api/queries';
import { updatePayrollPreferences } from '../../services/api/commands';
import { trackEvent } from '../../services/analytics';
import { secureStorage } from '../../services/storage/secureStorage';

// ============================================
// Payroll Preferences Screen
// ============================================

type PayFrequency = 'per_job' | 'daily' | 'weekly' | 'scheduled';
type PayMethod = 'cash' | 'zelle' | 'cashapp' | 'ach';

export function PayrollPreferencesScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [payFrequency, setPayFrequency] = useState<PayFrequency>('weekly');
  const [payMethods, setPayMethods] = useState<PayMethod[]>(['cash']);
  const [preferredMethod, setPreferredMethod] = useState<PayMethod>('cash');
  const [zelleHandle, setZelleHandle] = useState('');
  const [cashappHandle, setCashappHandle] = useState('');
  const [achRouting, setAchRouting] = useState('');
  const [achAccount, setAchAccount] = useState('');
  const [achAccountType, setAchAccountType] = useState<'checking' | 'savings'>('checking');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    const userJson = await secureStorage.getItem('user');
    if (userJson) {
      const user = JSON.parse(userJson);
      setUserRole(user.role);
    }
  };

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['payroll-preferences'],
    queryFn: async () => {
      const result = await getPayrollPreferences();
      return result.data;
    },
    onSuccess: (data) => {
      if (data) {
        setPayFrequency(data.payFrequency);
        setPayMethods(data.payMethods);
        setPreferredMethod(data.preferredMethod);
        setZelleHandle(data.payoutDetails.zelle || '');
        setCashappHandle(data.payoutDetails.cashapp || '');
        setAchRouting(data.payoutDetails.ach?.routing || '');
        setAchAccount(data.payoutDetails.ach?.account || '');
        setAchAccountType(data.payoutDetails.ach?.accountType || 'checking');
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payoutDetails: any = {};

      if (payMethods.includes('zelle') && zelleHandle) {
        payoutDetails.zelle = zelleHandle;
      }

      if (payMethods.includes('cashapp') && cashappHandle) {
        payoutDetails.cashapp = cashappHandle;
      }

      if (payMethods.includes('ach') && achRouting && achAccount) {
        payoutDetails.ach = {
          routing: achRouting,
          account: achAccount,
          accountType: achAccountType,
        };
      }

      return updatePayrollPreferences({
        payFrequency,
        payMethods,
        preferredMethod,
        payoutDetails,
      });
    },
    onSuccess: () => {
      trackEvent('payroll_preferences_updated', {
        payFrequency,
        payMethodsCount: payMethods.length,
        preferredMethod,
        role: userRole,
      });

      queryClient.invalidateQueries({ queryKey: ['payroll-preferences'] });

      Alert.alert('Saved', 'Your payroll preferences have been updated successfully.');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to save preferences. Please try again.');
    },
  });

  const togglePayMethod = (method: PayMethod) => {
    setPayMethods((prev) => {
      if (prev.includes(method)) {
        const newMethods = prev.filter((m) => m !== method);
        // If preferred method is being removed, set new preferred
        if (method === preferredMethod && newMethods.length > 0) {
          setPreferredMethod(newMethods[0]);
        }
        return newMethods;
      } else {
        return [...prev, method];
      }
    });
  };

  const handleSave = () => {
    if (payMethods.length === 0) {
      Alert.alert('Required', 'Please select at least one payment method.');
      return;
    }

    if (!payMethods.includes(preferredMethod)) {
      setPreferredMethod(payMethods[0]);
    }

    // Validate method-specific fields
    if (payMethods.includes('zelle') && !zelleHandle.trim()) {
      Alert.alert('Required', 'Please enter your Zelle phone number or email.');
      return;
    }

    if (payMethods.includes('cashapp') && !cashappHandle.trim()) {
      Alert.alert('Required', 'Please enter your Cash App $handle.');
      return;
    }

    if (payMethods.includes('ach')) {
      if (!achRouting.trim() || !achAccount.trim()) {
        Alert.alert('Required', 'Please enter your bank routing and account numbers.');
        return;
      }
    }

    saveMutation.mutate();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading preferences...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Payroll & Pay Preferences</Text>
        <Text style={styles.subtitle}>
          Configure how and when you receive your payments
        </Text>
      </View>

      {/* Pay Frequency */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pay Frequency</Text>
        <Text style={styles.sectionSubtitle}>How often do you want to get paid?</Text>

        {(['per_job', 'daily', 'weekly', 'scheduled'] as PayFrequency[]).map((freq) => (
          <TouchableOpacity
            key={freq}
            style={[
              styles.optionCard,
              payFrequency === freq && styles.optionCardSelected,
            ]}
            onPress={() => setPayFrequency(freq)}
          >
            <Text style={styles.optionText}>
              {freq === 'per_job' && '💼 Per Job'}
              {freq === 'daily' && '📅 Daily'}
              {freq === 'weekly' && '📊 Weekly'}
              {freq === 'scheduled' && '🗓️ Scheduled (e.g., Bi-weekly)'}
            </Text>
            {payFrequency === freq && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* Payment Methods */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Methods</Text>
        <Text style={styles.sectionSubtitle}>
          Select all methods you accept (select at least one)
        </Text>

        {(['cash', 'zelle', 'cashapp', 'ach'] as PayMethod[]).map((method) => (
          <TouchableOpacity
            key={method}
            style={[
              styles.methodCard,
              payMethods.includes(method) && styles.methodCardSelected,
            ]}
            onPress={() => togglePayMethod(method)}
          >
            <View style={styles.methodHeader}>
              <Text style={styles.methodText}>
                {method === 'cash' && '💵 Cash'}
                {method === 'zelle' && '🏦 Zelle'}
                {method === 'cashapp' && '💳 Cash App'}
                {method === 'ach' && '🏛️ ACH (Bank Transfer)'}
              </Text>
              <View
                style={[
                  styles.checkbox,
                  payMethods.includes(method) && styles.checkboxSelected,
                ]}
              >
                {payMethods.includes(method) && <Text style={styles.checkboxCheck}>✓</Text>}
              </View>
            </View>

            {/* Method-specific fields */}
            {payMethods.includes(method) && method === 'zelle' && (
              <TextInput
                style={styles.input}
                placeholder="Phone number or email"
                value={zelleHandle}
                onChangeText={setZelleHandle}
                keyboardType="email-address"
              />
            )}

            {payMethods.includes(method) && method === 'cashapp' && (
              <TextInput
                style={styles.input}
                placeholder="$handle"
                value={cashappHandle}
                onChangeText={setCashappHandle}
                autoCapitalize="none"
              />
            )}

            {payMethods.includes(method) && method === 'ach' && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Routing number"
                  value={achRouting}
                  onChangeText={setAchRouting}
                  keyboardType="number-pad"
                  maxLength={9}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Account number"
                  value={achAccount}
                  onChangeText={setAchAccount}
                  keyboardType="number-pad"
                  secureTextEntry
                />
                <View style={styles.accountTypeRow}>
                  <TouchableOpacity
                    style={[
                      styles.accountTypeButton,
                      achAccountType === 'checking' && styles.accountTypeButtonSelected,
                    ]}
                    onPress={() => setAchAccountType('checking')}
                  >
                    <Text
                      style={[
                        styles.accountTypeText,
                        achAccountType === 'checking' && styles.accountTypeTextSelected,
                      ]}
                    >
                      Checking
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.accountTypeButton,
                      achAccountType === 'savings' && styles.accountTypeButtonSelected,
                    ]}
                    onPress={() => setAchAccountType('savings')}
                  >
                    <Text
                      style={[
                        styles.accountTypeText,
                        achAccountType === 'savings' && styles.accountTypeTextSelected,
                      ]}
                    >
                      Savings
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Preferred Method */}
      {payMethods.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred Method</Text>
          <Text style={styles.sectionSubtitle}>
            Your primary payment method when multiple options are available
          </Text>

          {payMethods.map((method) => (
            <TouchableOpacity
              key={method}
              style={[
                styles.optionCard,
                preferredMethod === method && styles.optionCardSelected,
              ]}
              onPress={() => setPreferredMethod(method)}
            >
              <Text style={styles.optionText}>
                {method === 'cash' && '💵 Cash'}
                {method === 'zelle' && '🏦 Zelle'}
                {method === 'cashapp' && '💳 Cash App'}
                {method === 'ach' && '🏛️ ACH'}
              </Text>
              {preferredMethod === method && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoIcon}>🔒</Text>
        <View style={styles.infoContent}>
          <Text style={styles.infoText}>
            Your payment information is encrypted and stored securely. We never share your financial details.
          </Text>
        </View>
      </View>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saveMutation.isPending}
        >
          <Text style={styles.saveButtonText}>
            {saveMutation.isPending ? 'Saving...' : 'Save Preferences'}
          </Text>
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
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  optionText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  checkmark: {
    fontSize: 18,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  methodCard: {
    padding: 14,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodCardSelected: {
    backgroundColor: '#F0F9FF',
    borderColor: '#2196F3',
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  methodText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#999',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  checkboxCheck: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    padding: 12,
    fontSize: 15,
    color: '#333',
    marginTop: 8,
  },
  accountTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  accountTypeButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    alignItems: 'center',
  },
  accountTypeButtonSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  accountTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  accountTypeTextSelected: {
    color: '#FFFFFF',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoText: {
    fontSize: 14,
    color: '#2E7D32',
    lineHeight: 20,
  },
  footer: {
    padding: 16,
  },
  saveButton: {
    paddingVertical: 16,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
