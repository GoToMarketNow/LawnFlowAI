# LawnFlow Customer Mobile App

React Native mobile app for LawnFlow.ai customers - Sprint 0 Foundation

## Sprint 0 — Foundations ✅

Implemented:
- ✅ Expo project setup with TypeScript
- ✅ Deep linking (invite token, job, review)
- ✅ Invite token auto-login with JWT
- ✅ Firebase Cloud Messaging scaffolding
- ✅ Notification permission handling
- ✅ NotificationCenter screen
- ✅ Account-level permission banner
- ✅ Analytics event tracking (7 events)
- ✅ Zustand state management
- ✅ React Query for API caching
- ✅ Secure token storage

## Quick Start

```bash
cd mobile
npm install

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web (dev)
npm run web
```

## Environment Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update `.env` with your API URL:
```
API_BASE_URL=http://localhost:3000
```

3. Add Firebase config files (required for push notifications):
   - iOS: Place `GoogleService-Info.plist` in `/mobile/`
   - Android: Place `google-services.json` in `/mobile/`

## Architecture

```
mobile/
├── App.tsx                              # Root component
├── app.config.js                        # Expo configuration
├── src/
│   ├── services/
│   │   ├── api/                         # API client + endpoints
│   │   ├── notifications/               # Firebase FCM
│   │   ├── storage/                     # SecureStore, AsyncStorage
│   │   └── analytics/                   # Event tracking
│   ├── screens/                         # Screen components
│   ├── components/                      # Reusable UI components
│   ├── navigation/                      # React Navigation setup
│   ├── store/                           # Zustand state management
│   └── hooks/                           # Custom React hooks
```

## Deep Links

Test deep links locally:

```bash
# Invite token
npx uri-scheme open lawnflow://invite/abc123 --ios
adb shell am start -W -a android.intent.action.VIEW -d "lawnflow://invite/abc123"

# Job detail
npx uri-scheme open lawnflow://job/456 --ios

# Review prompt
npx uri-scheme open lawnflow://review/789 --ios
```

## Backend Requirements

Sprint 0 requires these NEW backend endpoints:

### Auth
- `POST /api/auth/invite/exchange`
  - Request: `{ token: string }`
  - Response: `{ token: string (JWT), user: { id, email, phoneE164, businessId } }`

### Notifications
- `GET /api/notifications`
  - Response: `[{ id, type, createdAt, read, refId, title, body, meta }]`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/device`
  - Request: `{ fcmToken: string, platform: "ios" | "android" }`

Backend must add **JWT support** (currently session-based).

## Analytics Events

Tracked events (console-only for Sprint 0):
- `invite_link_opened`
- `invite_exchange_attempt`
- `invite_exchange_success`
- `invite_exchange_fail`
- `reminder_opened`
- `review_prompt_opened`
- `review_submitted`
- `google_review_clicked`
- `notification_received_foreground`
- `notification_opened`
- `notification_opened_from_quit`

## Testing

### Manual Test Checklist

- [ ] Open invite link → auto-login → Home screen
- [ ] Notification permission banner shows when denied
- [ ] Tap "Enable" → iOS permission prompt
- [ ] FCM token registered after login
- [ ] Deep link navigation works
- [ ] Analytics events logged to console
- [ ] Token persists across app restarts

### Unit Tests (TODO)

```bash
npm test
```

## Known Limitations

Sprint 0 focuses on infrastructure. Missing features:
- Backend JWT endpoints not implemented
- No actual analytics backend (events logged to console)
- No offline support
- No error boundaries
- No biometric auth
- Placeholder Firebase config

## Next: Sprint 1

Sprint 1 will add:
- Invite landing screen (app not installed → store badges)
- Dashboard reminder banners with Acknowledge action
- Jobs list with upcoming/completed status
- Notification urgency badges
- Onboarding reminder flow (7d, 3d, day-of)

## Troubleshooting

### "Cannot find module" errors
```bash
cd mobile && npm install
```

### Firebase not configured
Add `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) to `/mobile/`

### Deep links not working
Rebuild the app after adding `scheme: "lawnflow"` to app.config.js

## Tech Stack

- Expo SDK 51
- React Navigation 6
- Zustand (state)
- React Query (API caching)
- Axios (HTTP client)
- Firebase Cloud Messaging
- expo-secure-store (secure storage)
- TypeScript
