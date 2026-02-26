# FirebaseChat

A real-time chat application built with React Native, Expo, and Firebase Cloud Firestore.
Developed as a school project to demonstrate real-time data synchronisation, anonymous authentication, and mobile UI patterns.

---

## Features

- **Real-time messaging** messages are pushed instantly via Firestore's `onSnapshot` listener, no polling
- **Anonymous authentication** users are signed in automatically without a login flow; identity persists across sessions via AsyncStorage
- **Display names** users choose a display name on first launch, stored in Firestore and shown on all messages
- **Delivery indicators** single tick when a message is written to the local Firestore cache, double tick once the server confirms
- **WhatsApp-inspired UI** green/white chat bubbles, inline timestamps, date separator labels ("Today" or full date), and a pill-shaped input bar
- **Character limit** 500 character limit with a live counter appearing at 50 characters remaining
- **Empty state** friendly prompt shown when no messages exist yet
- **Keyboard avoidance** input stays above the keyboard on both iOS and Android
- **Bandwidth optimisations** query limited to 50 most recent messages, listener paused when app is backgrounded, Firestore local cache used for offline support

---

## Technologies Used

| Technology | Purpose |
|---|---|
| [React Native](https://reactnative.dev/) | Cross-platform mobile UI framework |
| [Expo](https://expo.dev/) | Development toolchain and runtime |
| [Firebase Authentication](https://firebase.google.com/products/auth) | Anonymous user identity |
| [Cloud Firestore](https://firebase.google.com/products/firestore) | Real-time NoSQL database |
| [@react-native-async-storage/async-storage](https://github.com/react-native-async-storage/async-storage) | Persisting Firebase auth state across sessions |
| TypeScript | Static typing throughout the project |

---

## Project Structure

```
FirebaseChat/
├── App.tsx                  # Root component auth boot sequence, chat UI
├── firebase/
│   ├── Config.ts            # Firebase app initialisation, auth + Firestore instances
│   ├── AuthRepository.ts    # Anonymous sign-in and auth state subscription
│   ├── MessageRepository.ts # Firestore message listener and write logic
│   └── UserRepository.ts    # Display name read/write backed by users/{uid}
├── .env                     # Firebase config keys (not committed)
├── .env.example             # Template for required environment variables
└── firestore.rules          # Firestore security rules
```

### Architecture

The project follows the **Repository Pattern** all Firebase/Firestore logic is isolated in the `firebase/` layer. `App.tsx` contains only UI and state, and imports named functions from the repositories without any direct Firebase SDK calls.

```
App.tsx
  ├── AuthRepository    →  signInAnon(), subscribeToAuthState()
  ├── MessageRepository →  subscribeToMessages(), sendMessage()
  └── UserRepository    →  loadDisplayName(), saveDisplayName()
```

The app boots in three sequential steps:

1. `subscribeToAuthState` waits for Firebase to restore or create an anonymous session
2. `loadDisplayName` checks Firestore for an existing display name; shows the username modal if none exists
3. `subscribeToMessages` opens the real-time Firestore listener once identity is confirmed

Optimistic UI is handled natively via `doc.metadata.hasPendingWrites` Firestore writes to its local cache immediately on send and fires `onSnapshot` twice: once with `hasPendingWrites: true` (single tick) and again after server confirmation (double tick). No manual optimistic state is maintained.

---

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- A Firebase project with **Firestore** and **Anonymous Authentication** enabled

### 1. Clone the repository

```bash
git clone https://github.com/your-username/FirebaseChat.git
cd FirebaseChat
```

### 2. Install dependencies

```bash
npm install
npx expo install @react-native-async-storage/async-storage
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your Firebase project credentials:

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. Apply Firestore security rules

In the [Firebase Console](https://console.firebase.google.com/) → Firestore Database → Rules, paste the contents of `firestore.rules` and click **Publish**.

### 5. Run the app

```bash
npx expo start
```

Scan the QR code with [Expo Go](https://expo.dev/go) on your device, or press `a` for Android emulator / `i` for iOS simulator.

---

## Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /messages/{messageId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
                    && request.resource.data.text is string
                    && request.resource.data.text.size() > 0
                    && request.resource.data.text.size() <= 500
                    && request.resource.data.senderId == request.auth.uid;
    }

    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }

  }
}
```

---

## Known Limitations

- **No message editing or deletion** messages are immutable once sent, which is intentional for simplicity but limits functionality
- **No read receipts** the double tick confirms delivery to Firestore, not that the recipient has seen the message
- **Anonymous identity only** there is no way to link an account to an email or social login; clearing app data permanently loses the user's identity and their messages appear as sent by a different user
- **50 message limit** only the 50 most recent messages are loaded; there is no pagination or infinite scroll for older history
- **Single chat room** all users share one global conversation; there are no private or group channels
- **Display name is permanent** once set, the display name cannot be changed from within the app

---

## License

This project was created for educational purposes.
