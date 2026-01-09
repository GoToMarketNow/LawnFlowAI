import { useState, useEffect } from 'react';
import { checkPermission, requestNotificationPermission } from '../services/notifications/permissions';

export function useNotificationPermission() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkNotificationPermission();
  }, []);

  async function checkNotificationPermission() {
    try {
      const granted = await checkPermission();
      setHasPermission(granted);
    } catch (error) {
      console.error('Failed to check permission:', error);
      setHasPermission(false);
    } finally {
      setIsChecking(false);
    }
  }

  async function requestPermission() {
    try {
      const granted = await requestNotificationPermission();
      setHasPermission(granted);
      return granted;
    } catch (error) {
      console.error('Failed to request permission:', error);
      setHasPermission(false);
      return false;
    }
  }

  return { hasPermission, isChecking, requestPermission, checkPermission: checkNotificationPermission };
}
