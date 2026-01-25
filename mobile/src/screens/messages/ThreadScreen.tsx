import React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Text, Avatar, IconButton, ActivityIndicator, Menu } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getMessages, type Message } from '../../services/api/queries';
import { sendMessage, markMessageRead } from '../../services/api/commands';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme/tokens';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { secureStorage } from '../../services/storage/secureStorage';

// ============================================
// Thread/Conversation Screen
// ============================================

interface RouteParams {
  threadId: string;
  threadName: string;
}

export function ThreadScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { threadId, threadName } = route.params as RouteParams;

  const [messageText, setMessageText] = React.useState('');
  const [currentUserId, setCurrentUserId] = React.useState<number | null>(null);
  const [menuVisible, setMenuVisible] = React.useState(false);
  const flatListRef = React.useRef<FlatList>(null);

  React.useEffect(() => {
    navigation.setOptions({ title: threadName });
    loadCurrentUser();
  }, [threadName]);

  const loadCurrentUser = async () => {
    const userJson = await secureStorage.getItem('user');
    if (userJson) {
      const user = JSON.parse(userJson);
      setCurrentUserId(user.id);
    }
  };

  const { data: messages, isLoading, refetch } = useQuery({
    queryKey: ['messages', threadId],
    queryFn: async () => {
      const result = await getMessages(threadId, { limit: 50 });
      return result.data || [];
    },
    refetchInterval: 10000, // Poll every 10 seconds
  });

  // Mark messages as read when viewing
  React.useEffect(() => {
    if (messages && messages.length > 0) {
      const unreadMessages = messages.filter(
        (m: Message) => !m.readAt && m.senderId !== currentUserId
      );
      unreadMessages.forEach((m: Message) => {
        markMessageRead(m.id, threadId);
      });
    }
  }, [messages, currentUserId]);

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      return sendMessage({
        threadId,
        threadType: 'crew', // Default to crew, could be passed as param
        message: text,
      });
    },
    onSuccess: () => {
      setMessageText('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    },
  });

  const handleSend = () => {
    if (!messageText.trim()) return;
    sendMutation.mutate(messageText.trim());
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';

    messages.forEach((message) => {
      const messageDate = new Date(message.sentAt);
      const dateKey = format(messageDate, 'yyyy-MM-dd');

      if (dateKey !== currentDate) {
        currentDate = dateKey;
        groups.push({ date: dateKey, messages: [message] });
      } else {
        groups[groups.length - 1].messages.push(message);
      }
    });

    return groups;
  };

  const renderDateSeparator = (date: string) => {
    const dateObj = new Date(date);
    let label: string;

    if (isToday(dateObj)) {
      label = 'Today';
    } else if (isYesterday(dateObj)) {
      label = 'Yesterday';
    } else {
      label = format(dateObj, 'MMMM d, yyyy');
    }

    return (
      <View style={styles.dateSeparator}>
        <View style={styles.dateLine} />
        <Text style={styles.dateLabel}>{label}</Text>
        <View style={styles.dateLine} />
      </View>
    );
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwnMessage = item.senderId === currentUserId;
    const showAvatar =
      !isOwnMessage &&
      (index === 0 || messages![index - 1]?.senderId !== item.senderId);
    const showName = showAvatar;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {!isOwnMessage && (
          <View style={styles.avatarSpace}>
            {showAvatar && (
              <Avatar.Text
                size={32}
                label={getInitials(item.senderName)}
                style={{ backgroundColor: getRoleColor(item.senderRole) }}
              />
            )}
          </View>
        )}

        <View style={styles.messageBubbleContainer}>
          {showName && !isOwnMessage && (
            <Text style={styles.senderName}>{item.senderName}</Text>
          )}

          <View
            style={[
              styles.messageBubble,
              isOwnMessage ? styles.ownBubble : styles.otherBubble,
              item.isSystemMessage && styles.systemBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
                item.isSystemMessage && styles.systemMessageText,
              ]}
            >
              {item.message}
            </Text>
          </View>

          <Text
            style={[
              styles.timestamp,
              isOwnMessage ? styles.ownTimestamp : styles.otherTimestamp,
            ]}
          >
            {format(new Date(item.sentAt), 'h:mm a')}
            {isOwnMessage && item.readAt && ' • Read'}
          </Text>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (!messages || messages.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySubtitle}>
            Send a message to start the conversation
          </Text>
        </View>
      );
    }

    // Group messages by date and flatten for FlatList
    const groupedMessages = groupMessagesByDate(messages);
    const flatData: (Message | { type: 'date'; date: string })[] = [];

    groupedMessages.forEach((group) => {
      flatData.push({ type: 'date', date: group.date });
      flatData.push(...group.messages);
    });

    return (
      <FlatList
        ref={flatListRef}
        data={flatData}
        renderItem={({ item, index }) => {
          if ('type' in item && item.type === 'date') {
            return renderDateSeparator(item.date);
          }
          return renderMessage({ item: item as Message, index });
        }}
        keyExtractor={(item, index) =>
          'type' in item ? `date-${item.date}` : `msg-${(item as Message).id}`
        }
        contentContainerStyle={styles.messagesList}
        inverted={false}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: false })
        }
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header Actions */}
      <View style={styles.headerActions}>
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
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              // Navigate to thread info/settings
            }}
            title="Thread Info"
            leadingIcon="information"
          />
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              // Mute notifications
            }}
            title="Mute Notifications"
            leadingIcon="bell-off"
          />
        </Menu>
      </View>

      {/* Messages */}
      {renderContent()}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.neutral[400]}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!messageText.trim() || sendMutation.isPending) &&
                styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!messageText.trim() || sendMutation.isPending}
          >
            <IconButton
              icon="send"
              iconColor={
                messageText.trim() && !sendMutation.isPending
                  ? colors.background
                  : colors.neutral[400]
              }
              size={20}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
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

