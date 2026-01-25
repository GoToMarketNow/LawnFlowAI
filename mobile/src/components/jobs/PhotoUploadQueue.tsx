import React from 'react';
import {
  View,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  IconButton,
  ProgressBar,
  Card,
  Button,
  ActivityIndicator,
} from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme/tokens';
import { uploadQAPhoto } from '../../services/api/commands';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================
// Photo Upload Queue - Offline-First QA Photos
// ============================================

interface QueuedPhoto {
  id: string;
  jobId: number;
  uri: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  progress: number;
  retryCount: number;
  timestamp: number;
  caption?: string;
}

interface PhotoUploadQueueProps {
  jobId: number;
  requiredPhotos: number;
  uploadedPhotos: number;
  onUploadComplete?: () => void;
}

const QUEUE_STORAGE_KEY = 'photo_upload_queue';
const MAX_RETRIES = 3;

export function PhotoUploadQueue({
  jobId,
  requiredPhotos,
  uploadedPhotos,
  onUploadComplete,
}: PhotoUploadQueueProps) {
  const queryClient = useQueryClient();
  const [queue, setQueue] = React.useState<QueuedPhoto[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Load queue from storage on mount
  React.useEffect(() => {
    loadQueue();
  }, []);

  // Process queue when photos are added
  React.useEffect(() => {
    const pendingPhotos = queue.filter((p) => p.status === 'pending');
    if (pendingPhotos.length > 0 && !isProcessing) {
      processQueue();
    }
  }, [queue]);

  const loadQueue = async () => {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        const allPhotos: QueuedPhoto[] = JSON.parse(stored);
        // Filter to only this job's photos
        const jobPhotos = allPhotos.filter((p) => p.jobId === jobId);
        setQueue(jobPhotos);
      }
    } catch (error) {
      console.error('[PhotoQueue] Failed to load queue:', error);
    }
  };

  const saveQueue = async (photos: QueuedPhoto[]) => {
    try {
      // Load all photos, update this job's photos, save back
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      const allPhotos: QueuedPhoto[] = stored ? JSON.parse(stored) : [];
      const otherJobPhotos = allPhotos.filter((p) => p.jobId !== jobId);
      const updated = [...otherJobPhotos, ...photos];
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('[PhotoQueue] Failed to save queue:', error);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async (photo: QueuedPhoto) => {
      return uploadQAPhoto({
        jobId: photo.jobId,
        photoUri: photo.uri,
        caption: photo.caption,
      });
    },
    onSuccess: (_, photo) => {
      updatePhotoStatus(photo.id, 'uploaded', 100);
      queryClient.invalidateQueries({ queryKey: ['job-photos', jobId] });
      onUploadComplete?.();
    },
    onError: (_, photo) => {
      const currentPhoto = queue.find((p) => p.id === photo.id);
      if (currentPhoto && currentPhoto.retryCount < MAX_RETRIES) {
        updatePhotoStatus(photo.id, 'pending', 0, currentPhoto.retryCount + 1);
      } else {
        updatePhotoStatus(photo.id, 'failed', 0);
      }
    },
  });

  const processQueue = async () => {
    setIsProcessing(true);

    const pendingPhotos = queue.filter((p) => p.status === 'pending');

    for (const photo of pendingPhotos) {
      updatePhotoStatus(photo.id, 'uploading', 0);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setQueue((prev) =>
          prev.map((p) =>
            p.id === photo.id && p.status === 'uploading'
              ? { ...p, progress: Math.min(p.progress + 20, 90) }
              : p
          )
        );
      }, 200);

      try {
        await uploadMutation.mutateAsync(photo);
      } finally {
        clearInterval(progressInterval);
      }
    }

    setIsProcessing(false);
  };

  const updatePhotoStatus = (
    id: string,
    status: QueuedPhoto['status'],
    progress: number,
    retryCount?: number
  ) => {
    setQueue((prev) => {
      const updated = prev.map((p) =>
        p.id === id
          ? { ...p, status, progress, retryCount: retryCount ?? p.retryCount }
          : p
      );
      saveQueue(updated);
      return updated;
    });
  };

  const addPhotos = async (uris: string[]) => {
    const newPhotos: QueuedPhoto[] = uris.map((uri) => ({
      id: `${jobId}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      jobId,
      uri,
      status: 'pending',
      progress: 0,
      retryCount: 0,
      timestamp: Date.now(),
    }));

    setQueue((prev) => {
      const updated = [...prev, ...newPhotos];
      saveQueue(updated);
      return updated;
    });
  };

  const removePhoto = (id: string) => {
    setQueue((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      saveQueue(updated);
      return updated;
    });
  };

  const retryPhoto = (id: string) => {
    updatePhotoStatus(id, 'pending', 0);
  };

  const retryAllFailed = () => {
    setQueue((prev) => {
      const updated = prev.map((p) =>
        p.status === 'failed' ? { ...p, status: 'pending' as const, progress: 0 } : p
      );
      saveQueue(updated);
      return updated;
    });
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      addPhotos(result.assets.map((a) => a.uri));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      addPhotos([result.assets[0].uri]);
    }
  };

  const totalInQueue = queue.length;
  const uploadedInQueue = queue.filter((p) => p.status === 'uploaded').length;
  const failedInQueue = queue.filter((p) => p.status === 'failed').length;
  const totalUploaded = uploadedPhotos + uploadedInQueue;
  const progress = requiredPhotos > 0 ? totalUploaded / requiredPhotos : 0;

  const getStatusIcon = (status: QueuedPhoto['status']) => {
    switch (status) {
      case 'uploaded':
        return 'check-circle';
      case 'uploading':
        return 'cloud-upload';
      case 'failed':
        return 'alert-circle';
      default:
        return 'clock-outline';
    }
  };

  const getStatusColor = (status: QueuedPhoto['status']) => {
    switch (status) {
      case 'uploaded':
        return colors.success;
      case 'uploading':
        return colors.info;
      case 'failed':
        return colors.error;
      default:
        return colors.neutral[400];
    }
  };

  const renderPhoto = ({ item }: { item: QueuedPhoto }) => (
    <View style={styles.photoItem}>
      <Image source={{ uri: item.uri }} style={styles.photoThumbnail} />

      <View style={styles.photoOverlay}>
        {item.status === 'uploading' && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="small" color={colors.background} />
            <Text style={styles.progressText}>{Math.round(item.progress)}%</Text>
          </View>
        )}

        {item.status === 'uploaded' && (
          <View style={[styles.statusBadge, { backgroundColor: colors.success }]}>
            <IconButton icon="check" size={16} iconColor={colors.background} />
          </View>
        )}

        {item.status === 'failed' && (
          <TouchableOpacity
            style={[styles.statusBadge, { backgroundColor: colors.error }]}
            onPress={() => retryPhoto(item.id)}
          >
            <IconButton icon="refresh" size={16} iconColor={colors.background} />
          </TouchableOpacity>
        )}

        {item.status === 'pending' && (
          <View style={[styles.statusBadge, { backgroundColor: colors.neutral[500] }]}>
            <IconButton icon="clock" size={16} iconColor={colors.background} />
          </View>
        )}
      </View>

      {(item.status === 'pending' || item.status === 'failed') && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removePhoto(item.id)}
        >
          <IconButton icon="close" size={14} iconColor={colors.background} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <Card style={styles.container}>
      <Card.Content>
        {/* Header with Progress */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>QA Photos</Text>
            <Text style={styles.subtitle}>
              {totalUploaded} of {requiredPhotos} required photos
            </Text>
          </View>
          {failedInQueue > 0 && (
            <Button mode="text" compact onPress={retryAllFailed}>
              Retry Failed
            </Button>
          )}
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <ProgressBar
            progress={Math.min(progress, 1)}
            color={progress >= 1 ? colors.success : colors.primary}
            style={styles.progressBar}
          />
          {progress >= 1 && (
            <Text style={styles.completeText}>✓ All required photos uploaded</Text>
          )}
        </View>

        {/* Photo Grid */}
        {queue.length > 0 && (
          <FlatList
            data={queue}
            renderItem={renderPhoto}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoList}
          />
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            mode="contained"
            icon="camera"
            onPress={takePhoto}
            style={styles.actionButton}
          >
            Take Photo
          </Button>
          <Button
            mode="outlined"
            icon="image-multiple"
            onPress={pickImages}
            style={styles.actionButton}
          >
            Choose Photos
          </Button>
        </View>

        {/* Queue Status */}
        {totalInQueue > 0 && (
          <View style={styles.queueStatus}>
            <View style={styles.queueStatusItem}>
              <View style={[styles.statusDot, { backgroundColor: colors.neutral[400] }]} />
              <Text style={styles.queueStatusText}>
                {queue.filter((p) => p.status === 'pending').length} pending
              </Text>
            </View>
            <View style={styles.queueStatusItem}>
              <View style={[styles.statusDot, { backgroundColor: colors.info }]} />
              <Text style={styles.queueStatusText}>
                {queue.filter((p) => p.status === 'uploading').length} uploading
              </Text>
            </View>
            <View style={styles.queueStatusItem}>
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
              <Text style={styles.queueStatusText}>{uploadedInQueue} uploaded</Text>
            </View>
            {failedInQueue > 0 && (
              <View style={styles.queueStatusItem}>
                <View style={[styles.statusDot, { backgroundColor: colors.error }]} />
                <Text style={[styles.queueStatusText, { color: colors.error }]}>
                  {failedInQueue} failed
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Offline Notice */}
        <View style={styles.offlineNotice}>
          <IconButton icon="cloud-sync" size={16} iconColor={colors.neutral[500]} />
          <Text style={styles.offlineText}>
            Photos are queued locally and will sync when online
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.semibold,
    color: colors.foreground,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
  progressContainer: {
    marginBottom: spacing.md,
  },
  progressBar: {
    height: 8,
    borderRadius: borderRadius.full,
  },
  completeText: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.medium,
    color: colors.success,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  photoList: {
    paddingVertical: spacing.sm,
  },
  photoItem: {
    position: 'relative',
    marginRight: spacing.sm,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.xs,
    alignItems: 'center',
  },
  uploadingOverlay: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
    alignItems: 'center',
    width: '100%',
  },
  progressText: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.medium,
    color: colors.background,
    marginTop: spacing.xs,
  },
  statusBadge: {
    borderRadius: borderRadius.full,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: borderRadius.full,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  queueStatus: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  queueStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  queueStatusText: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[600],
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.neutral[50],
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  offlineText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    fontFamily: typography.fonts.regular,
    color: colors.neutral[500],
  },
});
