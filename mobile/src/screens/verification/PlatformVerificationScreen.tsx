import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../../services/api/client';
import { useAuthStore } from '../../store/authStore';
import { analytics } from '../../services/analytics';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react-native';
import { Button } from '../../components/common/Button';

interface VerificationCheck {
  id: string;
  name: string;
  status: 'pending' | 'checking' | 'passed' | 'failed';
  message?: string;
}

export default function PlatformVerificationScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const [checks, setChecks] = useState<VerificationCheck[]>([
    {
      id: 'device_binding',
      name: 'Device Binding',
      status: 'pending',
    },
    {
      id: '2fa_setup',
      name: 'Two-Factor Authentication',
      status: 'pending',
    },
    {
      id: 'api_connectivity',
      name: 'API Connectivity',
      status: 'pending',
    },
    {
      id: 'data_sync',
      name: 'Data Synchronization',
      status: 'pending',
    },
    {
      id: 'push_notifications',
      name: 'Push Notifications',
      status: 'pending',
    },
  ]);
  const [overallStatus, setOverallStatus] = useState<'running' | 'passed' | 'failed'>('running');
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    runVerificationChecks();
  }, []);

  const runVerificationChecks = async () => {
    setOverallStatus('running');
    analytics.track('platform_verification_started');

    try {
      // Check 1: Device Binding
      await runCheck('device_binding', async () => {
        const response = await apiClient.get(`/api/mobile-binding/status/${user?.id}`);
        if (!response.data.has_mobile_binding) {
          throw new Error('No device binding found');
        }
        return 'Device successfully bound';
      });

      // Check 2: 2FA Setup
      await runCheck('2fa_setup', async () => {
        const response = await apiClient.get('/api/auth/me');
        if (!response.data.phoneVerifiedAt) {
          throw new Error('Phone not verified');
        }
        return '2FA enabled and verified';
      });

      // Check 3: API Connectivity
      await runCheck('api_connectivity', async () => {
        await apiClient.get('/api/auth/me');
        return 'Connected to LawnFlow servers';
      });

      // Check 4: Data Sync
      await runCheck('data_sync', async () => {
        // Try to fetch some data to verify sync
        const response = await apiClient.get('/api/jobs');
        return `Synced ${response.data.jobs?.length || 0} jobs`;
      });

      // Check 5: Push Notifications (optional)
      await runCheck('push_notifications', async () => {
        const { getExpoPushTokenAsync } = require('expo-notifications');
        const { status } = await require('expo-notifications').getPermissionsAsync();
        
        if (status !== 'granted') {
          throw new Error('Permission not granted');
        }
        
        const token = await getExpoPushTokenAsync();
        if (!token) {
          throw new Error('No push token');
        }
        
        // Register token with server
        await apiClient.post('/api/notifications/register-token', {
          token: token.data,
        });
        
        return 'Notifications enabled';
      });

      setOverallStatus('passed');
      analytics.track('platform_verification_passed');
    } catch (error) {
      console.error('Verification failed:', error);
      setOverallStatus('failed');
      analytics.track('platform_verification_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const runCheck = async (
    checkId: string,
    checkFn: () => Promise<string>
  ): Promise<void> => {
    // Set checking status
    setChecks((prev) =>
      prev.map((check) =>
        check.id === checkId ? { ...check, status: 'checking' } : check
      )
    );

    try {
      const message = await checkFn();
      
      // Set passed status
      setChecks((prev) =>
        prev.map((check) =>
          check.id === checkId
            ? { ...check, status: 'passed', message }
            : check
        )
      );
    } catch (error) {
      // Set failed status
      const errorMessage = error instanceof Error ? error.message : 'Check failed';
      
      setChecks((prev) =>
        prev.map((check) =>
          check.id === checkId
            ? { ...check, status: 'failed', message: errorMessage }
            : check
        )
      );
      
      // Don't throw - allow other checks to continue
      if (checkId !== 'push_notifications') {
        // Push notifications are optional
        throw error;
      }
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    
    // Reset checks
    setChecks((prev) =>
      prev.map((check) => ({
        ...check,
        status: 'pending' as const,
        message: undefined,
      }))
    );
    
    await runVerificationChecks();
    setRetrying(false);
  };

  const handleContinue = () => {
    analytics.track('platform_verification_continued');
    navigation.navigate('Home' as never);
  };

  const renderCheckIcon = (status: VerificationCheck['status']) => {
    if (status === 'checking') {
      return <ActivityIndicator size="small" color="#22c55e" />;
    } else if (status === 'passed') {
      return <CheckCircle size={24} color="#22c55e" />;
    } else if (status === 'failed') {
      return <XCircle size={24} color="#ef4444" />;
    } else {
      return <AlertCircle size={24} color="#9ca3af" />;
    }
  };

  const allChecksComplete = checks.every(
    (check) => check.status === 'passed' || check.status === 'failed'
  );

  const criticalChecksPassed = checks
    .filter((check) => check.id !== 'push_notifications') // Optional check
    .every((check) => check.status === 'passed');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Platform Verification</Text>
        <Text style={styles.description}>
          Checking that everything is set up correctly...
        </Text>
      </View>

      <View style={styles.checksContainer}>
        {checks.map((check) => (
          <View key={check.id} style={styles.checkItem}>
            <View style={styles.checkIcon}>{renderCheckIcon(check.status)}</View>
            <View style={styles.checkContent}>
              <Text style={styles.checkName}>{check.name}</Text>
              {check.message && (
                <Text
                  style={[
                    styles.checkMessage,
                    check.status === 'failed' && styles.checkMessageError,
                  ]}
                >
                  {check.message}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>

      {overallStatus === 'running' && !allChecksComplete && (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.statusText}>Running checks...</Text>
        </View>
      )}

      {overallStatus === 'passed' && (
        <View style={[styles.statusContainer, styles.successContainer]}>
          <CheckCircle size={48} color="#22c55e" />
          <Text style={styles.successTitle}>All Checks Passed!</Text>
          <Text style={styles.successDescription}>
            Your mobile app is ready to use
          </Text>
          <Button title="Continue to Dashboard" onPress={handleContinue} />
        </View>
      )}

      {overallStatus === 'failed' && criticalChecksPassed && (
        <View style={[styles.statusContainer, styles.warningContainer]}>
          <AlertCircle size={48} color="#f59e0b" />
          <Text style={styles.warningTitle}>Some Checks Failed</Text>
          <Text style={styles.warningDescription}>
            Critical features are working, but some optional features may not be available
          </Text>
          <View style={styles.buttonRow}>
            <Button
              title="Retry"
              onPress={handleRetry}
              loading={retrying}
              style={styles.retryButton}
            />
            <Button
              title="Continue Anyway"
              onPress={handleContinue}
              variant="outline"
              style={styles.continueButton}
            />
          </View>
        </View>
      )}

      {overallStatus === 'failed' && !criticalChecksPassed && (
        <View style={[styles.statusContainer, styles.errorContainer]}>
          <XCircle size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Verification Failed</Text>
          <Text style={styles.errorDescription}>
            Please fix the issues above and try again
          </Text>
          <Button
            title="Retry Verification"
            onPress={handleRetry}
            loading={retrying}
            icon={<RefreshCw size={20} color="#fff" />}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
  },
  checksContainer: {
    marginBottom: 32,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 12,
  },
  checkIcon: {
    marginRight: 12,
  },
  checkContent: {
    flex: 1,
  },
  checkName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  checkMessage: {
    fontSize: 14,
    color: '#6b7280',
  },
  checkMessageError: {
    color: '#ef4444',
  },
  statusContainer: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
  },
  statusText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  successContainer: {
    backgroundColor: '#f0fdf4',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#166534',
    marginTop: 16,
    marginBottom: 8,
  },
  successDescription: {
    fontSize: 16,
    color: '#15803d',
    textAlign: 'center',
    marginBottom: 24,
  },
  warningContainer: {
    backgroundColor: '#fffbeb',
  },
  warningTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#92400e',
    marginTop: 16,
    marginBottom: 8,
  },
  warningDescription: {
    fontSize: 16,
    color: '#b45309',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#991b1b',
    marginTop: 16,
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    flex: 1,
  },
  continueButton: {
    flex: 1,
  },
});
