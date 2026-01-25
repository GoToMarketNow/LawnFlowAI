
import { FullConfig } from '@playwright/test';
import { spawn } from 'child_process';

async function globalSetup(config: FullConfig) {
  const { webServer } = config;
  if (webServer) {
    const ws = Array.isArray(webServer) ? webServer[0] : webServer;
    if (ws.command) {
      const [command, ...args] = ws.command.split(' ');
      const serverProcess = spawn(command, args, {
        stdio: 'inherit',
        env: {
          ...process.env,
          PORT: (ws.port || 3000).toString(),
        },
      });
      serverProcess.on('error', (err) => {
        console.error('Failed to start server:', err);
      });
      process.env.SERVER_PID = serverProcess.pid?.toString();
    }
  }
}

export default globalSetup;
