import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getJobQAPhoto } from '../../services/api/jobs';

interface QAPhotoViewerProps {
  jobId: number;
}

export function QAPhotoViewer({ jobId }: QAPhotoViewerProps) {
  const [isExpired, setIsExpired] = useState(false);

  const { data: qaPhoto, isLoading, error } = useQuery({
    queryKey: ['qa-photo', jobId],
    queryFn: () => getJobQAPhoto(jobId),
    retry: false,
  });

  useEffect(() => {
    if (qaPhoto) {
      const expiresAt = new Date(qaPhoto.expiresAt);
      const now = new Date();

      if (expiresAt < now) {
        setIsExpired(true);
      } else {
        // Set timeout to mark as expired
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        const timeout = setTimeout(() => setIsExpired(true), timeUntilExpiry);
        return () => clearTimeout(timeout);
      }
    }
  }, [qaPhoto]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading photo...</Text>
      </View>
    );
  }

  if (error || !qaPhoto) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No QA photo available</Text>
      </View>
    );
  }

  if (isExpired) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Photo has expired (48 hours)</Text>
        <Text style={styles.subText}>Photos are available for 48 hours after service</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Quality Assurance Photo</Text>
      <View style={styles.photoContainer}>
        <Image
          source={{ uri: qaPhoto.url }}
          style={styles.photo}
          resizeMode="cover"
        />
      </View>
      <Text style={styles.expiryText}>
        Expires: {new Date(qaPhoto.expiresAt).toLocaleString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginVertical: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  photoContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  expiryText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    fontWeight: '600',
  },
  subText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
});
