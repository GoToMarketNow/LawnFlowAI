import React from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Dimensions } from 'react-native';
import { Text, Card, Button, ActivityIndicator, ProgressBar, Chip } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme/tokens';

// ============================================
// Owner Dashboard - Business Analytics
// ============================================

interface BusinessMetrics {
  revenue: {
    today: number;
    week: number;
    month: number;
    changePercent: number;
  };
  jobs: {
    completed: number;
    scheduled: number;
    inProgress: number;
    cancelled: number;
  };
  crews: {
    active: number;
    available: number;
    utilization: number;
  };
  customers: {
    total: number;
    new: number;
    retention: number;
  };
  payments: {
    collected: number;
    pending: number;
    overdue: number;
  };
  aiPerformance: {
    decisionsToday: number;
    autonomyRate: number;
    escalations: number;
    avgConfidence: number;
  };
}

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  actionLabel?: string;
  actionRoute?: string;
}

async function fetchOwnerMetrics(): Promise<BusinessMetrics> {
  // In production, this would call the API
  // For now, return mock data that matches backend structure
  return {
    revenue: {
      today: 2450.00,
      week: 12800.00,
      month: 48500.00,
      changePercent: 12.5,
    },
    jobs: {
      completed: 8,
      scheduled: 12,
      inProgress: 3,
      cancelled: 1,
    },
    crews: {
      active: 4,
      available: 2,
      utilization: 78,
    },
    customers: {
      total: 156,
      new: 8,
      retention: 94,
    },
    payments: {
      collected: 45200.00,
      pending: 3300.00,
      overdue: 850.00,
    },
    aiPerformance: {
      decisionsToday: 47,
      autonomyRate: 89,
      escalations: 3,
      avgConfidence: 0.87,
    },
  };
}

async function fetchAlerts(): Promise<Alert[]> {
  return [
    {
      id: '1',
      type: 'warning',
      title: 'Payment Overdue',
      message: '3 invoices are past due totaling $850',
      actionLabel: 'View',
      actionRoute: 'Payments',
    },
    {
      id: '2',
      type: 'info',
      title: 'AI Escalation',
      message: 'Quote #1234 needs your approval - high value job',
      actionLabel: 'Review',
      actionRoute: 'Notifications',
    },
  ];
}

