import { Linking, Platform, Alert } from 'react-native';
import { trackEvent } from '../services/analytics';

// ============================================
// Native Directions Helper
// ============================================

export interface DirectionsOptions {
  address: string;
  coords?: {
    lat: number;
    lng: number;
  };
  jobId?: number;
  role?: string;
}

/**
 * Opens native maps app with directions to the specified address
 * iOS: Apple Maps
 * Android: Google Maps
 */
export async function openDirections(options: DirectionsOptions): Promise<void> {
  const { address, coords, jobId, role } = options;

  try {
    let url: string;

    if (Platform.OS === 'ios') {
      // iOS: Use Apple Maps
      if (coords) {
        url = `http://maps.apple.com/?daddr=${coords.lat},${coords.lng}`;
      } else {
        const encodedAddress = encodeURIComponent(address);
        url = `http://maps.apple.com/?daddr=${encodedAddress}`;
      }
    } else {
      // Android: Use Google Maps
      if (coords) {
        url = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
      } else {
        const encodedAddress = encodeURIComponent(address);
        url = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
      }
    }

    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);

      // Track analytics
      trackEvent('directions_opened', {
        role: role || 'unknown',
        jobId: jobId || null,
        platform: Platform.OS,
        hasCoords: !!coords,
      });
    } else {
      Alert.alert(
        'Cannot Open Maps',
        'Unable to open maps application. Please check your device settings.',
        [{ text: 'OK' }]
      );
    }
  } catch (error) {
    console.error('[Directions] Error opening maps:', error);
    Alert.alert(
      'Error',
      'An error occurred while trying to open directions. Please try again.',
      [{ text: 'OK' }]
    );
  }
}

/**
 * Formats an address for display
 */
export function formatAddress(address: string): string {
  if (!address) return '';
  return address.trim();
}

/**
 * Copies address to clipboard
 */
export async function copyAddress(address: string): Promise<void> {
  try {
    // Note: Requires @react-native-clipboard/clipboard package
    // For now, we'll use a simple alert
    Alert.alert('Address', address, [
      { text: 'OK' }
    ]);
  } catch (error) {
    console.error('[Directions] Error copying address:', error);
  }
}
