import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../../services/api/client';
import { useAuthStore } from '../../store/authStore';
import { analytics } from '../../services/analytics';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { CheckCircle, Shield, Smartphone } from 'lucide-react-native';

interface MobileOnboardingScreenProps {
  route: {
    params: {
      bindingId: number;
      userId: number;
      sessionId?: number;
    };
  };
}

type TwoFAMethod = 'sms' | 'authenticator';
type OnboardingStep = 'welcome' | 'choose_2fa' | 'setup_2fa' | 'verify_2fa' | 'complete';

export default function MobileOnboardingScreen({ route }: MobileOnboardingScreenProps) {
  const navigation = useNavigation();
  const { bindingId, userId, sessionId } = route.params;
  const setAuth = useAuthStore((state) => state.setAuth);

  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [twoFAMethod, setTwoFAMethod] = useState<TwoFAMethod>('sms');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const handleContinue = () => {
    if (currentStep === 'welcome') {
      setCurrentStep('choose_2fa');
    } else if (currentStep === 'choose_2fa') {
      setCurrentStep('setup_2fa');
    }
  };

  const handleSendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      analytics.track('2fa_otp_send_request', { method: twoFAMethod });

      await apiClient.post('/api/auth/send-otp', {
        userId,
        phoneNumber,
      });

      setOtpSent(true);
      analytics.track('2fa_otp_sent', { method: twoFAMethod });

      Alert.alert(
        'Code Sent',
        'A verification code has been sent to your phone.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      analytics.track('2fa_otp_send_failed', { error: error.message });
      Alert.alert(
        'Failed to Send Code',
        error.response?.data?.error || 'Please try again',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      analytics.track('2fa_verify_request', { method: twoFAMethod });

      // Verify OTP
      const verifyResponse = await apiClient.post('/api/auth/verify-otp', {
        userId,
        code: otpCode,
      });

      analytics.track('2fa_verified', { method: twoFAMethod });

      // Mark device binding as verified
      await apiClient.post('/api/mobile-binding/verify', {
        bindingId,
      });

      analytics.track('device_binding_verified', { binding_id: bindingId });

      // Update onboarding session if provided
      if (sessionId) {
        await apiClient.post('/api/onboarding/verify-mobile', {
          sessionId,
        });
        analytics.track('onboarding_mobile_verified', { session_id: sessionId });
      }

      // Set auth token
      if (verifyResponse.data.token && verifyResponse.data.user) {
        setAuth(verifyResponse.data.token, verifyResponse.data.user);
      }

      setCurrentStep('complete');
    } catch (error: any) {
      analytics.track('2fa_verify_failed', { error: error.message });
      Alert.alert(
        'Verification Failed',
        error.response?.data?.error || 'Invalid code. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      // Run platform verification
      await apiClient.post('/api/mobile-binding/verify-platform', {
        bindingId,
        userId,
      });

      analytics.track('mobile_onboarding_complete', {
        binding_id: bindingId,
        user_id: userId,
      });

      // Navigate to main app
      navigation.navigate('Home' as never);
    } catch (error) {
      console.error('Platform verification failed:', error);
      // Still navigate to app - non-blocking
      navigation.navigate('Home' as never);
    } finally {
      setLoading(false);
    }
  };

  const renderWelcome = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Smartphone size={64} color="#22c55e" />
      </View>
      <Text style={styles.stepTitle}>Welcome to LawnFlow Mobile!</Text>
      <Text style={styles.stepDescription}>
        Your device has been successfully connected. Now let's secure your account with two-factor
        authentication (2FA).
      </Text>
      <View style={styles.featureList}>
        <FeatureItem
          icon={<Shield size={24} color="#22c55e" />}
          text="Enhanced security for your account"
        />
        <FeatureItem
          icon={<CheckCircle size={24} color="#22c55e" />}
          text="Verify it's really you accessing the app"
        />
        <FeatureItem
          icon={<Smartphone size={24} color="#22c55e" />}
          text="Protect your business data"
        />
      </View>
      <Button title="Continue" onPress={handleContinue} loading={loading} />
    </View>
  );

  const renderChoose2FA = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Choose 2FA Method</Text>
      <Text style={styles.stepDescription}>
        Select how you'd like to receive verification codes
      </Text>

      <TouchableOpacity
        style={[
          styles.methodCard,
          twoFAMethod === 'sms' && styles.methodCardSelected,
        ]}
        onPress={() => setTwoFAMethod('sms')}
      >
        <View style={styles.methodContent}>
          <Text style={styles.methodTitle}>SMS Text Message</Text>
          <Text style={styles.methodDescription}>
            Receive codes via text message (Recommended)
          </Text>
        </View>
        {twoFAMethod === 'sms' && <CheckCircle size={24} color="#22c55e" />}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.methodCard,
          twoFAMethod === 'authenticator' && styles.methodCardSelected,
        ]}
        onPress={() => setTwoFAMethod('authenticator')}
        disabled
      >
        <View style={styles.methodContent}>
          <Text style={[styles.methodTitle, styles.disabledText]}>
            Authenticator App
          </Text>
          <Text style={[styles.methodDescription, styles.disabledText]}>
            Coming soon
          </Text>
        </View>
      </TouchableOpacity>

      <Button title="Continue" onPress={handleContinue} loading={loading} />
    </View>
  );

  const renderSetup2FA = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Set Up 2FA</Text>
      <Text style={styles.stepDescription}>
        Enter your phone number to receive verification codes
      </Text>

      <Input
        label="Phone Number"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        placeholder="+1 (555) 123-4567"
        keyboardType="phone-pad"
        autoFocus
      />

      {!otpSent ? (
        <Button title="Send Verification Code" onPress={handleSendOTP} loading={loading} />
      ) : (
        <>
          <Input
            label="Verification Code"
            value={otpCode}
            onChangeText={setOtpCode}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
          <Button title="Verify Code" onPress={handleVerifyOTP} loading={loading} />
          <TouchableOpacity onPress={handleSendOTP} disabled={loading} style={styles.resendButton}>
            <Text style={styles.resendText}>Resend Code</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  const renderComplete = () => (
    <View style={styles.stepContainer}>
      <View style={styles.successContainer}>
        <CheckCircle size={80} color="#22c55e" />
        <Text style={styles.successTitle}>All Set!</Text>
        <Text style={styles.successDescription}>
          Your mobile device is now connected and secured with 2FA.
        </Text>
      </View>

      <View style={styles.completionChecklist}>
        <ChecklistItem text="Device bound to your account" />
        <ChecklistItem text="Two-factor authentication enabled" />
        <ChecklistItem text="Ready to access your dashboard" />
      </View>

      <Button title="Go to Dashboard" onPress={handleComplete} loading={loading} />
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            {
              width:
                currentStep === 'welcome'
                  ? '25%'
                  : currentStep === 'choose_2fa'
                  ? '50%'
                  : currentStep === 'setup_2fa'
                  ? '75%'
                  : '100%',
            },
          ]}
        />
      </View>

      {currentStep === 'welcome' && renderWelcome()}
      {currentStep === 'choose_2fa' && renderChoose2FA()}
      {currentStep === 'setup_2fa' && renderSetup2FA()}
      {currentStep === 'complete' && renderComplete()}
    </ScrollView>
  );
}

const FeatureItem = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <View style={styles.featureItem}>
    {icon}
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const ChecklistItem = ({ text }: { text: string }) => (
  <View style={styles.checklistItem}>
    <CheckCircle size={20} color="#22c55e" />
    <Text style={styles.checklistText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginBottom: 32,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 2,
  },
  stepContainer: {
    flex: 1,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  stepDescription: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
    lineHeight: 24,
  },
  featureList: {
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    marginBottom: 12,
  },
  methodCardSelected: {
    borderColor: '#22c55e',
    backgroundColor: '#f0fdf4',
  },
  methodContent: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  methodDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  disabledText: {
    opacity: 0.5,
  },
  resendButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 16,
    color: '#22c55e',
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  successDescription: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  completionChecklist: {
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checklistText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
});
