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
  IconButton,
  ActivityIndicator,
  Menu,
  Divider,
} from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme/tokens';
import { format } from 'date-fns';

// ============================================
// Payment History Screen
// ============================================

interface PaymentTransaction {
  id: string;
  type: 'charge' | 'refund' | 'payout';
  status: 'succeeded' | 'pending' | 'failed' | 'processing';
  amount: number;
  currency: string;
  description: string;
  jobId?: number;
  customerId?: number;
  customerName?: string;
  paymentMethodLast4?: string;
  paymentMethodBrand?: string;
  createdAt: string;
  receiptUrl?: string;
}

interface PaymentSummary {
  totalCollected: number;
  pendingPayments: number;
  thisMonth: number;
  lastMonth: number;
}

type FilterStatus = 'all' | 'succeeded' | 'pending' | 'failed';
type FilterType = 'all' | 'charge' | 'refund';

async function fetchPaymentHistory(params?: {
  status?: string;
  type?: string;
  limit?: number;
}): Promise<PaymentTransaction[]> {
  // In production, this would call the API
  return [
    {
      id: 'txn_1',
      type: 'charge',
      status: 'succeeded',
      amount: 175.00,
      currency: 'usd',
      description: 'Lawn mowing service - 123 Oak St',
      jobId: 1234,
      customerId: 101,
      customerName: 'John Smith',
      paymentMethodLast4: '4242',
      paymentMethodBrand: 'Visa',
      createdAt: new Date().toISOString(),
      receiptUrl: 'https://pay.stripe.com/receipt/...',
    },
    {
      id: 'txn_2',
      type: 'charge',
      status: 'pending',
      amount: 250.00,
      currency: 'usd',
      description: 'Full yard maintenance - 456 Maple Ave',
      jobId: 1235,
      customerId: 102,
      customerName: 'Sarah Johnson',
      paymentMethodLast4: '5555',
      paymentMethodBrand: 'Mastercard',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'txn_3',
      type: 'charge',
      status: 'succeeded',
      amount: 95.00,
      currency: 'usd',
      description: 'Hedge trimming - 789 Pine Rd',
      jobId: 1230,
      customerId: 103,
      customerName: 'Mike Davis',
      paymentMethodLast4: '4242',
      paymentMethodBrand: 'Visa',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      receiptUrl: 'https://pay.stripe.com/receipt/...',
    },
    {
      id: 'txn_4',
      type: 'refund',
      status: 'succeeded',
      amount: -50.00,
      currency: 'usd',
      description: 'Partial refund - Service not completed',
      jobId: 1228,
      customerId: 104,
      customerName: 'Emily Brown',
      createdAt: new Date(Date.now() - 259200000).toISOString(),
    },
    {
      id: 'txn_5',
      type: 'charge',
      status: 'failed',
      amount: 320.00,
      currency: 'usd',
      description: 'Monthly maintenance - 321 Cedar Ln',
      jobId: 1225,
      customerId: 105,
      customerName: 'David Wilson',
      paymentMethodLast4: '1234',
      paymentMethodBrand: 'Amex',
      createdAt: new Date(Date.now() - 345600000).toISOString(),
    },
  ];
}

async function fetchPaymentSummary(): Promise<PaymentSummary> {
  return {
    totalCollected: 45200.00,
    pendingPayments: 3300.00,
    thisMonth: 12800.00,
    lastMonth: 11500.00,
  };
}

