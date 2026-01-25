import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';
import NetInfo from '@react-native-community/netinfo';

// ============================================
// Offline Command Queue
// ============================================

const QUEUE_KEY = '@lawnflow/command_queue';
const MAX_QUEUE_SIZE = 100;
const SYNC_INTERVAL = 30000; // 30 seconds

export interface QueuedCommand {
  id: string;
  commandType: string;
  payload: Record<string, any>;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
}

class CommandQueue {
  private queue: QueuedCommand[] = [];
  private isOnline = true;
  private syncIntervalId: NodeJS.Timeout | null = null;

  async initialize() {
    await this.loadQueue();
    this.startNetworkMonitoring();
    this.startPeriodicSync();
  }

  private startNetworkMonitoring() {
    NetInfo.addEventListener((state) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      console.log(`[CommandQueue] Network ${this.isOnline ? 'online' : 'offline'}`);

      // Trigger sync when back online
      if (wasOffline && this.isOnline) {
        console.log('[CommandQueue] Back online, triggering sync');
        this.syncQueue();
      }
    });
  }

  private startPeriodicSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }

    this.syncIntervalId = setInterval(() => {
      if (this.isOnline && this.queue.length > 0) {
        this.syncQueue();
      }
    }, SYNC_INTERVAL);
  }

  async enqueue(commandType: string, payload: Record<string, any>): Promise<string> {
    const command: QueuedCommand = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      commandType,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    this.queue.push(command);
    await this.saveQueue();

    console.log(`[CommandQueue] Enqueued: ${commandType} (${command.id})`);

    // Try immediate sync if online
    if (this.isOnline) {
      this.syncQueue();
    }

    return command.id;
  }

  async syncQueue(): Promise<void> {
    if (!this.isOnline || this.queue.length === 0) {
      return;
    }

    console.log(`[CommandQueue] Syncing ${this.queue.length} commands`);

    const pendingCommands = this.queue.filter((cmd) => cmd.status === 'pending');

    for (const command of pendingCommands) {
      await this.syncCommand(command);
    }

    await this.saveQueue();
  }

  private async syncCommand(command: QueuedCommand): Promise<void> {
    try {
      command.status = 'syncing';

      console.log(`[CommandQueue] Syncing: ${command.commandType} (${command.id})`);

      const response = await apiClient.post(
        `/commands/${command.commandType}`,
        command.payload
      );

      // Success - remove from queue
      this.queue = this.queue.filter((cmd) => cmd.id !== command.id);

      console.log(`[CommandQueue] Synced successfully: ${command.id}`);
    } catch (error: any) {
      command.retryCount++;
      command.status = 'pending';

      if (command.retryCount >= 3) {
        command.status = 'failed';
        command.error = error.message || 'Max retries exceeded';
        console.error(`[CommandQueue] Failed permanently: ${command.id}`, command.error);
      } else {
        console.warn(`[CommandQueue] Sync failed, retry ${command.retryCount}/3: ${command.id}`);
      }
    }
  }

  async getQueue(): Promise<QueuedCommand[]> {
    return [...this.queue];
  }

  async getPendingCount(): Promise<number> {
    return this.queue.filter((cmd) => cmd.status === 'pending').length;
  }

  async clearFailed(): Promise<void> {
    this.queue = this.queue.filter((cmd) => cmd.status !== 'failed');
    await this.saveQueue();
  }

  async retryFailed(): Promise<void> {
    this.queue.forEach((cmd) => {
      if (cmd.status === 'failed') {
        cmd.status = 'pending';
        cmd.retryCount = 0;
      }
    });
    await this.saveQueue();
    await this.syncQueue();
  }

  private async loadQueue(): Promise<void> {
    try {
      const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
      if (queueJson) {
        this.queue = JSON.parse(queueJson);
        console.log(`[CommandQueue] Loaded ${this.queue.length} commands from storage`);
      }
    } catch (error) {
      console.error('[CommandQueue] Failed to load queue:', error);
      this.queue = [];
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      // Limit queue size
      if (this.queue.length > MAX_QUEUE_SIZE) {
        this.queue = this.queue.slice(-MAX_QUEUE_SIZE);
      }

      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[CommandQueue] Failed to save queue:', error);
    }
  }

  destroy() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }
  }
}

// Singleton instance
export const commandQueue = new CommandQueue();
