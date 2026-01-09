import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { analytics } from '../services/analytics';

export function useDeepLink() {
  useEffect(() => {
    // Handle initial URL (app opened from link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Handle subsequent URLs (app already open)
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);
}

function handleDeepLink(url: string) {
  const { path, queryParams } = Linking.parse(url);

  console.log('[DeepLink]', { url, path, queryParams });

  if (path?.startsWith('invite/')) {
    analytics.track('invite_link_opened', { url, path });
  } else if (path?.startsWith('review/')) {
    analytics.track('review_prompt_opened', { url, path });
  } else if (path?.startsWith('job/')) {
    console.log('[DeepLink] Job detail opened', path);
  }
}
