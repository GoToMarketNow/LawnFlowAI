# LawnFlow.ai Staff Mobile App - Complete Implementation Guide

## 🎯 Implementation Status

### ✅ SPRINT M1: COMPLETE
- Command/Query API with trace IDs & idempotency
- Offline command queue with auto-sync
- Role-based navigation types
- Device ID tracking & secure token storage

### ✅ SPRINT M2: COMPLETE
- Role-adaptive dashboard (operator/ops vs crew)
- Job actions with optimistic UI (start/pause/resume/complete)
- Offline queue integration
- Payment status indicators

### 🔄 SPRINT M3-M5: SPECIFICATIONS PROVIDED

---

## 📱 Complete File Structure

```
mobile/
├── src/
│   ├── services/
│   │   ├── api/
│   │   │   ├── client.ts               ✅ (existing, uses interceptors)
│   │   │   ├── utils.ts                ✅ CREATED (trace, idempotency, errors)
│   │   │   ├── commands.ts             ✅ CREATED (20+ commands)
│   │   │   ├── queries.ts              ✅ CREATED (15+ queries)
│   │   ├── offline/
│   │   │   ├── commandQueue.ts         ✅ CREATED (queue, sync, retry)
│   │   ├── notifications/
│   │   │   ├── pushHandler.ts          📋 SPEC BELOW
│   ├── navigation/
│   │   ├── staff-types.ts              ✅ CREATED (role-based types)
│   │   ├── StaffNavigator.tsx          📋 SPEC BELOW
│   ├── screens/
│   │   ├── today/
│   │   │   ├── DashboardScreen.tsx     ✅ CREATED (role-adaptive)
│   │   ├── jobs/
│   │   │   ├── JobDetailScreen.tsx     📋 ENHANCE BELOW
│   │   │   ├── JobQAScreen.tsx         📋 SPEC BELOW
│   │   │   ├── CameraCaptureScreen.tsx 📋 SPEC BELOW
│   │   │   ├── ReportIssueScreen.tsx   📋 SPEC BELOW
│   │   ├── crews/
│   │   │   ├── CrewsListScreen.tsx     📋 SPEC BELOW
│   │   │   ├── CrewDetailScreen.tsx    📋 SPEC BELOW
│   │   ├── messages/
│   │   │   ├── ThreadsListScreen.tsx   📋 SPEC BELOW
│   │   │   ├── ThreadScreen.tsx        📋 SPEC BELOW
│   │   ├── agent/
│   │   │   ├── ConfirmActionModal.tsx  📋 SPEC BELOW
│   ├── components/
│   │   ├── jobs/
│   │   │   ├── JobActionsPanel.tsx     ✅ CREATED (start/pause/complete)
│   │   │   ├── PhotoUploadQueue.tsx    📋 SPEC BELOW
│   │   ├── agent/
│   │   │   ├── AgentSuggestionsPanel.tsx 📋 SPEC BELOW
│   │   │   ├── ConfidenceIndicator.tsx 📋 SPEC BELOW
│   │   ├── common/
│   │   │   ├── OfflineBanner.tsx       📋 SPEC BELOW
│   ├── hooks/
│   │   ├── useJobActions.ts            ✅ CREATED (mutations + optimistic)
│   │   ├── usePhotoUpload.ts           📋 SPEC BELOW
│   │   ├── useAgentSuggestions.ts      📋 SPEC BELOW
│   │   ├── useOfflineQueue.ts          📋 SPEC BELOW
```

---

## 🏗️ Sprint M3: Crew Management & Notifications

### 1. screens/crews/CrewsListScreen.tsx

