import { create } from 'zustand';
import type { Job } from '../services/api/types';

interface JobState {
  jobs: Job[];
  upcomingJobs: Job[];
  completedJobs: Job[];
  pendingReminders: Job[];
  setJobs: (jobs: Job[]) => void;
  addJob: (job: Job) => void;
  updateJob: (id: number, updates: Partial<Job>) => void;
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  upcomingJobs: [],
  completedJobs: [],
  pendingReminders: [],

  setJobs: (jobs) => {
    const upcomingJobs = jobs.filter((j) => j.status === 'upcoming');
    const completedJobs = jobs.filter((j) => j.status === 'completed');
    const pendingReminders = jobs.filter((j) => j.hasReminder && j.status === 'upcoming');

    set({ jobs, upcomingJobs, completedJobs, pendingReminders });
  },

  addJob: (job) => {
    const jobs = [...get().jobs, job];
    get().setJobs(jobs);
  },

  updateJob: (id, updates) => {
    const jobs = get().jobs.map((j) => (j.id === id ? { ...j, ...updates } : j));
    get().setJobs(jobs);
  },
}));
