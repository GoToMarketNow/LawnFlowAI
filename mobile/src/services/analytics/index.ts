import type { EventName } from './events';

interface AnalyticsEvent {
  event: EventName;
  props: Record<string, any>;
  timestamp: Date;
}

class AnalyticsService {
  private queue: AnalyticsEvent[] = [];

  track(event: EventName, props?: Record<string, any>) {
    const entry: AnalyticsEvent = {
      event,
      props: props || {},
      timestamp: new Date(),
    };

    this.queue.push(entry);
    console.log('[Analytics]', event, props);

    if (this.queue.length >= 10) {
      this.flush();
    }
  }

  async flush() {
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    // TODO: Send to backend /api/analytics/events
    console.log('[Analytics] Flushing', batch.length, 'events');
  }

  identify(userId: string, traits?: Record<string, any>) {
    console.log('[Analytics] Identify:', userId, traits);
  }

  reset() {
    this.queue = [];
  }
}

export const analytics = new AnalyticsService();
