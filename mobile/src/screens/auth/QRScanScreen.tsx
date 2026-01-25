import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../../services/api/client';
import { useAuthStore } from '../../store/authStore';
import { analytics } from '../../services/analytics';

interface QRScanScreenProps {
  route: {
    params?: {
      sessionId?: number;
    };
  };
}

export default function QRScanScreen({ route }: QRScanScreenProps) {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (processing || !scanning) return;

    setScanning(false);
    setProcessing(true);

    try {
      analytics.track('qr_code_scanned', { data_length: data.length });

      // Parse QR code data
      let qrData: any;
      try {
        qrData = JSON.parse(data);
      } catch (e) {
        // If not JSON, treat as token string
        qrData = { token: data };
      }

      // Validate QR code type
      if (qrData.type !== 'lawnflow_onboarding') {
        Alert.alert(
          'Invalid QR Code',
          'This QR code is not from LawnFlow onboarding. Please scan the QR code from your web browser.',
          [{ text: 'Try Again', onPress: () => resetScanning() }]
        );
        return;
      }

      // Get device info
      const deviceInfo = await getDeviceInfo();

      // Bind device
      const response = await apiClient.post('/api/mobile-binding/bind', {
        qrCodeToken: qrData.token,
        deviceId: deviceInfo.deviceId,
        deviceType: deviceInfo.deviceType,
        deviceName: deviceInfo.deviceName,
      });

      analytics.track('device_binding_success', {
        device_type: deviceInfo.deviceType,
      });

      // Navigate to 2FA setup
      navigation.navigate('MobileOnboarding', {
        bindingId: response.data.binding.id,
        userId: response.data.binding.userId,
        sessionId: qrData.session_id || route.params?.sessionId,
      });
    } catch (error: any) {
      analytics.track('device_binding_failed', {
        error: error.message,
      });

      let errorMessage = 'Failed to bind device. Please try again.';
      
      if (error.response?.status === 401) {
        errorMessage = 'QR code expired. Please generate a new one.';
      } else if (error.response?.status === 409) {
        errorMessage = 'This device is already bound to an account.';
      }

      Alert.alert('Binding Failed', errorMessage, [
        { text: 'Try Again', onPress: () => resetScanning() },
        { text: 'Cancel', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  const resetScanning = () => {
    setScanning(true);
    setProcessing(false);
  };

  const getDeviceInfo = async () => {
    // Get device information
    const { Platform, Device } = require('expo-device');
    const { getUniqueId } = require('react-native-device-info');

    const deviceId = await getUniqueId();
    const deviceType = Platform.OS === 'ios' ? 'ios' : 'android';
    const deviceName = Device.modelName || `${deviceType} Device`;

    return { deviceId, deviceType, deviceName };
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Camera Permission Required</Text>
        <Text style={styles.description}>
          LawnFlow needs camera access to scan the QR code from your computer.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan QR Code</Text>
        <Text style={styles.description}>
          Point your camera at the QR code displayed on your computer
        </Text>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.scanArea}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          </View>
        </CameraView>
      </View>

      {processing && (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.processingText}>Binding device...</Text>
        </View>
      )}

      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          1. Open LawnFlow onboarding on your computer
        </Text>
        <Text style={styles.instructionText}>
          2. Click "Generate QR Code" or "Connect Mobile App"
        </Text>
        <Text style={styles.instructionText}>
          3. Scan the displayed QR code
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#22c55e',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#22c55e',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  processingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  instructions: {
    padding: 20,
    backgroundColor: '#f9fafb',
  },
  instructionText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
});
