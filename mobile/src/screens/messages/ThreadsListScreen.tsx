import React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Text, Searchbar, Chip, Avatar, Badge, ActivityIndicator } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { getThreads, type Message } from '../../services/api/queries';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme/tokens';
import { formatDistanceToNow } from 'date-fns';

// ============================================
// Messages/Communications - Threads List
// ============================================

interface Thread {
  id: string;
  type: 'crew' | 'ops' | 'customer_proxy';
  name: string;
  avatarUrl?: string;
  lastMessage: {
    text: string;
    senderName: string;
    sentAt: string;
  };
  unreadCount: number;
  participants: Array<{
    id: number;
    name: string;
    role: string;
  }>;
  entityType?: 'job' | 'customer' | 'crew';
  entityId?: string;
}

type FilterType = 'all' | 'crew' | 'ops' | 'customer';

export function ThreadsListScreen() {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<FilterType>('all');
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: threads, isLoading, refetch } = useQuery({
    queryKey: ['threads', activeFilter],
    queryFn: async () => {
      const result = await getThreads({
        threadType: activeFilter === 'all' ? undefined : activeFilter,
      });
      return result.data || [];
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const filteredThreads = React.useMemo(() => {
    if (!threads) return [];
    if (!searchQuery) return threads;

    const query = searchQuery.toLowerCase();
    return threads.filter(
      (thread: Thread) =>
        thread.name.toLowerCase().includes(query) ||
        thread.lastMessage?.text.toLowerCase().includes(query)
    );
  }, [threads, searchQuery]);

  const totalUnread = React.useMemo(() => {
    if (!threads) return 0;
    return threads.reduce((sum: number, t: Thread) => sum + (t.unreadCount || 0), 0);
  }, [threads]);

  const handleThreadPress = (thread: Thread) => {
    navigation.navigate('Thread' as never, { threadId: thread.id, threadName: thread.name } as never);
  };

  const renderThread = ({ item }: { item: Thread }) => (
    <TouchableOpacity
      style={[styles.threadCard, item.unreadCount > 0 && styles.unreadThread]}
      onPress={() => handleThreadPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        {item.avatarUrl ? (
          <Avatar.Image size={50} source={{ uri: item.avatarUrl }} />
        ) : (
          <Avatar.Text
            size={50}
            label={getInitials(item.name)}
            style={{ backgroundColor: getThreadColor(item.type) }}
          />
        )}
        {item.unreadCount > 0 && (
          <Badge style={styles.unreadBadge}>{item.unreadCount}</Badge>
        )}
      </View>

      <View style={styles.threadContent}>
        <View style={styles.threadHeader}>
          <Text style={styles.threadName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.timestamp}>
            {item.lastMessage?.sentAt
              ? formatDistanceToNow(new Date(item.lastMessage.sentAt), { addSuffix: true })
              : ''}
          </Text>
        </View>

        <View style={styles.threadMeta}>
          <Chip
            style={[styles.typeChip, { backgroundColor: getThreadColor(item.type) + '20' }]}
            textStyle={[styles.typeChipText, { color: getThreadColor(item.type) }]}
            compact
          >
            {getThreadTypeLabel(item.type)}
          </Chip>
        </View>

        <Text
          style={[styles.lastMessage, item.unreadCount > 0 && styles.unreadMessage]}
          numberOfLines={2}
        >
          {item.lastMessage?.senderName && (
            <Text style={styles.senderName}>{item.lastMessage.senderName}: </Text>
          )}
          {item.lastMessage?.text || 'No messages yet'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No conversations</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? 'No messages match your search'
          : 'Start a conversation with your crew or customers'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header with unread count */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        {totalUnread > 0 && (
          <Chip style={styles.totalUnreadChip} textStyle={styles.totalUnreadText}>
            {totalUnread} unread
          </Chip>
        )}
      </View>

      {/* Search Bar */}
      <Searchbar
        placeholder="Search messages..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
        inputStyle={styles.searchInput}
      />

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <FilterChip
          label="All"
          active={activeFilter === 'all'}
          onPress={() => setActiveFilter('all')}
        />
        <FilterChip
          label="Crew"
          active={activeFilter === 'crew'}
          onPress={() => setActiveFilter('crew')}
        />
        <FilterChip
          label="Operations"
          active={activeFilter === 'ops'}
          onPress={() => setActiveFilter('ops')}
        />
        <FilterChip
          label="Customers"
          active={activeFilter === 'customer'}
          onPress={() => setActiveFilter('customer')}
        />
      </View>

      {/* Threads List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredThreads}
          renderItem={renderThread}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={renderEmptyList}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

// ============================================
// Filter Chip Component
// ============================================

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Chip
      mode={active ? 'flat' : 'outlined'}
      selected={active}
      onPress={onPress}
      style={[styles.filterChip, active && styles.activeFilterChip]}
      textStyle={[styles.filterChipText, active && styles.activeFilterChipText]}
    >
      {label}
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

function getThreadColor(type: string): string {
  switch (type) {
    case 'crew':
      return colors.roles.crewLeader;
    case 'ops':
      return colors.roles.owner;
    case 'customer_proxy':
      return colors.roles.customer;
    default:
      return colors.neutral[500];
  }
}

function getThreadTypeLabel(type: string): string {
  switch (type) {
    case 'crew':
      return 'Crew';
    case 'ops':
      return 'Operations';
    case 'customer_proxy':
      return 'Customer';
    default:
      return type;
  }
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  totalUnreadChip: {
    backgroundColor: colors.error,
  },
  totalUnreadText: {
    color: colors.background,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.semibold,
  },
  searchBar: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
    elevation: 0,
  },
  searchInput: {
    fontSize: typography.sizes.sm,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    backgroundColor: colors.background,
    borderColor: colors.neutral[300],
  },
  activeFilterChip: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral[600],
  },
  activeFilterChipText: {
    color: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  separator: {
    height: 1,
    backgroundColor: colors.neutral[200],
    marginVertical: spacing.sm,
  },
  threadCard: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  unreadThread: {
    backgroundColor: colors.neutral[50],
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  avatarContainer: {
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
  },
  threadContent: {
    flex: 1,
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  threadName: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.semibold,
    color: colors.foreground,
    marginRight: spacing.sm,
  },
  timestamp: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
  },
  threadMeta: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  typeChip: {
    height: 20,
  },
  typeChipText: {
    fontSize: 10,
    fontFamily: typography.fonts.medium,
  },
  lastMessage: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[600],
    lineHeight: typography.lineHeights.sm,
  },
  unreadMessage: {
    fontFamily: typography.fonts.medium,
    color: colors.foreground,
  },
  senderName: {
    fontFamily: typography.fonts.medium,
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
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
