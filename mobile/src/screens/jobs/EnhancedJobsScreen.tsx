import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { getTodayJobs } from '../../services/api/queries';
import { AddressLink, CompactAddressLink } from '../../components/common/AddressLink';
import { StatusPill } from '../../components/common/StatusPill';
import { JobStatusType } from '../../types/enums';
import { secureStorage } from '../../services/storage/secureStorage';

// ============================================
// Enhanced Jobs Screen with Filters
// ============================================

type FilterType = 'today' | 'upcoming' | 'completed';

export function EnhancedJobsScreen() {
  const navigation = useNavigation();
  const [activeFilter, setActiveFilter] = useState<FilterType>('today');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  React.useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    const userJson = await secureStorage.getItem('user');
    if (userJson) {
      const user = JSON.parse(userJson);
      setUserRole(user.role);
    }
  };

  const { data: todayJobs, isLoading: todayLoading, refetch: refetchToday } = useQuery({
    queryKey: ['jobs-today'],
    queryFn: async () => {
      const result = await getTodayJobs();
      return result.data || [];
    },
    enabled: activeFilter === 'today',
  });

  const { data: upcomingJobs, isLoading: upcomingLoading, refetch: refetchUpcoming } = useQuery({
    queryKey: ['jobs-upcoming'],
    queryFn: async () => {
      // Fetch jobs with status filter
      const result = await getTodayJobs({ status: 'upcoming' });
      return result.data || [];
    },
    enabled: activeFilter === 'upcoming',
  });

  const { data: completedJobs, isLoading: completedLoading, refetch: refetchCompleted } = useQuery({
    queryKey: ['jobs-completed'],
    queryFn: async () => {
      const result = await getTodayJobs({ status: 'completed' });
      return result.data || [];
    },
    enabled: activeFilter === 'completed',
  });

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeFilter === 'today') await refetchToday();
    else if (activeFilter === 'upcoming') await refetchUpcoming();
    else await refetchCompleted();
    setRefreshing(false);
  };

  const getDisplayJobs = () => {
    if (activeFilter === 'today') return todayJobs || [];
    if (activeFilter === 'upcoming') return upcomingJobs || [];
    return completedJobs || [];
  };

  const isLoading = todayLoading || upcomingLoading || completedLoading;
  const displayJobs = getDisplayJobs();

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeFilter === 'today' && styles.activeTab]}
          onPress={() => setActiveFilter('today')}
        >
          <Text style={[styles.tabText, activeFilter === 'today' && styles.activeTabText]}>
            Today
          </Text>
          {activeFilter === 'today' && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{todayJobs?.length || 0}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeFilter === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveFilter('upcoming')}
        >
          <Text style={[styles.tabText, activeFilter === 'upcoming' && styles.activeTabText]}>
            Upcoming
          </Text>
          {activeFilter === 'upcoming' && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{upcomingJobs?.length || 0}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeFilter === 'completed' && styles.activeTab]}
          onPress={() => setActiveFilter('completed')}
        >
          <Text style={[styles.tabText, activeFilter === 'completed' && styles.activeTabText]}>
            Completed
          </Text>
          {activeFilter === 'completed' && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{completedJobs?.length || 0}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Jobs List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading jobs...</Text>
        </View>
      ) : (
        <FlatList
          data={displayJobs}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.jobCard}
              onPress={() =>
                navigation.navigate('JobDetail' as never, { jobId: item.id } as never)
              }
              activeOpacity={0.7}
            >
              <View style={styles.jobHeader}>
                <Text style={styles.jobCustomer}>{item.customerName || 'Customer'}</Text>
                <StatusPill status={item.status as JobStatusType} size="small" />
              </View>

              <CompactAddressLink
                address={item.address || item.propertyAddress || ''}
                coords={item.coords}
                jobId={item.id}
                role={userRole || undefined}
                style={styles.jobAddress}
              />

              <View style={styles.jobMeta}>
                <Text style={styles.jobService}>🔧 {item.serviceType}</Text>
                {item.timeWindow && (
                  <Text style={styles.jobTime}>⏰ {item.timeWindow}</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No {activeFilter} jobs</Text>
              <Text style={styles.emptyText}>
                {activeFilter === 'today' && 'You have no jobs scheduled for today'}
                {activeFilter === 'upcoming' && 'No upcoming jobs found'}
                {activeFilter === 'completed' && 'No completed jobs to show'}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  activeTab: {
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    padding: 16,
  },
  jobCard: {
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
    marginBottom: 8,
  },
  jobMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jobService: {
    fontSize: 14,
    color: '#666',
  },
  jobTime: {
    fontSize: 13,
    color: '#666',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