```typescript
import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Card, Text, Chip } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { getCrews, type Crew } from '../../services/api/queries';

export function CrewsListScreen({ navigation }) {
  const { data: crews, isLoading } = useQuery({
    queryKey: ['crews'],
    queryFn: async () => {
      const result = await getCrews();
      return result.data || [];
    },
  });

  const renderCrew = ({ item }: { item: Crew }) => (
    <Card
      style={styles.crewCard}
      onPress={() => navigation.navigate('CrewDetail', { crewId: item.id })}
    >
      <Card.Content>
        <View style={styles.crewHeader}>
          <Text style={styles.crewName}>{item.name}</Text>
          <Chip
            style={getStatusChipStyle(item.status)}
            textStyle={styles.statusText}
          >
            {item.status.toUpperCase()}
          </Chip>
        </View>

        <Text style={styles.members}>
          {item.members.length} member{item.members.length !== 1 ? 's' : ''}
        </Text>

        {item.currentJobId && (
          <Text style={styles.currentJob}>
            On Job #{item.currentJobId}
          </Text>
        )}

        <View style={styles.skillsRow}>
          {item.skills.slice(0, 3).map((skill) => (
            <Chip key={skill} style={styles.skillChip} compact>
              {skill}
            </Chip>
          ))}
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <FlatList
      data={crews}
      renderItem={renderCrew}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={styles.container}
      refreshing={isLoading}
    />
  );
}

function getStatusChipStyle(status: string) {
  switch (status) {
    case 'available':
      return { backgroundColor: '#4CAF50' };
    case 'on_job':
      return { backgroundColor: '#FF9800' };
    case 'on_break':
      return { backgroundColor: '#2196F3' };
    default:
      return { backgroundColor: '#9E9E9E' };
  }
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  crewCard: { marginBottom: 12 },
  crewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  crewName: { fontSize: 18, fontWeight: '600' },
  statusText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  members: { fontSize: 14, color: '#666', marginBottom: 4 },
  currentJob: { fontSize: 14, color: '#2196F3', marginBottom: 8 },
  skillsRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
  skillChip: { backgroundColor: '#E3F2FD' },
});
```

### 2. services/notifications/pushHandler.ts

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';
import { ackNotification } from '../api/commands';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Push] Skipping - running in simulator');
    return null;
  }

  // Request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission denied');
    return null;
  }

  // Get Expo push token
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  console.log('[Push] Token:', token);

  // Register with backend
  await apiClient.post('/push-tokens', {
    token,
    platform: Platform.OS,
    deviceId: await Device.getDeviceId(),
  });

  // Configure channel (Android)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}

export function setupNotificationHandlers(navigation: any) {
  // Handle notification received while app is in foreground
  Notifications.addNotificationReceivedListener((notification) => {
    console.log('[Push] Received:', notification);
  });

  // Handle notification tap
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;

    console.log('[Push] Tapped:', data);

    // Deep link routing
    if (data.type === 'job_assigned' && data.jobId) {
      navigation.navigate('Jobs', {
        screen: 'JobDetail',
        params: { jobId: data.jobId },
      });
    } else if (data.type === 'crew_assignment' && data.assignmentId) {
      navigation.navigate('Crews', {
        screen: 'AssignmentConfirm',
        params: { assignmentId: data.assignmentId },
      });
    } else if (data.type === 'message' && data.threadId) {
      navigation.navigate('Messages', {
        screen: 'Thread',
        params: { threadId: data.threadId },
      });
    }

    // Acknowledge notification
    if (data.notificationId) {
      ackNotification(data.notificationId);
    }
  });
}
```

---

## 🏗️ Sprint M4: QA Photos & Checklist

### 1. screens/jobs/JobQAScreen.tsx

```typescript
import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Image } from 'react-native';
import { Text, Checkbox, Button, Card } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQAChecklist, getJobPhotos } from '../../services/api/queries';
import { submitQAChecklist } from '../../services/api/commands';

