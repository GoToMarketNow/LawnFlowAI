import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getJobById } from '../../services/api/jobs';
import { submitReview, getGoogleReviewLink } from '../../services/api/reviews';
import { analytics } from '../../services/analytics';

type ReviewPromptRouteProp = RouteProp<{ ReviewPrompt: { jobId: number } }, 'ReviewPrompt'>;

export function ReviewPromptScreen() {
  const route = useRoute<ReviewPromptRouteProp>();
  const navigation = useNavigation();
  const { jobId } = route.params;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const { data: job } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJobById(jobId),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitReview(jobId, { rating, comment }),
    onSuccess: async () => {
      analytics.track('review_submitted', { jobId, rating, hasComment: !!comment });

      if (rating >= 4 && job?.providerId) {
        // High rating - prompt Google review
        try {
          const { url } = await getGoogleReviewLink(job.providerId);
          analytics.track('google_review_clicked', { jobId, reviewUrl: url });

          Alert.alert(
            'Thank you!',
            'Would you mind sharing your experience on Google?',
            [
              { text: 'Not now', style: 'cancel', onPress: () => navigation.goBack() },
              {
                text: 'Share on Google',
                onPress: () => {
                  Linking.openURL(url);
                  navigation.goBack();
                },
              },
            ]
          );
        } catch (error) {
          Alert.alert('Thank you!', 'Your feedback has been submitted.');
          navigation.goBack();
        }
      } else {
        // Low rating - just thank them
        Alert.alert('Thank you!', 'Your feedback helps us improve our service.');
        navigation.goBack();
      }
    },
    onError: () => {
      Alert.alert('Error', 'Failed to submit review. Please try again.');
    },
  });

  const handleRatingPress = (value: number) => {
    setRating(value);
    setShowFeedback(value <= 3); // Show comment field for low ratings
  };

  const handleSubmit = () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting.');
      return;
    }

    if (rating <= 3 && !comment.trim()) {
      Alert.alert('Feedback Required', 'Please tell us what went wrong so we can improve.');
      return;
    }

    submitMutation.mutate();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>How was your service?</Text>
      {job && (
        <Text style={styles.subtitle}>
          {job.serviceType} at {job.propertyAddress}
        </Text>
      )}

      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((value) => (
          <TouchableOpacity
            key={value}
            onPress={() => handleRatingPress(value)}
            style={styles.starButton}
          >
            <Text style={[styles.star, rating >= value && styles.starFilled]}>
              {rating >= value ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {showFeedback && (
        <View style={styles.feedbackSection}>
          <Text style={styles.feedbackLabel}>
            We're sorry to hear that. What could we improve?
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="Tell us what went wrong..."
            multiline
            numberOfLines={4}
            value={comment}
            onChangeText={setComment}
            textAlignVertical="top"
          />
        </View>
      )}

      {rating >= 4 && (
        <View style={styles.feedbackSection}>
          <Text style={styles.feedbackLabel}>
            Any additional comments? (optional)
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="Share your experience..."
            multiline
            numberOfLines={4}
            value={comment}
            onChangeText={setComment}
            textAlignVertical="top"
          />
        </View>
      )}

      {rating > 0 && (
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={submitMutation.isLoading}
        >
          <Text style={styles.submitButtonText}>
            {submitMutation.isLoading ? 'Submitting...' : 'Submit Review'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
    gap: 12,
  },
  starButton: {
    padding: 8,
  },
  star: {
    fontSize: 48,
    color: '#D1D5DB',
  },
  starFilled: {
    color: '#FBBF24',
  },
  feedbackSection: {
    marginBottom: 24,
  },
  feedbackLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