export function PaymentHistoryScreen() {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<FilterStatus>('all');
  const [typeFilter, setTypeFilter] = React.useState<FilterType>('all');
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['payment-summary'],
    queryFn: fetchPaymentSummary,
  });

  const { data: transactions, isLoading, refetch } = useQuery({
    queryKey: ['payment-history', statusFilter, typeFilter],
    queryFn: () => fetchPaymentHistory({
      status: statusFilter === 'all' ? undefined : statusFilter,
      type: typeFilter === 'all' ? undefined : typeFilter,
    }),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const filteredTransactions = React.useMemo(() => {
    if (!transactions) return [];
    if (!searchQuery) return transactions;

    const query = searchQuery.toLowerCase();
    return transactions.filter(
      (t) =>
        t.description.toLowerCase().includes(query) ||
        t.customerName?.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query)
    );
  }, [transactions, searchQuery]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded':
        return colors.success;
      case 'pending':
      case 'processing':
        return colors.warning;
      case 'failed':
        return colors.error;
      default:
        return colors.neutral[500];
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'succeeded':
        return 'Completed';
      case 'pending':
        return 'Pending';
      case 'processing':
        return 'Processing';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };

  const handleTransactionPress = (transaction: PaymentTransaction) => {
    navigation.navigate('PaymentDetail' as never, { transactionId: transaction.id } as never);
  };

  const renderSummary = () => (
    <Card style={styles.summaryCard}>
      <Card.Content>
        <Text style={styles.summaryTitle}>Payment Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>This Month</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {formatCurrency(summary?.thisMonth || 0)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Last Month</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(summary?.lastMonth || 0)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Pending</Text>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>
              {formatCurrency(summary?.pendingPayments || 0)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Collected</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(summary?.totalCollected || 0)}
            </Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderTransaction = ({ item }: { item: PaymentTransaction }) => (
    <TouchableOpacity
      style={styles.transactionCard}
      onPress={() => handleTransactionPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.transactionLeft}>
        <View
          style={[
            styles.transactionIcon,
            { backgroundColor: item.type === 'refund' ? colors.error + '20' : colors.success + '20' },
          ]}
        >
          <IconButton
            icon={item.type === 'refund' ? 'arrow-up' : 'arrow-down'}
            iconColor={item.type === 'refund' ? colors.error : colors.success}
            size={20}
          />
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionDescription} numberOfLines={1}>
            {item.description}
          </Text>
          <Text style={styles.transactionCustomer}>
            {item.customerName || 'Unknown Customer'}
          </Text>
          <Text style={styles.transactionDate}>
            {format(new Date(item.createdAt), 'MMM d, yyyy • h:mm a')}
          </Text>
        </View>
      </View>

      <View style={styles.transactionRight}>
        <Text
          style={[
            styles.transactionAmount,
            { color: item.amount < 0 ? colors.error : colors.foreground },
          ]}
        >
          {item.amount < 0 ? '-' : '+'}{formatCurrency(item.amount)}
        </Text>
        <Chip
          style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) + '20' }]}
          textStyle={[styles.statusChipText, { color: getStatusColor(item.status) }]}
          compact
        >
          {getStatusLabel(item.status)}
        </Chip>
        {item.paymentMethodBrand && (
          <Text style={styles.paymentMethod}>
            {item.paymentMethodBrand} •••• {item.paymentMethodLast4}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <IconButton icon="cash-off" size={64} iconColor={colors.neutral[300]} />
      <Text style={styles.emptyTitle}>No transactions</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? 'No transactions match your search'
          : 'Transactions will appear here once payments are processed'}
      </Text>
    </View>
  );

  if (isLoading && !transactions) {
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
        <Text style={styles.headerTitle}>Payment History</Text>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon="filter-variant"
              onPress={() => setMenuVisible(true)}
            />
          }
        >
          <Menu.Item
            onPress={() => {
              setStatusFilter('all');
              setMenuVisible(false);
            }}
            title="All Status"
            leadingIcon={statusFilter === 'all' ? 'check' : undefined}
          />
          <Menu.Item
            onPress={() => {
              setStatusFilter('succeeded');
              setMenuVisible(false);
            }}
            title="Completed"
            leadingIcon={statusFilter === 'succeeded' ? 'check' : undefined}
          />
          <Menu.Item
            onPress={() => {
              setStatusFilter('pending');
              setMenuVisible(false);
            }}
            title="Pending"
            leadingIcon={statusFilter === 'pending' ? 'check' : undefined}
          />
          <Menu.Item
            onPress={() => {
              setStatusFilter('failed');
              setMenuVisible(false);
            }}
            title="Failed"
            leadingIcon={statusFilter === 'failed' ? 'check' : undefined}
          />
          <Divider />
          <Menu.Item
            onPress={() => {
              setTypeFilter('all');
              setMenuVisible(false);
            }}
            title="All Types"
            leadingIcon={typeFilter === 'all' ? 'check' : undefined}
          />
          <Menu.Item
            onPress={() => {
              setTypeFilter('charge');
              setMenuVisible(false);
            }}
            title="Charges Only"
            leadingIcon={typeFilter === 'charge' ? 'check' : undefined}
          />
          <Menu.Item
            onPress={() => {
              setTypeFilter('refund');
              setMenuVisible(false);
            }}
            title="Refunds Only"
            leadingIcon={typeFilter === 'refund' ? 'check' : undefined}
          />
        </Menu>
      </View>

      {/* Search Bar */}
      <Searchbar
        placeholder="Search transactions..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
        inputStyle={styles.searchInput}
      />

      {/* Active Filters */}
      {(statusFilter !== 'all' || typeFilter !== 'all') && (
        <View style={styles.activeFilters}>
          {statusFilter !== 'all' && (
            <Chip
              onClose={() => setStatusFilter('all')}
              style={styles.filterChip}
            >
              Status: {getStatusLabel(statusFilter)}
            </Chip>
          )}
          {typeFilter !== 'all' && (
            <Chip
              onClose={() => setTypeFilter('all')}
              style={styles.filterChip}
            >
              Type: {typeFilter}
            </Chip>
          )}
        </View>
      )}

      <FlatList
        data={filteredTransactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={!summaryLoading ? renderSummary : null}
        ListEmptyComponent={renderEmptyList}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerTitle: {
    fontSize: typography.sizes['xl'],
    fontFamily: typography.fonts.bold,
    color: colors.foreground,
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
  activeFilters: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    backgroundColor: colors.primary + '20',
  },
  listContent: {
    padding: spacing.lg,
  },
  summaryCard: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  summaryTitle: {
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.semibold,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  summaryItem: {
    flex: 1,
    minWidth: '45%',
  },
  summaryLabel: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
    marginBottom: spacing.xs,
  },
  summaryValue: {
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.semibold,
    color: colors.foreground,
  },
  separator: {
    height: 1,
    backgroundColor: colors.neutral[200],
    marginVertical: spacing.sm,
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  transactionLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  transactionIcon: {
    borderRadius: borderRadius.full,
    marginRight: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.medium,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  transactionCustomer: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[600],
    marginBottom: spacing.xs,
  },
  transactionDate: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.semibold,
    marginBottom: spacing.xs,
  },
  statusChip: {
    height: 20,
    marginBottom: spacing.xs,
  },
  statusChipText: {
    fontSize: 10,
    fontFamily: typography.fonts.medium,
  },
  paymentMethod: {
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
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
});
