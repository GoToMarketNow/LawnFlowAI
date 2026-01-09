import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { getServiceRequest } from '../../services/api/serviceRequests';
import { analytics } from '../../services/analytics';

type ServiceRequestDetailRouteProp = RouteProp<
  { ServiceRequestDetail: { requestId: number } },
  'ServiceRequestDetail'
>;

const statusMessages = {
  pending: {
    title: '⏳ Request Pending',
    message: 'Your request is being reviewed. We\'ll notify you once it\'s processed.',
  },
  approved: {
    title: '✅ Request Approved',
    message: 'Your request has been approved and will be scheduled soon.',
  },
  scheduled: {
    title: '📅 Scheduled',
    message: 'Your service has been scheduled. You\'ll receive a reminder before the appointment.',
  },
  completed: {
    title: '✨ Completed',
    message: 'This service has been completed. Thank you!',
  },
  rejected: {
    title: '❌ Request Declined',
    message: 'Unfortunately, this request could not be fulfilled. Please contact support for details.',
  },
};

export function ServiceRequestDetailScreen() {
  const route = useRoute<ServiceRequestDetailRouteProp>();
  const { requestId } = route.params;

  const { data: request, isLoading } = useQuery({
    queryKey: ['service-request', requestId],
    queryFn: () => getServiceRequest(requestId),
  });

  useEffect(() => {
    if (request) {
      analytics.track('service_request_status_viewed', {
        requestId,
        status: request.status,
      });
    }
  }, [request]);

  if (isLoading || !request) {
    return (
      <View style={styles.center}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const statusConfig = statusMessages[request.status];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>{statusConfig.title}</Text>
        <Text style={styles.statusMessage}>{statusConfig.message}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Service Details</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Service:</Text>
          <Text style={styles.value}>{request.serviceName}</Text>
        </View>
        {request.preferredDate && (
          <View style={styles.row}>
            <Text style={styles.label}>Preferred Date:</Text>
            <Text style={styles.value}>{new Date(request.preferredDate).toLocaleDateString()}</Text>
          </View>
        )}
        {request.notes && (
          <View style={styles.row}>
            <Text style={styles.label}>Notes:</Text>
            <Text style={styles.value}>{request.notes}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Submitted:</Text>
          <Text style={styles.value}>{new Date(request.createdAt).toLocaleString()}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusCard: {
    backgroundColor: '#DBEAFE',
    padding: 20,
    margin: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  statusTitle: { fontSize: 18, fontWeight: '600', color: '#1E3A8A', marginBottom: 8 },
  statusMessage: { fontSize: 14, color: '#1E40AF' },
  section: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#000', marginBottom: 16 },
  row: { marginBottom: 12 },
  label: { fontSize: 14, color: '#666', marginBottom: 4 },
  value: { fontSize: 16, color: '#000' },
});
