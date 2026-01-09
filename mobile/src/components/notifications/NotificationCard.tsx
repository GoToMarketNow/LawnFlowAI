import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { markNotificationRead } from '../../services/api/notifications';
import { useNotificationStore } from '../../store/notificationStore';
import type { Notification } from '../../services/api/types';

interface NotificationCardProps {
  notification: Notification;
}

export function NotificationCard({ notification }: NotificationCardProps) {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const markAsRead = useNotificationStore((state) => state.markAsRead);

  const handlePress = async () => {
    if (!notification.read) {
      await markNotificationRead(notification.id);
      markAsRead(notification.id);
    }

    // Route based on notification type
    if (notification.type === 'service_request_update' && notification.refId) {
      navigation.navigate('Services', {
        screen: 'ServiceRequestDetail',
        params: { requestId: notification.refId },
      });
    } else if (notification.type === 'JOB_ADDED' && notification.refId) {
      navigation.navigate('Jobs', {
        screen: 'JobDetail',
        params: { jobId: notification.refId },
      });
    }
  };

  const urgencyConfig = {
    urgent: { color: '#EF4444', label: 'URGENT' },
    high: { color: '#F59E0B', label: 'HIGH' },
    normal: { color: '#3B82F6', label: null },
    low: { color: '#9CA3AF', label: null },
  };

  const priority = notification.priority || 'normal';
  const urgency = urgencyConfig[priority];

  return (
    <TouchableOpacity
      style={[styles.card, !notification.read && styles.unread]}
      onPress={handlePress}
    >
      <View style={styles.header}>
        <View style={styles.typeContainer}>
          <Text style={styles.type}>{notification.type}</Text>
          {urgency.label && (
            <View style={[styles.urgencyBadge, { backgroundColor: urgency.color }]}>
              <Text style={styles.urgencyText}>{urgency.label}</Text>
            </View>
          )}
        </View>
        {!notification.read && <View style={styles.badge} />}
      </View>
      {notification.title && <Text style={styles.title}>{notification.title}</Text>}
      {notification.body && <Text style={styles.body}>{notification.body}</Text>}
      <Text style={styles.date}>
        {new Date(notification.createdAt).toLocaleDateString()}
      </Text>
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
  unread: {
    backgroundColor: '#F9FAFB',
    borderColor: '#22C55E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  type: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  urgencyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgencyText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  badge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
});
