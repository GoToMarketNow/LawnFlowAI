import React from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Text, Card, Button, ActivityIndicator } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { getTodayJobs, getDashboardStats, type Job } from '../../services/api/queries';
import { useNavigation } from '@react-navigation/native';
import { secureStorage } from '../../services/storage/secureStorage';
import { commandQueue } from '../../services/offline/commandQueue';

// ============================================
// Role-Adaptive Dashboard Screen
// ============================================

export function DashboardScreen() {
  const navigation = useNavigation();
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [crewId, setCrewId] = React.useState<number | null>(null);
  const [pendingCommands, setPendingCommands] = React.useState(0);

  React.useEffect(() => {
    loadUserInfo();
    loadPendingCount();

    const interval = setInterval(loadPendingCount, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadUserInfo = async () => {
    const userJson = await secureStorage.getItem('user');
    if (userJson) {
      const user = JSON.parse(userJson);
      setUserRole(user.role);
      setCrewId(user.crewId);
    }
  };

  const loadPendingCount = async () => {
    const count = await commandQueue.getPendingCount();
    setPendingCommands(count);
  };

  const {
    data: jobs,
    isLoading: jobsLoading,
    refetch: refetchJobs,
  } = useQuery({
    queryKey: ['today-jobs', crewId],
    queryFn: async () => {
      const result = await getTodayJobs({ crewId: crewId || undefined });
      return result.data || [];
    },
  });

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const result = await getDashboardStats();
      return result.data;
    },
    enabled: userRole === 'operator' || userRole === 'ops',
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchJobs(), refetchStats()]);
    await loadPendingCount();
    setRefreshing(false);
  };

  // ============================================
  // Render by Role
  // ============================================

  if (userRole === 'operator' || userRole === 'ops') {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Today's Overview</Text>
          <Text style={styles.subtitle}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        </View>

        {pendingCommands > 0 && (
          <Card style={styles.offlineCard}>
            <Card.Content>
              <Text style={styles.offlineText}>
                ⚠ {pendingCommands} action{pendingCommands > 1 ? 's' : ''} pending sync
              </Text>
            </Card.Content>
          </Card>
        )}

        {statsLoading ? (
          <ActivityIndicator size="large" style={styles.loader} />
        ) : (
          <>
            <View style={styles.statsGrid}>
              <StatCard
                label="Jobs Today"
                value={stats?.jobsScheduled || 0}
                color="#2196F3"
                icon="calendar"
              />
              <StatCard
                label="In Progress"
                value={stats?.jobsInProgress || 0}
                color="#FF9800"
                icon="progress-clock"
              />
              <StatCard
                label="Completed"
                value={stats?.jobsCompleted || 0}
                color="#4CAF50"
                icon="check-circle"
              />
              <StatCard
                label="Unassigned"
                value={stats?.unassignedJobs || 0}
                color="#F44336"
                icon="alert-circle"
              />
            </View>

            <Card style={styles.card}>
              <Card.Title title="Crew Status" />
              <Card.Content>
                <View style={styles.crewStatusRow}>
                  <Text style={styles.crewStatusLabel}>Available:</Text>
                  <Text style={styles.crewStatusValue}>{stats?.crewsAvailable || 0}</Text>
                </View>
                <View style={styles.crewStatusRow}>
                  <Text style={styles.crewStatusLabel}>On Job:</Text>
                  <Text style={styles.crewStatusValue}>{stats?.crewsOnJob || 0}</Text>
                </View>
              </Card.Content>
              <Card.Actions>
                <Button onPress={() => navigation.navigate('Crews' as never)}>View Crews</Button>
              </Card.Actions>
            </Card>

            {stats?.escalations > 0 && (
              <Card style={[styles.card, styles.alertCard]}>
                <Card.Title title="⚠ Attention Required" />
                <Card.Content>
                  <Text>{stats.escalations} escalation{stats.escalations > 1 ? 's' : ''} need review</Text>
                </Card.Content>
                <Card.Actions>
                  <Button onPress={() => navigation.navigate('Notifications' as never)}>View</Button>
                </Card.Actions>
              </Card>
            )}
          </>
        )}

        <JobsList jobs={jobs || []} loading={jobsLoading} navigation={navigation} />
      </ScrollView>
    );
  }

  // Crew Leader / Crew Member View
  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Today's Route</Text>
        <Text style={styles.subtitle}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
      </View>

      {pendingCommands > 0 && (
        <Card style={styles.offlineCard}>
          <Card.Content>
            <Text style={styles.offlineText}>
              ⚠ {pendingCommands} action{pendingCommands > 1 ? 's' : ''} pending sync
            </Text>
          </Card.Content>
        </Card>
      )}

      {jobsLoading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : jobs && jobs.length > 0 ? (
        <View style={styles.routeContainer}>
          <Card style={styles.summaryCard}>
            <Card.Content>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Jobs:</Text>
                <Text style={styles.summaryValue}>{jobs.length}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Completed:</Text>
                <Text style={styles.summaryValue}>
                  {jobs.filter((j) => j.status === 'completed').length}
                </Text>
              </View>
            </Card.Content>
          </Card>

          <JobsList jobs={jobs} loading={false} navigation={navigation} />
        </View>
      ) : (
        <Card style={styles.emptyCard}>
          <Card.Content>
            <Text style={styles.emptyText}>No jobs assigned for today</Text>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

// ============================================
// Stat Card Component
// ============================================

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <Card style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <Card.Content>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </Card.Content>
    </Card>
  );
}

