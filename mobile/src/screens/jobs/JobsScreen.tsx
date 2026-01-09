import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchJobs } from '../../services/api/jobs';
import { useJobStore } from '../../store/jobStore';
import { JobCard } from '../../components/jobs/JobCard';

type TabType = 'upcoming' | 'completed';

export function JobsScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const setJobs = useJobStore((state) => state.setJobs);
  const upcomingJobs = useJobStore((state) => state.upcomingJobs);
  const completedJobs = useJobStore((state) => state.completedJobs);

  const { isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => fetchJobs(),
    onSuccess: (data) => {
      setJobs(data);
    },
  });

  const displayJobs = activeTab === 'upcoming' ? upcomingJobs : completedJobs;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading jobs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
            Upcoming ({upcomingJobs.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Completed ({completedJobs.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayJobs}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <JobCard job={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No {activeTab} jobs
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
