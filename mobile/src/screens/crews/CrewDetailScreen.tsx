import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Chip,
  Avatar,
  IconButton,
  ActivityIndicator,
  Dialog,
  Portal,
  TextInput,
  Menu,
  Divider,
  List,
  ProgressBar,
} from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getCrew, getCrewAssignments, type Crew, type CrewMember } from '../../services/api/queries';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme/tokens';
import { format, isToday, isTomorrow } from 'date-fns';

// ============================================
// Crew Detail Screen - Member Management
// ============================================

interface RouteParams {
  crewId: number;
}

interface Assignment {
  id: number;
  jobId: number;
  customerName: string;
  address: string;
  serviceType: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: 'scheduled' | 'in_progress' | 'completed';
}

interface CrewStats {
  jobsCompleted: number;
  avgJobDuration: number;
  customerRating: number;
  onTimeRate: number;
}

async function fetchCrewStats(crewId: number): Promise<CrewStats> {
  // Mock data - in production, call API
  return {
    jobsCompleted: 127,
    avgJobDuration: 45,
    customerRating: 4.8,
    onTimeRate: 96,
  };
}

async function updateCrewStatus(crewId: number, status: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function removeMember(crewId: number, memberId: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 500));
}

export function CrewDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { crewId } = route.params as RouteParams;

  const [refreshing, setRefreshing] = React.useState(false);
  const [statusMenuVisible, setStatusMenuVisible] = React.useState(false);
  const [addMemberDialogVisible, setAddMemberDialogVisible] = React.useState(false);

  const { data: crew, isLoading, refetch } = useQuery({
    queryKey: ['crew', crewId],
    queryFn: async () => {
      const result = await getCrew(crewId);
      return result.data;
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ['crew-assignments', crewId],
    queryFn: async () => {
      const result = await getCrewAssignments(crewId);
      return result.data || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['crew-stats', crewId],
    queryFn: () => fetchCrewStats(crewId),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => updateCrewStatus(crewId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crew', crewId] });
      queryClient.invalidateQueries({ queryKey: ['crews'] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: number) => removeMember(crewId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crew', crewId] });
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  React.useEffect(() => {
    if (crew) {
      navigation.setOptions({ title: crew.name });
    }
  }, [crew]);

  const handleStatusChange = (status: string) => {
    setStatusMenuVisible(false);
    updateStatusMutation.mutate(status);
  };

  const handleRemoveMember = (member: CrewMember) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.name} from this crew?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeMemberMutation.mutate(member.id),
        },
      ]
    );
  };

  const getStatusColor = (status: string): string => {
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

  const getStatusLabel = (status: string): string => {
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

  if (isLoading || !crew) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const leader = crew.members.find((m) => m.role === 'leader');
  const members = crew.members.filter((m) => m.role !== 'leader');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Status Card */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.statusHeader}>
            <View>
              <Text style={styles.crewName}>{crew.name}</Text>
              <Text style={styles.lastUpdate}>
                Last update: {crew.lastUpdate ? format(new Date(crew.lastUpdate), 'h:mm a') : 'N/A'}
              </Text>
            </View>
            <Menu
              visible={statusMenuVisible}
              onDismiss={() => setStatusMenuVisible(false)}
              anchor={
                <Chip
                  style={[
                    styles.statusChip,
                    { backgroundColor: getStatusColor(crew.status) + '20' },
                  ]}
                  textStyle={[
                    styles.statusChipText,
                    { color: getStatusColor(crew.status) },
                  ]}
                  onPress={() => setStatusMenuVisible(true)}
                  icon="chevron-down"
                >
                  {getStatusLabel(crew.status)}
                </Chip>
              }
            >
              <Menu.Item
                onPress={() => handleStatusChange('available')}
                title="Available"
                leadingIcon="check-circle"
              />
              <Menu.Item
                onPress={() => handleStatusChange('on_break')}
                title="On Break"
                leadingIcon="coffee"
              />
              <Menu.Item
                onPress={() => handleStatusChange('offline')}
                title="Offline"
                leadingIcon="close-circle"
              />
            </Menu>
          </View>

          {crew.currentJobId && (
            <TouchableOpacity
              style={styles.currentJobBanner}
              onPress={() =>
                navigation.navigate('Jobs' as never, {
                  screen: 'JobDetail',
                  params: { jobId: crew.currentJobId },
                } as never)
              }
            >
              <IconButton icon="briefcase" size={20} iconColor={colors.warning} />
              <Text style={styles.currentJobText}>
                Currently on Job #{crew.currentJobId}
              </Text>
              <IconButton icon="chevron-right" size={20} />
            </TouchableOpacity>
          )}
        </Card.Content>
      </Card>

      {/* Performance Stats */}
      {stats && (
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Performance</Text>
            <View style={styles.statsGrid}>
              <StatItem
                label="Jobs Completed"
                value={stats.jobsCompleted.toString()}
                icon="check-circle"
              />
              <StatItem
                label="Avg Duration"
                value={`${stats.avgJobDuration} min`}
                icon="clock-outline"
              />
              <StatItem
                label="Rating"
                value={stats.customerRating.toFixed(1)}
                icon="star"
                color={colors.warning}
              />
              <StatItem
                label="On-Time"
                value={`${stats.onTimeRate}%`}
                icon="clock-check"
                color={colors.success}
              />
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Team Members */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Team Members</Text>
            <Button
              mode="text"
              icon="plus"
              compact
              onPress={() => setAddMemberDialogVisible(true)}
            >
              Add
            </Button>
          </View>

          {/* Leader */}
          {leader && (
            <View style={styles.leaderSection}>
              <Text style={styles.roleLabel}>Crew Leader</Text>
              <MemberCard
                member={leader}
                isLeader
                onRemove={() => handleRemoveMember(leader)}
                onPress={() =>
                  navigation.navigate('MemberDetail' as never, { memberId: leader.id } as never)
                }
              />
            </View>
          )}

          {/* Members */}
          {members.length > 0 && (
            <View style={styles.membersSection}>
              <Text style={styles.roleLabel}>Members</Text>
              {members.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  onRemove={() => handleRemoveMember(member)}
                  onPress={() =>
                    navigation.navigate('MemberDetail' as never, { memberId: member.id } as never)
                  }
                />
              ))}
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Skills & Equipment */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Skills & Equipment</Text>
            <Button
              mode="text"
              icon="pencil"
              compact
              onPress={() => navigation.navigate('EditCrewSkills' as never, { crewId } as never)}
            >
              Edit
            </Button>
          </View>

          <View style={styles.skillsSection}>
            <Text style={styles.subsectionLabel}>Skills</Text>
            <View style={styles.chipsRow}>
              {crew.skills.length > 0 ? (
                crew.skills.map((skill) => (
                  <Chip key={skill} style={styles.chip} compact>
                    {skill}
                  </Chip>
                ))
              ) : (
                <Text style={styles.emptyText}>No skills assigned</Text>
              )}
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.equipmentSection}>
            <Text style={styles.subsectionLabel}>Equipment</Text>
            <View style={styles.chipsRow}>
              {crew.equipment.length > 0 ? (
                crew.equipment.map((item) => (
                  <Chip key={item} style={styles.chip} icon="tools" compact>
                    {item}
                  </Chip>
                ))
              ) : (
                <Text style={styles.emptyText}>No equipment assigned</Text>
              )}
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Upcoming Assignments */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Assignments</Text>
            <Button
              mode="text"
              compact
              onPress={() => navigation.navigate('CrewSchedule' as never, { crewId } as never)}
            >
              View All
            </Button>
          </View>

          {assignments && assignments.length > 0 ? (
            assignments.slice(0, 3).map((assignment: Assignment) => (
              <TouchableOpacity
                key={assignment.id}
                style={styles.assignmentItem}
                onPress={() =>
                  navigation.navigate('Jobs' as never, {
                    screen: 'JobDetail',
                    params: { jobId: assignment.jobId },
                  } as never)
                }
              >
                <View style={styles.assignmentDate}>
                  <Text style={styles.assignmentDateText}>
                    {formatAssignmentDate(assignment.scheduledStart)}
                  </Text>
                  <Text style={styles.assignmentTime}>
                    {format(new Date(assignment.scheduledStart), 'h:mm a')}
                  </Text>
                </View>
                <View style={styles.assignmentDetails}>
                  <Text style={styles.assignmentCustomer}>{assignment.customerName}</Text>
                  <Text style={styles.assignmentService}>{assignment.serviceType}</Text>
                  <Text style={styles.assignmentAddress} numberOfLines={1}>
                    {assignment.address}
                  </Text>
                </View>
                <IconButton icon="chevron-right" size={20} />
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>No upcoming assignments</Text>
          )}
        </Card.Content>
      </Card>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          mode="outlined"
          icon="message"
          onPress={() =>
            navigation.navigate('Messages' as never, {
              screen: 'Thread',
              params: { threadId: `crew-${crewId}`, threadName: crew.name },
            } as never)
          }
          style={styles.actionButton}
        >
          Message Crew
        </Button>
        <Button
          mode="outlined"
          icon="calendar"
          onPress={() => navigation.navigate('CrewSchedule' as never, { crewId } as never)}
          style={styles.actionButton}
        >
          View Schedule
        </Button>
      </View>

      {/* Add Member Dialog */}
      <Portal>
        <Dialog
          visible={addMemberDialogVisible}
          onDismiss={() => setAddMemberDialogVisible(false)}
        >
          <Dialog.Title>Add Team Member</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              Select a team member to add to {crew.name}:
            </Text>
            {/* In production, this would show a searchable list of available members */}
            <List.Item
              title="John Doe"
              description="Available • Mowing, Trimming"
              left={(props) => <Avatar.Text {...props} size={40} label="JD" />}
              onPress={() => {
                setAddMemberDialogVisible(false);
                // Add member logic
              }}
            />
            <List.Item
              title="Jane Smith"
              description="Available • Landscaping"
              left={(props) => <Avatar.Text {...props} size={40} label="JS" />}
              onPress={() => {
                setAddMemberDialogVisible(false);
                // Add member logic
              }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddMemberDialogVisible(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

// ============================================
// Member Card Component
// ============================================

function MemberCard({
  member,
  isLeader,
  onRemove,
  onPress,
}: {
  member: CrewMember;
  isLeader?: boolean;
  onRemove: () => void;
  onPress: () => void;
}) {
  const [menuVisible, setMenuVisible] = React.useState(false);

  return (
    <TouchableOpacity style={styles.memberCard} onPress={onPress} activeOpacity={0.7}>
      <Avatar.Text
        size={44}
        label={getInitials(member.name)}
        style={{
          backgroundColor: isLeader ? colors.roles.crewLeader : colors.roles.crewMember,
        }}
      />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{member.name}</Text>
        {member.phone && <Text style={styles.memberPhone}>{member.phone}</Text>}
        {member.skills.length > 0 && (
          <Text style={styles.memberSkills}>{member.skills.slice(0, 2).join(', ')}</Text>
        )}
      </View>
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <IconButton
            icon="dots-vertical"
            onPress={() => setMenuVisible(true)}
          />
        }
      >
        <Menu.Item onPress={onPress} title="View Profile" leadingIcon="account" />
        <Menu.Item
          onPress={() => {
            setMenuVisible(false);
            // Call member
          }}
          title="Call"
          leadingIcon="phone"
        />
        <Divider />
        <Menu.Item
          onPress={() => {
            setMenuVisible(false);
            onRemove();
          }}
          title="Remove from Crew"
          leadingIcon="account-remove"
          titleStyle={{ color: colors.error }}
        />
      </Menu>
    </TouchableOpacity>
  );
}

// ============================================
// Stat Item Component
// ============================================

function StatItem({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color?: string;
}) {
  return (
    <View style={styles.statItem}>
      <IconButton icon={icon} size={20} iconColor={color || colors.neutral[500]} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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

function formatAssignmentDate(dateString: string): string {
  const date = new Date(dateString);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEE, MMM d');
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
  },
  card: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  crewName: {
    fontSize: typography.sizes.xl,
    fontFamily: typography.fonts.bold,
    color: colors.foreground,
  },
  lastUpdate: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
  statusChip: {
    height: 32,
  },
  statusChipText: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.medium,
  },
  currentJobBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '15',
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  currentJobText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.medium,
    color: colors.warning,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.semibold,
    color: colors.foreground,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.bold,
    color: colors.foreground,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  leaderSection: {
    marginBottom: spacing.md,
  },
  membersSection: {
    marginTop: spacing.md,
  },
  roleLabel: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.medium,
    color: colors.neutral[500],
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  memberInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  memberName: {
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.medium,
    color: colors.foreground,
  },
  memberPhone: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[600],
    marginTop: spacing.xs,
  },
  memberSkills: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
  subsectionLabel: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.medium,
    color: colors.neutral[600],
    marginBottom: spacing.sm,
  },
  skillsSection: {
    marginBottom: spacing.md,
  },
  equipmentSection: {
    marginTop: spacing.md,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.neutral[100],
  },
  divider: {
    backgroundColor: colors.neutral[200],
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[400],
    fontStyle: 'italic',
  },
  assignmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  assignmentDate: {
    width: 70,
  },
  assignmentDateText: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.semibold,
    color: colors.foreground,
  },
  assignmentTime: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
  },
  assignmentDetails: {
    flex: 1,
    marginLeft: spacing.md,
  },
  assignmentCustomer: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.medium,
    color: colors.foreground,
  },
  assignmentService: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.info,
    marginTop: spacing.xs,
  },
  assignmentAddress: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  dialogText: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[600],
    marginBottom: spacing.md,
  },
});
