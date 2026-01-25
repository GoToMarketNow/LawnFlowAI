import React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  Searchbar,
  FAB,
  Avatar,
  ProgressBar,
  ActivityIndicator,
  Badge,
} from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { getCrews, type Crew } from '../../services/api/queries';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme/tokens';

// ============================================
// Crews List Screen - For Operators
// ============================================

type CrewStatus = 'available' | 'on_job' | 'on_break' | 'offline';
type FilterStatus = 'all' | CrewStatus;

export function CrewsListScreen() {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<FilterStatus>('all');
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: crews, isLoading, refetch } = useQuery({
    queryKey: ['crews'],
    queryFn: async () => {
      const result = await getCrews();
      return result.data || [];
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const filteredCrews = React.useMemo(() => {
    if (!crews) return [];

    let filtered = crews;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((c: Crew) => c.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c: Crew) =>
          c.name.toLowerCase().includes(query) ||
          c.members.some((m) => m.name.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [crews, statusFilter, searchQuery]);

  const statusCounts = React.useMemo(() => {
    if (!crews) return { available: 0, on_job: 0, on_break: 0, offline: 0 };

    return crews.reduce(
      (acc: Record<CrewStatus, number>, crew: Crew) => {
        acc[crew.status as CrewStatus] = (acc[crew.status as CrewStatus] || 0) + 1;
        return acc;
      },
      { available: 0, on_job: 0, on_break: 0, offline: 0 }
    );
  }, [crews]);

  const handleCrewPress = (crew: Crew) => {
    navigation.navigate('CrewDetail' as never, { crewId: crew.id } as never);
  };

  const getStatusColor = (status: CrewStatus): string => {
    switch (status) {
      case 'available':
        return colors.success;
      case 'on_job':
        return colors.warning;
      case 'on_break':
        return colors.info;
      case 'offline':
        return colors.neutral[400];
      default:
        return colors.neutral[500];
    }
  };

  const getStatusLabel = (status: CrewStatus): string => {
    switch (status) {
      case 'available':
        return 'Available';
      case 'on_job':
        return 'On Job';
      case 'on_break':
        return 'On Break';
      case 'offline':
        return 'Offline';
      default:
        return status;
    }
  };

  const renderStatusFilter = () => (
    <View style={styles.statusFilters}>
      <FilterChip
        label="All"
        count={crews?.length || 0}
        active={statusFilter === 'all'}
        onPress={() => setStatusFilter('all')}
      />
      <FilterChip
        label="Available"
        count={statusCounts.available}
        active={statusFilter === 'available'}
        color={colors.success}
        onPress={() => setStatusFilter('available')}
      />
      <FilterChip
        label="On Job"
        count={statusCounts.on_job}
        active={statusFilter === 'on_job'}
        color={colors.warning}
        onPress={() => setStatusFilter('on_job')}
      />
      <FilterChip
        label="Offline"
        count={statusCounts.offline}
        active={statusFilter === 'offline'}
        color={colors.neutral[400]}
        onPress={() => setStatusFilter('offline')}
      />
    </View>
  );

  const renderCrew = ({ item }: { item: Crew }) => {
    const utilization = calculateUtilization(item);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleCrewPress(item)}
      >
        <Card style={styles.crewCard}>
          <Card.Content>
            {/* Header */}
            <View style={styles.crewHeader}>
              <View style={styles.crewTitleContainer}>
                <Text style={styles.crewName}>{item.name}</Text>
                <Chip
                  style={[
                    styles.statusChip,
                    { backgroundColor: getStatusColor(item.status as CrewStatus) + '20' },
                  ]}
                  textStyle={[
                    styles.statusChipText,
                    { color: getStatusColor(item.status as CrewStatus) },
                  ]}
                  compact
                >
                  {getStatusLabel(item.status as CrewStatus)}
                </Chip>
              </View>
              {item.currentJobId && (
                <Text style={styles.currentJob}>Job #{item.currentJobId}</Text>
              )}
            </View>

            {/* Members */}
            <View style={styles.membersSection}>
              <Text style={styles.sectionLabel}>Team Members</Text>
              <View style={styles.membersRow}>
                {item.members.slice(0, 4).map((member, index) => (
                  <View key={member.id} style={styles.memberAvatar}>
                    <Avatar.Text
                      size={36}
                      label={getInitials(member.name)}
                      style={{
                        backgroundColor:
                          member.role === 'leader'
                            ? colors.roles.crewLeader
                            : colors.roles.crewMember,
                      }}
                    />
                    {member.role === 'leader' && (
                      <Badge style={styles.leaderBadge} size={14}>
                        ★
                      </Badge>
                    )}
                  </View>
                ))}
                {item.members.length > 4 && (
                  <View style={styles.moreMembers}>
                    <Text style={styles.moreMembersText}>
                      +{item.members.length - 4}
                    </Text>
                  </View>
                )}
                <Text style={styles.memberCount}>
                  {item.members.length} member{item.members.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            {/* Skills */}
            {item.skills.length > 0 && (
              <View style={styles.skillsSection}>
                <Text style={styles.sectionLabel}>Skills</Text>
                <View style={styles.skillsRow}>
                  {item.skills.slice(0, 3).map((skill) => (
                    <Chip key={skill} style={styles.skillChip} compact>
                      {skill}
                    </Chip>
                  ))}
                  {item.skills.length > 3 && (
                    <Chip style={styles.skillChip} compact>
                      +{item.skills.length - 3}
                    </Chip>
                  )}
                </View>
              </View>
            )}

            {/* Utilization */}
            <View style={styles.utilizationSection}>
              <View style={styles.utilizationHeader}>
                <Text style={styles.sectionLabel}>Today's Utilization</Text>
                <Text style={styles.utilizationPercent}>{utilization}%</Text>
              </View>
              <ProgressBar
                progress={utilization / 100}
                color={getUtilizationColor(utilization)}
                style={styles.progressBar}
              />
            </View>

            {/* Equipment */}
            {item.equipment.length > 0 && (
              <View style={styles.equipmentSection}>
                <Text style={styles.equipmentText}>
                  Equipment: {item.equipment.slice(0, 2).join(', ')}
                  {item.equipment.length > 2 && ` +${item.equipment.length - 2} more`}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No crews found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery || statusFilter !== 'all'
          ? 'Try adjusting your search or filters'
          : 'Create your first crew to get started'}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Crews</Text>
        <Text style={styles.headerSubtitle}>
          {crews?.length || 0} total • {statusCounts.available} available
        </Text>
      </View>

      {/* Search */}
      <Searchbar
        placeholder="Search crews or members..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
        inputStyle={styles.searchInput}
      />

      {/* Status Filters */}
      {renderStatusFilter()}

      {/* Crews List */}
      <FlatList
        data={filteredCrews}
        renderItem={renderCrew}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyList}
      />

      {/* FAB for creating new crew */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('CreateCrew' as never)}
        label="New Crew"
      />
    </View>
  );
}

// ============================================
// Filter Chip Component
// ============================================

function FilterChip({
  label,
  count,
  active,
  color,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Chip
      mode={active ? 'flat' : 'outlined'}
      selected={active}
      onPress={onPress}
      style={[
        styles.filterChip,
        active && { backgroundColor: color || colors.primary },
      ]}
      textStyle={[
        styles.filterChipText,
        active && { color: colors.background },
      ]}
    >
      {label} ({count})
    </Chip>
  );
}

// ============================================
// Helper Functions
// ============================================

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function calculateUtilization(crew: Crew): number {
  // Mock calculation - in production, calculate from actual job data
  if (crew.status === 'on_job') return 75 + Math.floor(Math.random() * 20);
  if (crew.status === 'available') return 30 + Math.floor(Math.random() * 30);
  if (crew.status === 'on_break') return 50;
  return 0;
}

function getUtilizationColor(percent: number): string {
  if (percent >= 80) return colors.success;
  if (percent >= 50) return colors.warning;
  return colors.neutral[400];
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerTitle: {
    fontSize: typography.sizes['2xl'],
    fontFamily: typography.fonts.bold,
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
  searchBar: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background,
    elevation: 0,
  },
  searchInput: {
    fontSize: typography.sizes.sm,
  },
  statusFilters: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  filterChip: {
    backgroundColor: colors.background,
    borderColor: colors.neutral[300],
  },
  filterChipText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral[600],
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'] * 2,
  },
  crewCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  crewHeader: {
    marginBottom: spacing.md,
  },
  crewTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  crewName: {
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.semibold,
    color: colors.foreground,
  },
  statusChip: {
    height: 24,
  },
  statusChipText: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.medium,
  },
  currentJob: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.medium,
    color: colors.info,
    marginTop: spacing.xs,
  },
  sectionLabel: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.medium,
    color: colors.neutral[500],
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  membersSection: {
    marginBottom: spacing.md,
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    marginRight: -spacing.sm,
    position: 'relative',
  },
  leaderBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.warning,
  },
  moreMembers: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral[200],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  moreMembersText: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.medium,
    color: colors.neutral[600],
  },
  memberCount: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[600],
    marginLeft: spacing.md,
  },
  skillsSection: {
    marginBottom: spacing.md,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  skillChip: {
    backgroundColor: colors.neutral[100],
    height: 24,
  },
  utilizationSection: {
    marginBottom: spacing.md,
  },
  utilizationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  utilizationPercent: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.semibold,
    color: colors.foreground,
  },
  progressBar: {
    height: 6,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  equipmentSection: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  equipmentText: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.semibold,
    color: colors.foreground,
  },
  emptySubtitle: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.primary,
  },
});