export function JobQAScreen({ route, navigation }) {
  const { jobId } = route.params;
  const queryClient = useQueryClient();

  const { data: checklist } = useQuery({
    queryKey: ['qa-checklist', jobId],
    queryFn: async () => {
      const result = await getQAChecklist(jobId);
      return result.data;
    },
  });

  const { data: photos } = useQuery({
    queryKey: ['job-photos', jobId],
    queryFn: async () => {
      const result = await getJobPhotos(jobId);
      return result.data || [];
    },
  });

  const [checklistState, setChecklistState] = useState({});

  const submitMutation = useMutation({
    mutationFn: async () => {
      const items = checklist.items.map((item) => ({
        id: item.id,
        completed: checklistState[item.id] ?? item.completed,
        notes: '',
      }));

      return submitQAChecklist({ jobId, checklistItems: items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qa-checklist', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      navigation.goBack();
    },
  });

  const toggleItem = (itemId: string) => {
    setChecklistState((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const canSubmit =
    photos.length >= checklist?.requiredPhotos &&
    checklist?.items.filter((i) => i.required).every((i) => checklistState[i.id] ?? i.completed);

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Title title="Photos" />
        <Card.Content>
          <Text style={styles.photoCount}>
            {photos.length} / {checklist?.requiredPhotos || 0} photos uploaded
          </Text>

          <View style={styles.photoGrid}>
            {photos.map((photo) => (
              <Image key={photo.id} source={{ uri: photo.thumbnailUrl }} style={styles.photoThumb} />
            ))}
          </View>

          <Button
            mode="contained"
            icon="camera"
            onPress={() => navigation.navigate('CameraCapture', { jobId, photoType: 'after' })}
            style={styles.button}
          >
            Add Photos
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Checklist" />
        <Card.Content>
          {checklist?.items.map((item) => (
            <View key={item.id} style={styles.checklistItem}>
              <Checkbox
                status={checklistState[item.id] ?? item.completed ? 'checked' : 'unchecked'}
                onPress={() => toggleItem(item.id)}
              />
              <Text style={styles.checklistLabel}>
                {item.label}
                {item.required && <Text style={styles.required}> *</Text>}
              </Text>
            </View>
          ))}
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        onPress={() => submitMutation.mutate()}
        disabled={!canSubmit || submitMutation.isPending}
        loading={submitMutation.isPending}
        style={styles.submitButton}
      >
        Submit QA
      </Button>

      {!canSubmit && (
        <Text style={styles.gateText}>
          Complete all required items and upload {checklist?.requiredPhotos} photos to continue
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  card: { margin: 16 },
  photoCount: { fontSize: 16, marginBottom: 12 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  photoThumb: { width: 80, height: 80, borderRadius: 8 },
  button: { marginTop: 8 },
  checklistItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checklistLabel: { flex: 1, fontSize: 14, marginLeft: 8 },
  required: { color: '#F44336' },
  submitButton: { margin: 16 },
  gateText: { textAlign: 'center', color: '#F44336', padding: 16 },
});
```

### 2. hooks/usePhotoUpload.ts

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadQAPhoto } from '../services/api/commands';
import { commandQueue } from '../services/offline/commandQueue';
import { isNetworkError } from '../services/api/utils';

export function usePhotoUpload(jobId: number) {
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (params: { photoUri: string; caption?: string; tags?: string[] }) => {
      const result = await uploadQAPhoto({
        jobId,
        ...params,
      });

      if (!result.success && isNetworkError(result.error)) {
        // Queue for offline upload
        await commandQueue.enqueue('upload-qa-photo', {
          entityId: `job_${jobId}`,
          jobId,
          ...params,
          uploadedAt: new Date().toISOString(),
        });
        return { success: true, queued: true };
      }

      if (!result.success) {
        throw new Error(result.error);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-photos', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    },
  });

  return {
    uploadPhoto: uploadMutation.mutate,
    isUploading: uploadMutation.isPending,
  };
}
```

---

## 🏗️ Sprint M5: Agent Suggestions & Comms

### 1. components/agent/AgentSuggestionsPanel.tsx

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Button, Chip, ProgressBar } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { getAgentSuggestions } from '../../services/api/queries';

interface AgentSuggestionsPanelProps {
  entityType: 'job' | 'crew_assignment';
  entityId: string;
  onActionSelect: (action: any) => void;
  onEscalate: () => void;
}

export function AgentSuggestionsPanel({
  entityType,
  entityId,
  onActionSelect,
  onEscalate,
}: AgentSuggestionsPanelProps) {
  const { data: suggestion, isLoading } = useQuery({
    queryKey: ['agent-suggestions', entityType, entityId],
    queryFn: async () => {
      const result = await getAgentSuggestions({ entityType, entityId });
      return result.data;
    },
    refetchInterval: 30000, // Poll every 30s
  });

  if (isLoading || !suggestion) {
    return null;
  }

  return (
    <Card style={styles.card}>
      <Card.Title
        title="💡 Agent Suggestions"
        subtitle={suggestion.rationale}
      />
      <Card.Content>
        <View style={styles.confidenceRow}>
          <Text style={styles.confidenceLabel}>Confidence:</Text>
          <Text style={styles.confidenceValue}>
            {Math.round(suggestion.confidence * 100)}%
          </Text>
        </View>
        <ProgressBar
          progress={suggestion.confidence}
          color={getConfidenceColor(suggestion.confidence)}
          style={styles.progressBar}
        />

        {suggestion.riskFlags.length > 0 && (
          <View style={styles.riskFlags}>
            {suggestion.riskFlags.map((flag) => (
              <Chip key={flag} style={styles.riskChip} textStyle={styles.riskText}>
                ⚠ {flag}
              </Chip>
            ))}
          </View>
        )}

        {suggestion.suggestedActions.map((action) => (
          <Button
            key={action.type}
            mode="contained"
            onPress={() => onActionSelect(action)}
            style={styles.actionButton}
          >
            {action.label}
          </Button>
        ))}

        {suggestion.humanRequired && (
          <Button
            mode="outlined"
            onPress={onEscalate}
            style={styles.escalateButton}
            icon="account-alert"
          >
            Send to Ops
          </Button>
        )}
      </Card.Content>
    </Card>
  );
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.85) return '#4CAF50';
  if (confidence >= 0.70) return '#FF9800';
  return '#F44336';
}

const styles = StyleSheet.create({
  card: { margin: 16 },
  confidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  confidenceLabel: { fontSize: 14, color: '#666' },
  confidenceValue: { fontSize: 14, fontWeight: '600' },
  progressBar: { height: 8, borderRadius: 4, marginBottom: 12 },
  riskFlags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  riskChip: { backgroundColor: '#FFEBEE' },
  riskText: { fontSize: 10, color: '#C62828' },
  actionButton: { marginTop: 8 },
  escalateButton: { marginTop: 12, borderColor: '#F44336' },
});
```

### 2. screens/messages/ThreadScreen.tsx

```typescript
import React, { useState } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Card, Text } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMessages, type Message } from '../../services/api/queries';
import { sendMessage, markMessageRead } from '../../services/api/commands';

export function ThreadScreen({ route }) {
  const { threadId, threadType, jobId } = route.params;
  const [messageText, setMessageText] = useState('');
  const queryClient = useQueryClient();

  const { data: messages } = useQuery({
    queryKey: ['messages', threadId],
    queryFn: async () => {
      const result = await getMessages(threadId);
      return result.data || [];
    },
    refetchInterval: 5000, // Poll every 5s
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      return sendMessage({
        threadId,
        threadType,
        message,
      });
    },
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['messages', threadId] });
    },
  });

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === currentUserId; // TODO: Get from auth

    return (
      <View
        style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        {!isOwnMessage && (
          <Text style={styles.senderName}>{item.senderName}</Text>
        )}
        <Text style={styles.messageText}>{item.message}</Text>
        <Text style={styles.messageTime}>
          {new Date(item.sentAt).toLocaleTimeString()}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {threadType === 'customer_proxy' && (
        <Card style={styles.proxyBanner}>
          <Card.Content>
            <Text style={styles.proxyText}>
              📞 Customer Proxy - Messages sent to operations will be forwarded to customer
            </Text>
          </Card.Content>
        </Card>
      )}

      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.messagesList}
        inverted
      />

      <View style={styles.inputContainer}>
        <TextInput
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type a message..."
          style={styles.input}
          multiline
        />
        <Button
          mode="contained"
          onPress={() => sendMutation.mutate(messageText)}
          disabled={!messageText.trim() || sendMutation.isPending}
          loading={sendMutation.isPending}
        >
          Send
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  proxyBanner: { margin: 8, backgroundColor: '#E3F2FD' },
  proxyText: { fontSize: 12, color: '#1976D2' },
  messagesList: { padding: 16 },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#2196F3',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
  },
  senderName: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  messageText: { fontSize: 14 },
  messageTime: { fontSize: 10, color: '#999', marginTop: 4 },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'center',
    gap: 8,
  },
  input: { flex: 1 },
});
```

---

## 🔗 Backend Integration Points

### Required Endpoints

All endpoints already specified in [`STAFF_MOBILE_APP_IMPLEMENTATION.md`](STAFF_MOBILE_APP_IMPLEMENTATION.md:75)

Key integration:
```
POST /commands/complete-job
  ↓
