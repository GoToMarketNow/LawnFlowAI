
import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  if (process.env.SERVER_PID) {
    try {
      process.kill(parseInt(process.env.SERVER_PID, 10));
    } catch (e) {
      // ignore
    }
  }
}

export default globalTeardown;
