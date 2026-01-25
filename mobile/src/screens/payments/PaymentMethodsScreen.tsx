import React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  IconButton,
  ActivityIndicator,
  Dialog,
  Portal,
  TextInput,
  Chip,
} from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme/tokens';

// ============================================
// Payment Methods Screen
// ============================================

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank' | 'apple_pay' | 'google_pay';
  brand?: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
  nickname?: string;
}

async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  // In production, this would call the API
  return [
    {
      id: 'pm_1',
      type: 'card',
      brand: 'Visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2027,
      isDefault: true,
      nickname: 'Business Card',
    },
    {
      id: 'pm_2',
      type: 'card',
      brand: 'Mastercard',
      last4: '5555',
      expMonth: 8,
      expYear: 2026,
      isDefault: false,
    },
    {
      id: 'pm_3',
      type: 'bank',
      brand: 'Chase',
      last4: '6789',
      isDefault: false,
      nickname: 'Checking Account',
    },
  ];
}

async function deletePaymentMethod(id: string): Promise<void> {
  // In production, this would call the API
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function setDefaultPaymentMethod(id: string): Promise<void> {
  // In production, this would call the API
  await new Promise((resolve) => setTimeout(resolve, 500));
}

export function PaymentMethodsScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = React.useState(false);
  const [addDialogVisible, setAddDialogVisible] = React.useState(false);

  const { data: methods, isLoading, refetch } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: fetchPaymentMethods,
  });

  const deleteMutation = useMutation({
    mutationFn: deletePaymentMethod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: setDefaultPaymentMethod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleDelete = (method: PaymentMethod) => {
    if (method.isDefault) {
      Alert.alert(
        'Cannot Delete',
        'You cannot delete your default payment method. Please set another method as default first.'
      );
      return;
    }

    Alert.alert(
      'Delete Payment Method',
      `Are you sure you want to remove ${method.brand || method.type} ending in ${method.last4}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(method.id),
        },
      ]
    );
  };

  const handleSetDefault = (method: PaymentMethod) => {
    if (method.isDefault) return;
    setDefaultMutation.mutate(method.id);
  };

  const getCardIcon = (type: string, brand?: string): string => {
    switch (brand?.toLowerCase()) {
      case 'visa':
        return 'credit-card';
      case 'mastercard':
        return 'credit-card';
      case 'amex':
        return 'credit-card';
      default:
        if (type === 'bank') return 'bank';
        if (type === 'apple_pay') return 'apple';
        if (type === 'google_pay') return 'google';
        return 'credit-card';
    }
  };

  const renderPaymentMethod = ({ item }: { item: PaymentMethod }) => (
    <Card style={[styles.methodCard, item.isDefault && styles.defaultCard]}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.methodInfo}>
          <IconButton
            icon={getCardIcon(item.type, item.brand)}
            size={28}
            iconColor={item.isDefault ? colors.primary : colors.neutral[600]}
          />
          <View style={styles.methodDetails}>
            <View style={styles.methodHeader}>
              <Text style={styles.methodBrand}>
                {item.brand || item.type.replace('_', ' ')}
              </Text>
              {item.isDefault && (
                <Chip style={styles.defaultChip} textStyle={styles.defaultChipText} compact>
                  Default
                </Chip>
              )}
            </View>
            <Text style={styles.methodLast4}>•••• {item.last4}</Text>
            {item.expMonth && item.expYear && (
              <Text style={styles.methodExpiry}>
                Expires {item.expMonth.toString().padStart(2, '0')}/{item.expYear}
              </Text>
            )}
            {item.nickname && (
              <Text style={styles.methodNickname}>{item.nickname}</Text>
            )}
          </View>
        </View>

        <View style={styles.methodActions}>
          {!item.isDefault && (
            <Button
              mode="text"
              compact
              onPress={() => handleSetDefault(item)}
              loading={setDefaultMutation.isPending}
            >
              Set Default
            </Button>
          )}
          <IconButton
            icon="delete-outline"
            iconColor={colors.error}
            size={20}
            onPress={() => handleDelete(item)}
            disabled={deleteMutation.isPending}
          />
        </View>
      </Card.Content>
    </Card>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <IconButton icon="credit-card-off" size={64} iconColor={colors.neutral[300]} />
      <Text style={styles.emptyTitle}>No payment methods</Text>
      <Text style={styles.emptySubtitle}>
        Add a payment method to enable automatic billing
      </Text>
      <Button
        mode="contained"
        onPress={() => setAddDialogVisible(true)}
        style={styles.addButton}
      >
        Add Payment Method
      </Button>
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
        <Text style={styles.headerTitle}>Payment Methods</Text>
        <Button
          mode="contained"
          icon="plus"
          onPress={() => setAddDialogVisible(true)}
          compact
        >
          Add
        </Button>
      </View>

      {/* Info Card */}
      <Card style={styles.infoCard}>
        <Card.Content style={styles.infoContent}>
          <IconButton icon="shield-check" size={24} iconColor={colors.success} />
          <Text style={styles.infoText}>
            Your payment information is securely encrypted and stored with Stripe
          </Text>
        </Card.Content>
      </Card>

      {/* Payment Methods List */}
      <FlatList
        data={methods}
        renderItem={renderPaymentMethod}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyList}
      />

      {/* Add Payment Method Dialog */}
      <Portal>
        <Dialog visible={addDialogVisible} onDismiss={() => setAddDialogVisible(false)}>
          <Dialog.Title>Add Payment Method</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              Choose how you'd like to add a payment method:
            </Text>
            <View style={styles.dialogOptions}>
              <TouchableOpacity
                style={styles.dialogOption}
                onPress={() => {
                  setAddDialogVisible(false);
                  navigation.navigate('AddCard' as never);
                }}
              >
                <IconButton icon="credit-card" size={32} iconColor={colors.primary} />
                <Text style={styles.dialogOptionText}>Credit/Debit Card</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dialogOption}
                onPress={() => {
                  setAddDialogVisible(false);
                  navigation.navigate('AddBank' as never);
                }}
              >
                <IconButton icon="bank" size={32} iconColor={colors.primary} />
                <Text style={styles.dialogOptionText}>Bank Account</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dialogOption}
                onPress={() => {
                  setAddDialogVisible(false);
                  // Trigger Apple Pay setup
                }}
              >
                <IconButton icon="apple" size={32} iconColor={colors.foreground} />
                <Text style={styles.dialogOptionText}>Apple Pay</Text>
              </TouchableOpacity>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddDialogVisible(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  infoCard: {
    margin: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.success + '10',
    borderColor: colors.success + '30',
    borderWidth: 1,
  },
  infoContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[700],
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  methodCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  defaultCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  methodDetails: {
    flex: 1,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  methodBrand: {
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.semibold,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  defaultChip: {
    backgroundColor: colors.primary,
    height: 20,
  },
  defaultChipText: {
    fontSize: 10,
    color: colors.background,
    fontFamily: typography.fonts.medium,
  },
  methodLast4: {
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.medium,
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  methodExpiry: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
  methodNickname: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[600],
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  methodActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
  addButton: {
    marginTop: spacing.lg,
  },
  dialogText: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[600],
    marginBottom: spacing.lg,
  },
  dialogOptions: {
    gap: spacing.md,
  },
  dialogOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
  },
  dialogOptionText: {
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.medium,
    color: colors.foreground,
    marginLeft: spacing.sm,
  },
});
