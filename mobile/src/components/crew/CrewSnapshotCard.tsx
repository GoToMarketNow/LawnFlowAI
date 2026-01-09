import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// ============================================
// Crew Snapshot Card Component
// Shows crew overview with member count and quick action
// ============================================

interface CrewSnapshotCardProps {
  crewName: string;
  memberCount: number;
  onViewCrew: () => void;
}

export function CrewSnapshotCard({ crewName, memberCount, onViewCrew }: CrewSnapshotCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Crew</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Crew:</Text>
          <Text style={styles.value}>{crewName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Members:</Text>
          <View style={styles.memberBadge}>
            <Text style={styles.memberCount}>{memberCount}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.button} onPress={onViewCrew} activeOpacity={0.7}>
        <Text style={styles.buttonText}>View Crew</Text>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    gap: 8,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  memberBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
    alignItems: 'center',
  },
  memberCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  arrow: {
    fontSize: 20,
    color: '#2196F3',
    fontWeight: 'bold',
  },
});
