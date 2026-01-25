/**
 * Marketing Dashboard for Mobile App (Owner View)
 * 
 * Shows key metrics, recent prospects, and serviceability indicators
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useMarketingMetrics, useRecentProspects, usePendingApprovalsCount } from '../hooks/useMarketing';
import { Ionicons } from '@expo/vector-icons';

export default function MarketingDashboardScreen({ navigation }: any) {
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useMarketingMetrics(30);
  const { data: recentProspects, isLoading: prospectsLoading, refetch: refetchProspects } = useRecentProspects(5);
  const { data: pendingApprovals } = usePendingApprovalsCount();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchMetrics(), refetchProspects()]);
    setRefreshing(false);
  };

  const getServiceabilityColor = (status?: string) => {
    switch (status) {
      case 'serviceable': return '#10b981'; // green
      case 'maybe_serviceable': return '#f59e0b'; // yellow
      case 'not_serviceable': return '#ef4444'; // red
      default: return '#6b7280'; // gray
    }
  };

  const getServiceabilityIcon = (status?: string) => {
    switch (status) {
      case 'serviceable': return 'checkmark-circle';
      case 'maybe_serviceable': return 'alert-circle';
      case 'not_serviceable': return 'close-circle';
      default: return 'help-circle';
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Marketing</Text>
          <Text style={styles.headerSubtitle}>Growth Pipeline</Text>
        </View>
        {pendingApprovals > 0 && (
          <TouchableOpacity 
            style={styles.approvalsButton}
            onPress={() => navigation.navigate('MarketingApprovals')}
          >
            <Ionicons name="notifications" size={20} color="#fff" />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingApprovals}</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, { backgroundColor: '#3b82f6' }]}>
          <Ionicons name="people" size={28} color="#fff" style={styles.kpiIcon} />
          <Text style={styles.kpiValue}>{metrics?.totalProspects || 0}</Text>
          <Text style={styles.kpiLabel}>Total Prospects</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: '#8b5cf6' }]}>
          <Ionicons name="checkmark-done" size={28} color="#fff" style={styles.kpiIcon} />
          <Text style={styles.kpiValue}>{metrics?.preQualified || 0}</Text>
          <Text style={styles.kpiLabel}>Pre-Qualified</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: '#f59e0b' }]}>
          <Ionicons name="chatbubbles" size={28} color="#fff" style={styles.kpiIcon} />
          <Text style={styles.kpiValue}>{metrics?.engaged || 0}</Text>
          <Text style={styles.kpiLabel}>Engaged</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: '#10b981' }]}>
          <Ionicons name="trending-up" size={28} color="#fff" style={styles.kpiIcon} />
          <Text style={styles.kpiValue}>{metrics?.converted || 0}</Text>
          <Text style={styles.kpiLabel}>Converted</Text>
        </View>
      </View>

      {/* Conversion Rate */}
      <View style={styles.conversionCard}>
        <View style={styles.conversionHeader}>
          <Text style={styles.conversionLabel}>Conversion Rate</Text>
          <Text style={styles.conversionValue}>
            {metrics?.conversionRate?.toFixed(1) || '0'}%
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${Math.min(metrics?.conversionRate || 0, 100)}%` }
            ]} 
          />
        </View>
      </View>

      {/* Pre-Qualification Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pre-Qualification Results</Text>
        <View style={styles.breakdownCard}>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLabel}>
              <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
              <Text style={styles.breakdownText}>Serviceable</Text>
            </View>
            <Text style={styles.breakdownValue}>
              {metrics?.serviceabilityBreakdown.serviceable || 0}
            </Text>
          </View>

          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLabel}>
              <View style={[styles.dot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.breakdownText}>Needs Info</Text>
            </View>
            <Text style={styles.breakdownValue}>
              {metrics?.serviceabilityBreakdown.maybeServiceable || 0}
            </Text>
          </View>

          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLabel}>
              <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.breakdownText}>Not Serviceable</Text>
            </View>
            <Text style={styles.breakdownValue}>
              {metrics?.serviceabilityBreakdown.notServiceable || 0}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.savingsRow}>
            <Text style={styles.savingsLabel}>Cost Savings</Text>
            <Text style={styles.savingsValue}>
              ${(((metrics?.serviceabilityBreakdown.notServiceable || 0) * 0.50) / 100).toFixed(2)}
            </Text>
          </View>
          <Text style={styles.savingsNote}>
            Prevented {metrics?.serviceabilityBreakdown.notServiceable || 0} wasted outreaches
          </Text>
        </View>
      </View>

      {/* Source Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Prospects by Source</Text>
        <View style={styles.sourceCard}>
          <View style={styles.sourceRow}>
            <View style={styles.sourceLabel}>
              <Ionicons name="globe" size={20} color="#3b82f6" />
              <Text style={styles.sourceText}>Social Media</Text>
            </View>
            <Text style={styles.sourceValue}>{metrics?.bySource.social || 0}</Text>
          </View>

          <View style={styles.sourceRow}>
            <View style={styles.sourceLabel}>
              <Ionicons name="people" size={20} color="#8b5cf6" />
              <Text style={styles.sourceText}>Referrals</Text>
            </View>
            <Text style={styles.sourceValue}>{metrics?.bySource.referral || 0}</Text>
          </View>
        </View>
      </View>

      {/* Recent Prospects */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Prospects</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MarketingPipeline')}>
            <Text style={styles.seeAllLink}>See All</Text>
          </TouchableOpacity>
        </View>

        {prospectsLoading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : recentProspects && recentProspects.length > 0 ? (
          recentProspects.map((prospect) => (
            <TouchableOpacity 
              key={prospect.id} 
              style={styles.prospectCard}
              onPress={() => navigation.navigate('ProspectDetail', { prospectId: prospect.id })}
            >
              <View style={styles.prospectHeader}>
                <View style={styles.prospectInfo}>
                  <Text style={styles.prospectName}>
                    {prospect.name || prospect.phone || 'Unknown'}
                  </Text>
                  <View style={styles.prospectMeta}>
                    <View style={[styles.sourceBadge, { 
                      backgroundColor: prospect.source === 'social' ? '#dbeafe' : '#ede9fe' 
                    }]}>
                      <Text style={[styles.sourceBadgeText, {
                        color: prospect.source === 'social' ? '#3b82f6' : '#8b5cf6'
                      }]}>
                        {prospect.source === 'social' ? '🌐 Social' : '🤝 Referral'}
                      </Text>
                    </View>
                    <Text style={styles.confidenceText}>
                      {Math.round(prospect.confidence * 100)}% confidence
                    </Text>
                  </View>
                </View>
                <Ionicons 
                  name={getServiceabilityIcon(prospect.serviceabilityStatus) as any}
                  size={24}
                  color={getServiceabilityColor(prospect.serviceabilityStatus)}
                />
              </View>

              {prospect.requestedServices && prospect.requestedServices.length > 0 && (
                <Text style={styles.servicesText}>
                  {prospect.requestedServices.slice(0, 2).join(', ')}
                  {prospect.requestedServices.length > 2 && ` +${prospect.requestedServices.length - 2}`}
                </Text>
              )}

              {(prospect.city || prospect.state) && (
                <View style={styles.locationRow}>
                  <Ionicons name="location" size={14} color="#6b7280" />
                  <Text style={styles.locationText}>
                    {[prospect.city, prospect.state].filter(Boolean).join(', ')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="megaphone-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyStateText}>No prospects yet</Text>
          </View>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  approvalsButton: {
    backgroundColor: '#3b82f6',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  kpiCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    minHeight: 110,
  },
  kpiIcon: {
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.9,
  },
  conversionCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  conversionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  conversionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  conversionValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10b981',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAllLink: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  breakdownCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  breakdownLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  breakdownText: {
    fontSize: 15,
    color: '#374151',
  },
  breakdownValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  savingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  savingsLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  savingsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10b981',
  },
  savingsNote: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  sourceCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sourceLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sourceText: {
    fontSize: 15,
    color: '#374151',
  },
  sourceValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  prospectCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  prospectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  prospectInfo: {
    flex: 1,
  },
  prospectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  prospectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sourceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  confidenceText: {
    fontSize: 12,
    color: '#6b7280',
  },
  servicesText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
  loadingText: {
    textAlign: 'center',
    color: '#6b7280',
    paddingVertical: 20,
  },
});
