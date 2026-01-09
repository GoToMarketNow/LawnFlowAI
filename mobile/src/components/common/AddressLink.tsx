import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { openDirections } from '../../utils/directions';

// ============================================
// AddressLink Component
// Displays an address with a tap action to open native maps
// ============================================

interface AddressLinkProps {
  address: string;
  coords?: {
    lat: number;
    lng: number;
  };
  jobId?: number;
  role?: string;
  showIcon?: boolean;
  style?: any;
  textStyle?: any;
}

export function AddressLink({
  address,
  coords,
  jobId,
  role,
  showIcon = true,
  style,
  textStyle,
}: AddressLinkProps) {
  if (!address) {
    return null;
  }

  const handlePress = () => {
    openDirections({ address, coords, jobId, role });
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {showIcon && (
          <Text style={styles.icon}>📍</Text>
        )}
        <Text style={[styles.address, textStyle]} numberOfLines={2}>
          {address}
        </Text>
      </View>
      <View style={styles.directionsCTA}>
        <Text style={styles.directionsText}>Directions</Text>
        <Text style={styles.arrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ============================================
// Compact Address Link (just text, no directions button)
// ============================================

interface CompactAddressLinkProps {
  address: string;
  coords?: {
    lat: number;
    lng: number;
  };
  jobId?: number;
  role?: string;
  style?: any;
}

export function CompactAddressLink({
  address,
  coords,
  jobId,
  role,
  style,
}: CompactAddressLinkProps) {
  if (!address) {
    return null;
  }

  const handlePress = () => {
    openDirections({ address, coords, jobId, role });
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
      <Text style={[styles.compactAddress, style]} numberOfLines={1}>
        📍 {address}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  icon: {
    fontSize: 18,
    marginRight: 8,
  },
  address: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  directionsCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2196F3',
    borderRadius: 6,
  },
  directionsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 4,
  },
  arrow: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  compactAddress: {
    fontSize: 14,
    color: '#2196F3',
    textDecorationLine: 'underline',
  },
});
