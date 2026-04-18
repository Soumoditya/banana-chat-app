# 🍌 Banana Chat

A feature-rich social platform for Android — real-time messaging, stories, posts, video calls, and premium subscriptions, all built on React Native and Firebase.

---

## Architecture

```
banana/
├── app/                    # Screens & routing (Expo Router, file-based)
│   ├── (auth)/             # Login & signup flows
│   ├── (tabs)/             # Main tab navigation (home, search, create, notifications, profile)
│   ├── chat/[id].js        # 1:1 and group messaging
│   ├── call/[id].js        # Video & audio calls (ZegoCloud)
│   ├── post/[id].js        # Post detail view
│   ├── story/[id].js       # Story viewer
│   └── ...                 # Settings, admin panel, premium, etc.
├── components/             # Reusable UI components
│   ├── AppleEmojiPicker.js # Native-style emoji selector
│   ├── AudioWavePlayer.js  # Waveform audio playback
│   ├── PremiumBadge.js     # Tiered badge rendering
│   └── ...
├── contexts/               # React Context providers
│   ├── AuthContext.js       # Authentication state & user session
│   ├── PremiumContext.js    # Premium subscription state
│   └── ThemeContext.js      # Dark/light theme management
├── services/               # Firebase data layer (Firestore, RTDB)
│   ├── users.js             # User profiles, follow/block, premium
│   ├── posts.js             # Post CRUD, likes, comments, reshares
│   ├── chat.js              # Real-time messaging, group chats
│   ├── stories.js           # Story creation, highlights, archives
│   └── ...
├── config/                 # Third-party service configuration
│   ├── firebase.js          # Firebase app initialization
│   ├── cloudinary.js        # Media upload pipeline
│   └── razorpay.js          # Payment gateway config
├── utils/                  # Shared helpers & constants
│   ├── theme.js             # Design tokens & color system
│   ├── constants.js         # App-wide constants & feature flags
│   ├── helpers.js           # Formatting, validation, utilities
│   └── premium.js           # Premium plan definitions & logic
├── assets/                 # Static assets (icons, badges, splash)
├── scripts/                # Build & dev tooling
└── android/                # Native Android project (generated)
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the Expo dev server
npx expo start

# 3. Run on Android (device or emulator)
npx expo run:android
```

> **Prerequisite:** Node.js 18+, Android SDK, and an Expo account.

## Tech Stack

| Layer         | Technology                                    |
|---------------|-----------------------------------------------|
| Framework     | React Native 0.81 + Expo SDK 54              |
| Routing       | Expo Router (file-based)                      |
| Backend       | Firebase (Auth, Firestore, Realtime DB)       |
| Media         | Cloudinary (upload & CDN)                     |
| Video Calls   | ZegoCloud                                     |
| Payments      | Razorpay                                      |
| Language      | JavaScript (ES2022)                           |

## Features

- **Real-time messaging** — 1:1 DMs and group chats with typing indicators, read receipts, reactions, and voice messages
- **Social feed** — Posts with likes, comments, reshares, and infinite scroll
- **Stories** — 24-hour ephemeral content with highlights and archives
- **Video & audio calls** — Powered by ZegoCloud
- **Premium tiers** — 6-tier subscription system with admin approval, custom badges, and dynamic app icons
- **Admin panel** — User management, content moderation, premium request handling
- **Dark mode** — System-aware theming with manual override

## License

Private. All rights reserved.
