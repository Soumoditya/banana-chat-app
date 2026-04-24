# 🍌 Banana Chat

A feature-rich social platform for Android — real-time messaging, stories, an algorithmic feed, video calls, and a 6-tier premium subscription system, all built on React Native and Firebase.

---

## Architecture

```
banana/
├── app/                    # Screens & routing (Expo Router, file-based)
│   ├── (auth)/             # Login & signup flows
│   ├── (tabs)/             # Main tab navigation (home, search, create, chats, notifications, profile)
│   ├── chat/[id].js        # 1:1 and group messaging
│   ├── call/[id].js        # Video & audio calls (Firebase RTDB signaling)
│   ├── post/[id].js        # Post detail & comments
│   ├── story/[id].js       # Full-screen story viewer
│   ├── share-post/         # Post sharing flow
│   ├── user/[id].js        # Public profile viewer
│   ├── admin.js            # Admin panel (user moderation, broadcasts, reports, logs)
│   ├── premium.js          # Premium plan selection & purchase
│   ├── premium-settings.js # Active plan management & customization
│   ├── settings.js         # App settings with searchable interface
│   └── ...                 # Highlights, archives, group creation, etc.
├── components/             # Reusable UI components
│   ├── AppleEmojiPicker.js # iOS-style emoji keyboard
│   ├── AudioWavePlayer.js  # Waveform audio playback
│   ├── EmojiPicker.js      # Standard emoji selector
│   ├── EmojiText.js        # Emoji-aware text renderer
│   ├── GiphyPicker.js      # GIF search & insert
│   ├── ImageViewer.js      # Full-screen image viewer with gestures
│   ├── PremiumBadge.js     # Tiered badge & flair rendering
│   └── VideoViewer.js      # In-feed video player
├── contexts/               # React Context providers
│   ├── AuthContext.js      # Authentication state, user session, admin detection
│   ├── PremiumContext.js   # Premium subscription state & themed colors
│   ├── ThemeContext.js     # Dark/light theme management
│   └── ToastContext.js     # Animated toast notifications & confirmation modals
├── hooks/                  # Custom React hooks
│   └── useAppTheme.js      # Universal theme hook (colors, fonts, skins)
├── services/               # Firebase data layer (Firestore + RTDB)
│   ├── users.js            # Profiles, follow/block, pin/archive chats
│   ├── posts.js            # Post CRUD, likes, comments, saves, explore feed
│   ├── chat.js             # Real-time messaging, group chats, typing indicators
│   ├── stories.js          # Story creation, highlights, archives, trash
│   ├── streaks.js          # User & app usage streaks
│   ├── reshares.js         # Post reshare system with notifications
│   ├── notifications.js    # Activity notifications
│   ├── pushNotifications.js# Expo push notification registration
│   └── admin.js            # Admin operations (ban, verify, broadcast)
├── config/                 # Third-party service configuration
│   ├── firebase.js         # Firebase app init (Auth, Firestore, RTDB, Storage)
│   ├── cloudinary.js       # Media upload pipeline (image + video)
│   └── razorpay.js         # Payment gateway config
├── utils/                  # Shared helpers & constants
│   ├── theme.js            # Design tokens, color system, spacing scale
│   ├── constants.js        # App-wide constants, streak emojis, feature flags
│   ├── helpers.js          # Formatting, validation, text utilities
│   ├── emoji.js            # Shared Apple emoji CDN utilities
│   ├── animations.js       # Shared micro-animation presets (fadeIn, bounce, stagger)
│   └── premium.js          # 6-tier plan definitions, feature gating, UI skins
├── website/                # Landing page (open-source)
│   ├── index.html          # Premium bento-grid layout with app mockups
│   ├── style.css           # Responsive design with glassmorphism and animations
│   └── script.js           # Interactive cursor glow, marquee, scroll animations
├── assets/                 # Static assets (icons, badges, splash, custom app icons)
├── scripts/                # Build & dev tooling
└── android/                # Native Android project (generated via prebuild)
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

> **Prerequisites:** Node.js 18+, Android SDK, and an Expo account.

## Tech Stack

| Layer         | Technology                                         |
|---------------|---------------------------------------------------|
| Framework     | React Native 0.81 + Expo SDK 54                   |
| Routing       | Expo Router v6 (file-based)                        |
| Backend       | Firebase (Auth, Firestore, Realtime Database)      |
| Media         | Cloudinary (upload & CDN)                          |
| Payments      | Razorpay (UPI / card / PayPal)                     |
| Notifications | Expo Notifications (push)                          |
| Language      | JavaScript (ES2022)                                |

## Current Features

### 📱 Social Feed
- Algorithmic home feed with client-side ranking and infinite scroll
- Posts with text, images, video, and multi-media carousels
- Upvote / downvote system, comments, and reshares
- Interactive polls with real-time vote tracking
- Swipe-to-chat: navigate directly to DMs from the feed
- Post saving, archiving, and recently-deleted recovery
- Premium card spacing with rounded corners and skin-aware styling

### 💬 Messaging
- Real-time 1:1 DMs and group chats (Firebase RTDB)
- Voice note recording with waveform playback
- GIF integration (Giphy), file sharing, and media attachments
- Message pinning, emoji reactions, and read receipts
- Typing indicators and chat nicknames
- Chat sections: Primary, General, Requests, Archived
- Pin / archive / clear chat with long-press actions
- Group creation with member search and selection

### 📸 Stories & Highlights
- 24-hour ephemeral stories with background / font customization
- Story highlights (Spotlight & Memory categories) with resilient cross-collection fetching
- Highlight editor with cover image and story selection
- Story archive browser organized by date
- Soft-delete trash system with recovery window

### 🔍 Explore & Search
- Explore grid with community posts (image + text)
- Dual search: users and posts in one query
- Suggested users carousel with optimistic follow
- Persistent search history with clear-all

### 👤 Profiles
- Editable profile: avatar, bio, display name, username (with uniqueness validation), social links
- Social link showcase (Instagram, Twitter, YouTube, GitHub, LinkedIn, website)
- Personal details editor (birthday, gender, location, phone)
- Followers / following lists with navigation
- Post grid tabs: My Posts, Reshared, Saved
- App usage streaks with tiered emoji badges
- Private / public account toggle
- Profile sharing

### 📞 Calls
- Audio and video call UI with Firebase RTDB signaling
- Mute, speaker toggle, and call duration timer
- Auto-cleanup on disconnect

### 🔔 Notifications
- Real-time activity feed (likes, follows, mentions, reshares)
- Time-based grouping (Today / This Week / This Month)
- Notification settings management

### 💎 Premium (6-Tier Subscription)
- **Standard** (₹99) — Blue tick, iOS emoji support, ad-free
- **Premium** (₹199) — Gold tick, 3 fonts, 2 themes, media download
- **Premium+** (₹299) — 5 fonts, 5 themes, profile analytics
- **Elite** (₹399) — Purple tick, glassmorphism UI skin, priority search
- **Super** (₹499) — Golden banana badge, liquid glass UI, custom app icon upload
- **VIP** (₹999) — Black banana badge, Aurora Shift UI, obsidian theme, 72h stories
- 10+ premium themes with global propagation (all screens re-render instantly)
- 5 UI skins (Classic, Glass, Liquid Glass, Neon Glow, Aurora Shift)
- 8+ custom app icons (Spiderman, Ironman, Homelander, Ben 10, Invincible, and more)
- 8 font styles across tiers
- Admin-override premium activation (no payment required)
- UPI and PayPal payment flows via Razorpay

### 🛡️ Admin Panel
- User search, ban, unban, and verification management
- Premium request queue with approve / reject workflow
- Broadcast messaging to all users
- Content moderation: Reports queue with remove/dismiss actions
- Activity logs with categorized event tracking
- Moderation tools: Content filters, spam detection, analytics
- App-wide statistics dashboard (total users, premium count, active today)

### ⚙️ Settings & Privacy
- **Searchable settings** with keyword-based filtering across all categories
- Dark / light mode toggle with system-aware default
- Private profile mode (followers-only content)
- Blocked users management
- Close friends list
- Password change via Firebase email reset
- About page & Terms of Service link

### 🌐 Landing Page
- Premium bento-grid layout with CSS-only app mockups
- Interactive cursor glow effect and staggered animations
- Mobile-responsive hamburger navigation
- Horizontal marquee showcasing app screens
- Deployed on Vercel

---

## Latest Activity

- **feat:** GIF support in post comments via GiphyPicker
- **fix:** Comment deletion now works properly (long-press → Delete)
- **fix:** Other users' profiles now support pull-to-refresh
- **fix:** PDF/document viewing uses Google Docs viewer instead of raw Cloudinary redirect
- **fix:** Premium badge assets replaced with transparent starburst PNGs (no white square background)
- **fix:** Version synced to v4.8.0 across all platforms
- **feat:** 7 micro-animations (double-tap like, upvote bounce, FadeInView, skeleton shimmer, scale-press, recording wave)
- **fix:** Theme consistency audit — all hardcoded Colors.* replaced with dynamic C.* across all screens

## Links

- **Website:** [banana-chat-app.vercel.app](https://banana-chat-app.vercel.app)
- **GitHub:** [github.com/Soumoditya/banana-chat-app](https://github.com/Soumoditya/banana-chat-app)

## License

MIT — see [LICENSE](https://github.com/Soumoditya/banana-chat-app/blob/master/LICENSE) for details.
