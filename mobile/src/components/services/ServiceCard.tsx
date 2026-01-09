import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Service } from '../../services/api/services';

interface ServiceCardProps {
  service: Service;
  onPress: () => void;
}

export function ServiceCard({ service, onPress }: ServiceCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.name}>{service.name}</Text>
        {service.isInstant && (
          <View style={styles.instantBadge}>
            <Text style={styles.badgeText}>⚡ Instant</Text>
          </View>
        )}
        {service.requiresApproval && (
          <View style={styles.approvalBadge}>
            <Text style={styles.badgeText}>✓ Approval</Text>
          </View>
        )}
      </View>
      <Text style={styles.description}>{service.description}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  instantBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  approvalBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
  },
  description: {
    fontSize: 14,
    color: '#666',
  },
});
