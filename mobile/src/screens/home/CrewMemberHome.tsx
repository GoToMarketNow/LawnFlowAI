import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Text, TouchableOpacity } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { getDashboardToday, updateCrewStatus } from '../../services/api/queries';
import { CrewStatusSelector } from '../../components/crew/CrewStatusSelector';
import { AddressLink } from '../../components/common/AddressLink';
import { StatusPill } from '../../components/common/StatusPill';
import { CrewStatus, CrewStatusType, JobStatusType } from '../../types/enums';
import { trackEvent } from '../../services/analytics';
import { secureStorage } from '../../services/storage/secureStorage';

// ============================================
// Crew Member Home Screen (Ultra-Slim)
// ============================================

export function CrewMemberHome() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [currentCrewStatus, setCurrentCrewStatus] = useState<CrewStatusType>(CrewStatus.ON_SITE);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    const userJson = await secureStorage.getItem('user');
    if (userJson) {
      const user = JSON.parse(userJson);
      setUserRole(user.role);
    }
  };

  const {
    data: dashboardData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['dashboard-today'],
    queryFn: async () => {
      const result = await getDashboardToday();
      return result.data;
    },
  });

  const crewStatusMutation = useMutation({
    mutationFn: async (status: CrewStatusType) => {
      return await updateCrewStatus(status);
    },
    onSuccess: (_, status) => {
      setCurrentCrewStatus(status);
      trackEvent('crew_status_changed', { newStatus: status, role: userRole });
      queryClient.invalidateQueries({ queryKey: ['dashboard-today'] });
    },
  });

  const handleCrewStatusChange = (status: CrewStatusType) => {
    crewStatusMutation.mutate(status);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const jobsToday = dashboardData?.jobsToday || [];
  const notifications = dashboardData?.notifications || [];
  const acceptanceState = dashboardData?.acceptanceState;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Today's Jobs</Text>
        <Text style={styles.subtitle}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
      </View>

      {/* Crew Status Selector */}
      <View style={styles.section}>
        <CrewStatusSelector
          currentStatus={currentCrewStatus}
          onStatusChange={handleCrewStatusChange}
          disabled={crewStatusMutation.isPending}
        />
      </View>

      {/* Daily Acceptance CTA */}
      {acceptanceState && !acceptanceState.accepted && (
        <TouchableOpacity
          style={styles.acceptanceBanner}
          onPress={() => navigation.navigate('Acceptance' as never)}
          activeOpacity={0.8}
        >
          <View style={styles.acceptanceContent}>
            <Text style={styles.acceptanceIcon}>✓</Text>
            <View style={styles.acceptanceTextContainer}>
              <Text style={styles.acceptanceTitle}>Accept Today's Jobs</Text>
              <Text style={styles.acceptanceSubtitle}>Tap to review</Text>
            </View>
          </View>
          <Text style={styles.acceptanceArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* Jobs List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Schedule</Text>
          <View style={styles.jobCountBadge}>
            <Text style={styles.jobCountText}>{jobsToday.length}</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading jobs...</Text>
          </View>
        ) : jobsToday.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No jobs assigned for today</Text>
            <TouchableOpacity
              style={styles.requestWorkButton}
              onPress={() => navigation.navigate('RequestWork' as never)}
            >
              <Text style={styles.requestWorkText}>Request More Work</Text>
            </TouchableOpacity>
          </View>
        ) : (
          jobsToday.map((job, index) => (
            <TouchableOpacity
              key={job.id}
              style={styles.jobCard}
              onPress={() => navigation.navigate('Jobs' as never, { screen: 'JobDetail', params: { jobId: job.id } } as never)}
              activeOpacity={0.7}
            >
              <View style={styles.jobNumber}>
                <Text style={styles.jobNumberText}>#{index + 1}</Text>
              </View>

              <View style={styles.jobContent}>
                <View style={styles.jobHeader}>
                  <Text style={styles.jobCustomer}>{job.customerName || 'Customer'}</Text>
                  <StatusPill status={job.status as JobStatusType} size="small" />
                </View>

                <AddressLink
                  address={job.address || job.propertyAddress || ''}
                  coords={job.coords}
                  jobId={job.id}
                  role={userRole || undefined}
                  style={styles.jobAddress}
                />

                <View style={styles.jobMeta}>
                  <Text style={styles.jobService}>🔧 {job.serviceType}</Text>
                  {job.timeWindow && (
                    <Text style={styles.jobTime}>⏰ {job.timeWindow}</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Notifications */}
      {notifications.length > 0 && (
        <View style={styles.section}>
          <View style={styles.notificationHeader}>
            <Text style={styles.sectionTitle}>Updates</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Notifications' as never)}>
              <Text style={styles.viewAllLink}>View All</Text>
            </TouchableOpacity>
          </View>
          {notifications.slice(0, 2).map((notification) => (
            <View key={notification.id} style={styles.notificationCard}>
              <View style={styles.notificationRow}>
                {!notification.read && <View style={styles.unreadDot} />}
                <Text style={styles.notificationText} numberOfLines={2}>
                  {notification.body || notification.title || notification.type}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  jobCountBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 28,
    alignItems: 'center',
  },
  jobCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  acceptanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E8F5E9',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  acceptanceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  acceptanceIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  acceptanceTextContainer: {
    flex: 1,
  },
  acceptanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 2,
  },
  acceptanceSubtitle: {
    fontSize: 13,
    color: '#388E3C',
  },
  acceptanceArrow: {
    fontSize: 32,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  jobCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  jobNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  jobNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  jobContent: {
    flex: 1,
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  jobCustomer: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  jobAddress: {
    marginBottom: 12,
  },
  jobMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jobService: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  jobTime: {
    fontSize: 13,
    color: '#666',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 16,
  },
  requestWorkButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#2196F3',
    borderRadius: 8,
  },
  requestWorkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  viewAllLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
    marginRight: 8,
    marginTop: 4,
  },
  notificationText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
});