function getRoleColor(role: string): string {
  switch (role) {
    case 'operator':
    case 'owner':
      return colors.roles.owner;
    case 'ops':
      return colors.roles.owner;
    case 'crew_leader':
      return colors.roles.crewLeader;
    case 'crew_member':
      return colors.roles.crewMember;
    default:
      return colors.neutral[500];
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
  headerActions: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
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
  },
  messagesList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.neutral[200],
  },
  dateLabel: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.medium,
    color: colors.neutral[500],
    paddingHorizontal: spacing.md,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatarSpace: {
    width: 40,
    marginRight: spacing.sm,
    justifyContent: 'flex-end',
  },
  messageBubbleContainer: {
    maxWidth: '75%',
  },
  senderName: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.medium,
    color: colors.neutral[600],
    marginBottom: spacing.xs,
    marginLeft: spacing.sm,
  },
  messageBubble: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  ownBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: borderRadius.sm,
  },
  otherBubble: {
    backgroundColor: colors.neutral[100],
    borderBottomLeftRadius: borderRadius.sm,
  },
  systemBubble: {
    backgroundColor: colors.neutral[50],
    borderColor: colors.neutral[200],
    borderWidth: 1,
    alignSelf: 'center',
  },
  messageText: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    lineHeight: typography.lineHeights.sm,
  },
  ownMessageText: {
    color: colors.background,
  },
  otherMessageText: {
    color: colors.foreground,
  },
  systemMessageText: {
    color: colors.neutral[600],
    fontStyle: 'italic',
  },
  timestamp: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[400],
    marginTop: spacing.xs,
  },
  ownTimestamp: {
    textAlign: 'right',
    marginRight: spacing.sm,
  },
  otherTimestamp: {
    textAlign: 'left',
    marginLeft: spacing.sm,
  },
  inputContainer: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.xl,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  textInput: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.regular,
    color: colors.foreground,
    maxHeight: 100,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    marginLeft: spacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: colors.neutral[200],
  },
});