export function OwnerDashboardScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['owner-metrics'],
    queryFn: fetchOwnerMetrics,
    staleTime: 60000, // 1 minute
  });

  const { data: alerts, refetch: refetchAlerts } = useQuery({
    queryKey: ['owner-alerts'],
    queryFn: fetchAlerts,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchMetrics(), refetchAlerts()]);
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (metricsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Good {getGreeting()}</Text>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      {/* Alerts Section */}
      {alerts && alerts.length > 0 && (
        <View style={styles.alertsSection}>
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              style={[styles.alertCard, getAlertStyle(alert.type)]}
            >
              <Card.Content style={styles.alertContent}>
                <View style={styles.alertTextContainer}>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                </View>
                {alert.actionLabel && (
                  <Button
                    mode="text"
                    compact
                    onPress={() => navigation.navigate(alert.actionRoute as never)}
                  >
                    {alert.actionLabel}
                  </Button>
                )}
              </Card.Content>
            </Card>
          ))}
        </View>
      )}

      {/* Revenue Overview */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Revenue Overview</Text>
          <View style={styles.revenueGrid}>
            <View style={styles.revenuePrimary}>
              <Text style={styles.revenueLabel}>This Month</Text>
              <Text style={styles.revenueValue}>{formatCurrency(metrics?.revenue.month || 0)}</Text>
              <Chip
                style={[
                  styles.changeChip,
                  { backgroundColor: (metrics?.revenue.changePercent || 0) >= 0 ? colors.success : colors.error },
                ]}
                textStyle={styles.changeChipText}
              >
                {(metrics?.revenue.changePercent || 0) >= 0 ? '↑' : '↓'} {Math.abs(metrics?.revenue.changePercent || 0)}%
              </Chip>
            </View>
            <View style={styles.revenueSecondary}>
              <View style={styles.revenueItem}>
                <Text style={styles.revenueItemLabel}>Today</Text>
                <Text style={styles.revenueItemValue}>{formatCurrency(metrics?.revenue.today || 0)}</Text>
              </View>
              <View style={styles.revenueItem}>
                <Text style={styles.revenueItemLabel}>This Week</Text>
                <Text style={styles.revenueItemValue}>{formatCurrency(metrics?.revenue.week || 0)}</Text>
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Jobs Stats */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Today's Jobs</Text>
          <View style={styles.statsGrid}>
            <StatBox
              value={metrics?.jobs.scheduled || 0}
              label="Scheduled"
              color={colors.info}
            />
            <StatBox
              value={metrics?.jobs.inProgress || 0}
              label="In Progress"
              color={colors.warning}
            />
            <StatBox
              value={metrics?.jobs.completed || 0}
              label="Completed"
              color={colors.success}
            />
            <StatBox
              value={metrics?.jobs.cancelled || 0}
              label="Cancelled"
              color={colors.error}
            />
          </View>
        </Card.Content>
        <Card.Actions>
          <Button onPress={() => navigation.navigate('Jobs' as never)}>View All Jobs</Button>
        </Card.Actions>
      </Card>

      {/* Crew Utilization */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Crew Utilization</Text>
          <View style={styles.utilizationContainer}>
            <View style={styles.utilizationHeader}>
              <Text style={styles.utilizationLabel}>
                {metrics?.crews.active || 0} Active / {metrics?.crews.available || 0} Available
              </Text>
              <Text style={styles.utilizationPercent}>{metrics?.crews.utilization || 0}%</Text>
            </View>
            <ProgressBar
              progress={(metrics?.crews.utilization || 0) / 100}
              color={getUtilizationColor(metrics?.crews.utilization || 0)}
              style={styles.progressBar}
            />
          </View>
        </Card.Content>
        <Card.Actions>
          <Button onPress={() => navigation.navigate('Crews' as never)}>Manage Crews</Button>
        </Card.Actions>
      </Card>

      {/* Payments Overview */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Payments</Text>
          <View style={styles.paymentsGrid}>
            <View style={styles.paymentItem}>
              <Text style={styles.paymentLabel}>Collected</Text>
              <Text style={[styles.paymentValue, { color: colors.success }]}>
                {formatCurrency(metrics?.payments.collected || 0)}
              </Text>
            </View>
            <View style={styles.paymentItem}>
              <Text style={styles.paymentLabel}>Pending</Text>
              <Text style={[styles.paymentValue, { color: colors.warning }]}>
                {formatCurrency(metrics?.payments.pending || 0)}
              </Text>
            </View>
            <View style={styles.paymentItem}>
              <Text style={styles.paymentLabel}>Overdue</Text>
              <Text style={[styles.paymentValue, { color: colors.error }]}>
                {formatCurrency(metrics?.payments.overdue || 0)}
              </Text>
            </View>
          </View>
        </Card.Content>
        <Card.Actions>
          <Button onPress={() => navigation.navigate('Payments' as never)}>View Payments</Button>
        </Card.Actions>
      </Card>

      {/* AI Performance */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>AI Performance Today</Text>
          <View style={styles.aiGrid}>
            <View style={styles.aiItem}>
              <Text style={styles.aiValue}>{metrics?.aiPerformance.decisionsToday || 0}</Text>
              <Text style={styles.aiLabel}>Decisions</Text>
            </View>
            <View style={styles.aiItem}>
              <Text style={styles.aiValue}>{metrics?.aiPerformance.autonomyRate || 0}%</Text>
              <Text style={styles.aiLabel}>Autonomy</Text>
            </View>
            <View style={styles.aiItem}>
              <Text style={styles.aiValue}>{metrics?.aiPerformance.escalations || 0}</Text>
              <Text style={styles.aiLabel}>Escalations</Text>
            </View>
            <View style={styles.aiItem}>
              <Text style={styles.aiValue}>{Math.round((metrics?.aiPerformance.avgConfidence || 0) * 100)}%</Text>
              <Text style={styles.aiLabel}>Avg Confidence</Text>
            </View>
          </View>
        </Card.Content>
        <Card.Actions>
          <Button onPress={() => navigation.navigate('Agents' as never)}>View AI Agents</Button>
        </Card.Actions>
      </Card>

      {/* Customer Stats */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Customers</Text>
          <View style={styles.customerGrid}>
            <View style={styles.customerItem}>
              <Text style={styles.customerValue}>{metrics?.customers.total || 0}</Text>
              <Text style={styles.customerLabel}>Total</Text>
            </View>
            <View style={styles.customerItem}>
              <Text style={[styles.customerValue, { color: colors.success }]}>
                +{metrics?.customers.new || 0}
              </Text>
              <Text style={styles.customerLabel}>New This Month</Text>
            </View>
            <View style={styles.customerItem}>
              <Text style={styles.customerValue}>{metrics?.customers.retention || 0}%</Text>
              <Text style={styles.customerLabel}>Retention</Text>
            </View>
          </View>
        </Card.Content>
        <Card.Actions>
          <Button onPress={() => navigation.navigate('Customers' as never)}>View Customers</Button>
        </Card.Actions>
      </Card>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <Button
            mode="contained"
            icon="plus"
            style={styles.actionButton}
            onPress={() => navigation.navigate('CreateJob' as never)}
          >
            New Job
          </Button>
          <Button
            mode="contained"
            icon="account-plus"
            style={styles.actionButton}
            onPress={() => navigation.navigate('CreateCustomer' as never)}
          >
            Add Customer
          </Button>
          <Button
            mode="outlined"
            icon="file-document"
            style={styles.actionButton}
            onPress={() => navigation.navigate('CreateQuote' as never)}
          >
            New Quote
          </Button>
          <Button
            mode="outlined"
            icon="message"
            style={styles.actionButton}
            onPress={() => navigation.navigate('Messages' as never)}
          >
            Messages
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}

// ============================================
// Helper Components
// ============================================

function StatBox({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={[styles.statBox, { borderLeftColor: color }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ============================================
// Helper Functions
// ============================================

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function getAlertStyle(type: 'warning' | 'error' | 'info') {
  switch (type) {
    case 'error':
      return { backgroundColor: '#FFEBEE', borderLeftColor: colors.error };
    case 'warning':
      return { backgroundColor: '#FFF3E0', borderLeftColor: colors.warning };
    case 'info':
    default:
      return { backgroundColor: '#E3F2FD', borderLeftColor: colors.info };
  }
}

function getUtilizationColor(percent: number): string {
  if (percent >= 80) return colors.success;
  if (percent >= 60) return colors.warning;
  return colors.error;
}

// ============================================
// Styles
// ============================================

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  contentContainer: {
    paddingBottom: spacing['3xl'],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral[500],
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  greeting: {
    fontSize: typography.sizes['2xl'],
    fontFamily: typography.fonts.bold,
    color: colors.foreground,
  },
  dateText: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
  alertsSection: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  alertCard: {
    borderLeftWidth: 4,
  },
  alertContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.semibold,
    color: colors.foreground,
  },
  alertMessage: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[600],
    marginTop: spacing.xs,
  },
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.semibold,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  revenueGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  revenuePrimary: {
    flex: 1,
  },
  revenueLabel: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
  },
  revenueValue: {
    fontSize: typography.sizes['3xl'],
    fontFamily: typography.fonts.bold,
    color: colors.foreground,
    marginVertical: spacing.xs,
  },
  changeChip: {
    alignSelf: 'flex-start',
  },
  changeChipText: {
    fontSize: typography.sizes.xs,
    color: colors.background,
    fontFamily: typography.fonts.semibold,
  },
  revenueSecondary: {
    flex: 1,
    justifyContent: 'center',
  },
  revenueItem: {
    marginBottom: spacing.sm,
  },
  revenueItemLabel: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
  },
  revenueItemValue: {
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.semibold,
    color: colors.foreground,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    minWidth: (width - spacing.lg * 3) / 2 - spacing.sm,
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
  },
  statValue: {
    fontSize: typography.sizes['2xl'],
    fontFamily: typography.fonts.bold,
    color: colors.foreground,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
  utilizationContainer: {
    marginTop: spacing.sm,
  },
  utilizationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  utilizationLabel: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[600],
  },
  utilizationPercent: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.semibold,
    color: colors.foreground,
  },
  progressBar: {
    height: 8,
    borderRadius: borderRadius.full,
  },
  paymentsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentItem: {
    flex: 1,
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
    marginBottom: spacing.xs,
  },
  paymentValue: {
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.semibold,
  },
  aiGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  aiItem: {
    flex: 1,
    alignItems: 'center',
  },
  aiValue: {
    fontSize: typography.sizes.xl,
    fontFamily: typography.fonts.bold,
    color: colors.foreground,
  },
  aiLabel: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  customerGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  customerItem: {
    flex: 1,
    alignItems: 'center',
  },
  customerValue: {
    fontSize: typography.sizes.xl,
    fontFamily: typography.fonts.bold,
    color: colors.foreground,
  },
  customerLabel: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  quickActions: {
    padding: spacing.lg,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minWidth: (width - spacing.lg * 2 - spacing.sm) / 2,
  },
});