// ============================================
// Jobs List Component
// ============================================

function JobsList({ jobs, loading, navigation }: { jobs: Job[]; loading: boolean; navigation: any }) {
  if (loading) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  if (!jobs || jobs.length === 0) {
    return null;
  }

  return (
    <View style={styles.jobsSection}>
      <Text style={styles.sectionTitle}>Today's Jobs</Text>
      {jobs.map((job) => (
        <Card
          key={job.id}
          style={styles.jobCard}
          onPress={() => navigation.navigate('Jobs', { screen: 'JobDetail', params: { jobId: job.id } })}
        >
          <Card.Content>
            <View style={styles.jobHeader}>
              <Text style={styles.jobTitle}>{job.customerName}</Text>
              <View style={[styles.statusBadge, getStatusStyle(job.status)]}>
                <Text style={styles.statusText}>{job.status.replace('_', ' ').toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.jobAddress}>{job.address}</Text>
            <Text style={styles.jobService}>{job.serviceType}</Text>
            <Text style={styles.jobTime}>
              {job.scheduledStartISO
                ? new Date(job.scheduledStartISO).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Time TBD'}
            </Text>
          </Card.Content>
        </Card>
      ))}
    </View>
  );
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'scheduled':
      return { backgroundColor: '#E3F2FD' };
    case 'in_progress':
      return { backgroundColor: '#FFF3E0' };
    case 'paused':
      return { backgroundColor: '#FFEBEE' };
    case 'completed':
      return { backgroundColor: '#E8F5E9' };
    default:
      return { backgroundColor: '#F5F5F5' };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
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
  offlineCard: {
    margin: 16,
    backgroundColor: '#FFF3E0',
  },
  offlineText: {
    color: '#E65100',
    fontWeight: '600',
  },
  loader: {
    marginTop: 32,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 8,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    margin: 8,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  card: {
    margin: 16,
  },
  alertCard: {
    backgroundColor: '#FFEBEE',
  },
  crewStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  crewStatusLabel: {
    fontSize: 14,
    color: '#666',
  },
  crewStatusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  routeContainer: {
    padding: 16,
  },
  summaryCard: {
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  emptyCard: {
    margin: 16,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#999',
  },
  jobsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  jobCard: {
    marginBottom: 12,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
  },
  jobAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  jobService: {
    fontSize: 14,
    color: '#2196F3',
    marginBottom: 4,
  },
  jobTime: {
    fontSize: 12,
    color: '#999',
  },
});
