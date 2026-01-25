import { useMutation, useQueryClient } from '@tanstack/react-query';
import { startJob, pauseJob, resumeJob, completeJob, addJobNote } from '../services/api/commands';
import { commandQueue } from '../services/offline/commandQueue';
import { isNetworkError } from '../services/api/utils';
import { Alert } from 'react-native';

// ============================================
// Job Actions Hook - Optimistic Updates
// ============================================

interface JobActionOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function useJobActions(jobId: number, options?: JobActionOptions) {
  const queryClient = useQueryClient();

  // ============================================
  // Start Job
  // ============================================

  const startJobMutation = useMutation({
    mutationFn: async (startedAt?: string) => {
      const result = await startJob(jobId, startedAt);

      if (!result.success && isNetworkError(result.error)) {
        // Queue for offline sync
        await commandQueue.enqueue('start-job', {
          entityId: `job_${jobId}`,
          jobId,
          startedAt: startedAt || new Date().toISOString(),
        });
        return { success: true, queued: true };
      }

      if (!result.success) {
        throw new Error(result.error);
      }

      return result;
    },
    onMutate: async () => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['job', jobId] });

      const previousJob = queryClient.getQueryData(['job', jobId]);

      queryClient.setQueryData(['job', jobId], (old: any) => ({
        ...old,
        status: 'in_progress',
        actualStartISO: new Date().toISOString(),
      }));

      return { previousJob };
    },
    onError: (error: any, variables, context) => {
      // Rollback optimistic update
      if (context?.previousJob) {
        queryClient.setQueryData(['job', jobId], context.previousJob);
      }

      const errorMessage = error.message || 'Failed to start job';
      Alert.alert('Error', errorMessage);
      options?.onError?.(errorMessage);
    },
    onSuccess: (data) => {
      if (data.queued) {
        Alert.alert('Offline', 'Job start queued. Will sync when online.');
      }

      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['today-jobs'] });
      options?.onSuccess?.();
    },
  });

  // ============================================
  // Pause Job
  // ============================================

  const pauseJobMutation = useMutation({
    mutationFn: async (reason?: string) => {
      const result = await pauseJob(jobId, reason);

      if (!result.success && isNetworkError(result.error)) {
        await commandQueue.enqueue('pause-job', {
          entityId: `job_${jobId}`,
          jobId,
          reason,
          pausedAt: new Date().toISOString(),
        });
        return { success: true, queued: true };
      }

      if (!result.success) {
        throw new Error(result.error);
      }

      return result;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['job', jobId] });
      const previousJob = queryClient.getQueryData(['job', jobId]);

      queryClient.setQueryData(['job', jobId], (old: any) => ({
        ...old,
        status: 'paused',
      }));

      return { previousJob };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousJob) {
        queryClient.setQueryData(['job', jobId], context.previousJob);
      }
      Alert.alert('Error', error.message || 'Failed to pause job');
    },
    onSuccess: (data) => {
      if (data.queued) {
        Alert.alert('Offline', 'Job pause queued. Will sync when online.');
      }
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    },
  });

  // ============================================
  // Resume Job
  // ============================================

  const resumeJobMutation = useMutation({
    mutationFn: async () => {
      const result = await resumeJob(jobId);

      if (!result.success && isNetworkError(result.error)) {
        await commandQueue.enqueue('resume-job', {
          entityId: `job_${jobId}`,
          jobId,
          resumedAt: new Date().toISOString(),
        });
        return { success: true, queued: true };
      }

      if (!result.success) {
        throw new Error(result.error);
      }

      return result;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['job', jobId] });
      const previousJob = queryClient.getQueryData(['job', jobId]);

      queryClient.setQueryData(['job', jobId], (old: any) => ({
        ...old,
        status: 'in_progress',
      }));

      return { previousJob };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousJob) {
        queryClient.setQueryData(['job', jobId], context.previousJob);
      }
      Alert.alert('Error', error.message || 'Failed to resume job');
    },
    onSuccess: (data) => {
      if (data.queued) {
        Alert.alert('Offline', 'Job resume queued. Will sync when online.');
      }
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    },
  });

  // ============================================
  // Complete Job
  // ============================================

  const completeJobMutation = useMutation({
    mutationFn: async (params?: { notes?: string; photosUploaded?: number }) => {
      const result = await completeJob(jobId, {
        completedAt: new Date().toISOString(),
        notes: params?.notes,
        photosUploaded: params?.photosUploaded,
      });

      if (!result.success && isNetworkError(result.error)) {
        await commandQueue.enqueue('complete-job', {
          entityId: `job_${jobId}`,
          jobId,
          completedAt: new Date().toISOString(),
          notes: params?.notes,
          photosUploaded: params?.photosUploaded,
        });
        return { success: true, queued: true };
      }

      if (!result.success) {
        throw new Error(result.error);
      }

      return result;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['job', jobId] });
      const previousJob = queryClient.getQueryData(['job', jobId]);

      queryClient.setQueryData(['job', jobId], (old: any) => ({
        ...old,
        status: 'completed',
        actualEndISO: new Date().toISOString(),
      }));

      return { previousJob };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousJob) {
        queryClient.setQueryData(['job', jobId], context.previousJob);
      }
      Alert.alert('Error', error.message || 'Failed to complete job');
    },
    onSuccess: (data) => {
      if (data.queued) {
        Alert.alert('Offline', 'Job completion queued. Payment will process when online.');
      } else {
        Alert.alert('Success', 'Job completed! Payment is being processed.');
      }

      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['today-jobs'] });
      options?.onSuccess?.();
    },
  });

  // ============================================
  // Add Note
  // ============================================

  const addNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const result = await addJobNote(jobId, note);

      if (!result.success && isNetworkError(result.error)) {
        await commandQueue.enqueue('add-job-note', {
          entityId: `job_${jobId}`,
          jobId,
          note,
          noteType: 'general',
          timestamp: new Date().toISOString(),
        });
        return { success: true, queued: true };
      }

      if (!result.success) {
        throw new Error(result.error);
      }

      return result;
    },
    onSuccess: (data) => {
      if (data.queued) {
        Alert.alert('Offline', 'Note queued. Will sync when online.');
      }
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to add note');
    },
  });

  return {
    startJob: startJobMutation.mutate,
    pauseJob: pauseJobMutation.mutate,
    resumeJob: resumeJobMutation.mutate,
    completeJob: completeJobMutation.mutate,
    addNote: addNoteMutation.mutate,

    isStarting: startJobMutation.isPending,
    isPausing: pauseJobMutation.isPending,
    isResuming: resumeJobMutation.isPending,
    isCompleting: completeJobMutation.isPending,
    isAddingNote: addNoteMutation.isPending,

    isLoading:
      startJobMutation.isPending ||
      pauseJobMutation.isPending ||
      resumeJobMutation.isPending ||
      completeJobMutation.isPending,
  };
}