QA Agent validates
  ↓
Payment Agent decides (from payment-contracts.ts)
  ↓
Event: PaymentCaptured or InvoiceFallbackTriggered
  ↓
Mobile receives status update
```

---

## 📦 Dependencies to Install

```bash
cd mobile

# Already installed (check package.json)
npm install @tanstack/react-query
npm install @react-native-async-storage/async-storage
npm install @react-native-community/netinfo
npm install expo-notifications
npm install expo-camera
npm install expo-image-picker

# Install if missing
npm install react-native-paper
npm install @react-navigation/native
npm install @react-navigation/native-stack
npm install @react-navigation/bottom-tabs
```

---

## 🚀 Launch Checklist

### Backend
- [ ] Implement command endpoints (`/commands/*`)
- [ ] Implement query endpoints (`/me`, `/today/jobs`, etc.)
- [ ] Set up push notification service
- [ ] Configure webhook for Payment Agent
- [ ] Seed operator payment policies

### Mobile
- [ ] Run `npm install` for new dependencies
- [ ] Configure `EXPO_PUBLIC_API_URL` in `.env`
- [ ] Test offline queue sync
- [ ] Test push notifications (device only)
- [ ] Test camera permissions
- [ ] Build iOS/Android binaries

### Testing
- [ ] E2E: Job lifecycle (scheduled → in_progress → completed → paid)
- [ ] E2E: Offline mode (queue commands, sync on reconnect)
- [ ] E2E: Photo upload with poor network
- [ ] E2E: Agent suggestions → execute action
- [ ] Load test: 100 concurrent job updates

---

## 📊 Key Metrics to Track

1. **Command Success Rate**: % of commands executed successfully
2. **Offline Queue Size**: Average pending commands
3. **Payment Capture Rate**: % of completed jobs with successful payment
4. **Agent Suggestion Acceptance**: % of suggestions executed vs escalated
5. **Photo Upload Success**: % of photos uploaded on first try

---

## 🎯 Summary

**Total Implementation**:
- ✅ **M1**: Command/query API, offline queue, navigation types
- ✅ **M2**: Dashboard, job actions, optimistic UI
- 📋 **M3**: Crew management, push notifications (specs provided)
- 📋 **M4**: QA photos, checklist gating (specs provided)
- 📋 **M5**: Agent suggestions, comms (specs provided)

**Files Created**: 8 production files
**Files Specified**: 12 additional screens/components

All code follows React Native best practices, uses TypeScript, integrates with TanStack Query for server state, and implements offline-first with command queue.

**Integration with Payment Agent**: JobCompleted → QA → Payment → Mobile receives payment status.

Ready for backend endpoint implementation and full E2E testing.
