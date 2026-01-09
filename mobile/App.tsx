import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './src/navigation/RootNavigator';
import { setupListeners, getFCMToken } from './src/services/notifications/firebase';
import { registerDevice } from './src/services/api/notifications';
import { useAuthStore } from './src/store/authStore';
import { useDeepLink } from './src/hooks/useDeepLink';

const queryClient = new QueryClient();

function AppContent() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  useDeepLink();

  useEffect(() => {
    setupListeners();

    if (isAuthenticated) {
      getFCMToken().then((token) => {
        if (token) {
          registerDevice(token).catch((err) =>
            console.error('Failed to register device:', err)
          );
        }
      });
    }
  }, [isAuthenticated]);

  return <RootNavigator />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
