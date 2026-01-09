import React, { useState } from 'react';
import { View, ScrollView, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { getCrewMe } from '../../services/api/queries';

// ============================================
// Crew Screen (Leader Only)
// ============================================

export function CrewScreen() {
  const navigation = useNavigation();
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);

  const { data: crew, isLoading } = useQuery({
    queryKey: ['crew-me'],
    queryFn: async () => {
      const result = await getCrewMe();
      return result.data;
    },
  });

  const handleCallCrew = () => {
    const activeMembers = crew?.members.filter((m) => m.isActive && m.phoneE164) || [];

    if (activeMembers.length === 0) {
      Alert.alert('No Members', 'No active crew members with phone numbers available.');
      return;
    }

    // For iOS, we can only call one at a time. Show list to select.
    if (activeMembers.length === 1) {
      Linking.openURL(`tel:${activeMembers[0].phoneE164}`);
    } else {
      Alert.alert(
        'Call Crew Member',
        'Select a member to call:',
        activeMembers.map((member) => ({
          text: member.name,
          onPress: () => Linking.openURL(`tel:${member.phoneE164}`),
        })).concat([{ text: 'Cancel', style: 'cancel' }])
      );
    }
  };

  const handleMessageCrew = () => {
    navigation.navigate('Messages' as never, {
      screen: 'Thread',
      params: { threadType: 'crew' },
    } as never);
  };

  const handleToggleMember = (memberId: number) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleCallSelected = () => {
    const selected = crew?.members.filter(
      (m) => selectedMembers.includes(m.id) && m.phoneE164
    ) || [];

    if (selected.length === 0) {
      Alert.alert('No Selection', 'Please select crew members with phone numbers.');
      return;
    }

    if (selected.length === 1) {
      Linking.openURL(`tel:${selected[0].phoneE164}`);
    } else {
      Alert.alert(
        'Call Selected Member',
        'Select a member to call:',
        selected.map((member) => ({
          text: member.name,
          onPress: () => Linking.openURL(`tel:${member.phoneE164}`),
        })).concat([{ text: 'Cancel', style: 'cancel' }])
      );
    }
  };

  const handleMessageSelected = () => {
    // In a real implementation, this would open a thread with selected members
    Alert.alert('Message Selected', 'Messaging selected crew members (feature in progress)');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading crew...</Text>
      </View>
    );
  }

  if (!crew) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Crew not found</Text>
      </View>
    );
  }

  const activeMembers = crew.members.filter((m) => m.isActive);
  const hasSelection = selectedMembers.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Crew Overview */}
        <View style={styles.overviewCard}>
          <Text style={styles.overviewTitle}>{crew.name}</Text>
          <View style={styles.overviewRow}>
            <Text style={styles.overviewLabel}>Members:</Text>
            <View style={styles.memberCountBadge}>
              <Text style={styles.memberCountText}>{activeMembers.length}</Text>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={handleCallCrew}>
              <Text style={styles.actionIcon}>📞</Text>
              <Text style={styles.actionText}>Call Crew</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleMessageCrew}>
              <Text style={styles.actionIcon}>💬</Text>
              <Text style={styles.actionText}>Message Crew</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Member List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team Members</Text>

          {activeMembers.map((member) => {
            const isSelected = selectedMembers.includes(member.id);

            return (
              <TouchableOpacity
                key={member.id}
                style={[styles.memberCard, isSelected && styles.memberCardSelected]}
                onPress={() => handleToggleMember(member.id)}
                activeOpacity={0.7}
              >
                <View style={styles.memberInfo}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberInitial}>
                      {member.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.memberDetails}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberRole}>
                      {member.role === 'LEADER' ? '⭐ Leader' : 'Member'}
                    </Text>
                  </View>

                  {isSelected && (
                    <View style={styles.checkmark}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                </View>

                {member.phoneE164 && (
                  <View style={styles.memberActions}>
                    <TouchableOpacity
                      style={styles.memberActionButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        Linking.openURL(`tel:${member.phoneE164}`);
                      }}
                    >
                      <Text style={styles.memberActionText}>📞 Call</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.memberActionButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        // Open message thread with this member
                        Alert.alert('Message', `Message ${member.name} (feature in progress)`);
                      }}
                    >
                      <Text style={styles.memberActionText}>💬 Message</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Multi-Select Action Bar */}
      {hasSelection && (
        <View style={styles.selectionBar}>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSelectedMembers([])}
          >
            <Text style={styles.clearButtonText}>Clear ({selectedMembers.length})</Text>
          </TouchableOpacity>

          <View style={styles.selectionActions}>
            <TouchableOpacity style={styles.selectionButton} onPress={handleCallSelected}>
              <Text style={styles.selectionButtonText}>📞 Call Selected</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.selectionButton} onPress={handleMessageSelected}>
              <Text style={styles.selectionButtonText}>💬 Message Selected</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  errorText: {
    fontSize: 16,
    color: '#D32F2F',
  },
  overviewCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  overviewTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  overviewLabel: {
    fontSize: 16,
    color: '#666',
  },
  memberCountBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 36,
    alignItems: 'center',
  },
  memberCountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 8,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  memberCardSelected: {
    borderColor: '#2196F3',
    borderWidth: 2,
    backgroundColor: '#F0F9FF',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 13,
    color: '#666',
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  memberActionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  memberActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  clearButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  selectionActions: {
    flexDirection: 'row',
    flex: 1,
    gap: 8,
  },
  selectionButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    alignItems: 'center',
  },
  selectionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
