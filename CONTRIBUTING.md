# Contributing to Banana Chat

Thanks for your interest in contributing. This document covers the conventions and workflow for this project.

## Branch Strategy

- `master` — stable, production-ready code
- Feature branches — `feat/<short-description>` (e.g., `feat/voice-messages`)
- Bugfix branches — `fix/<short-description>` (e.g., `fix/chat-scroll`)

## Commit Messages

All commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add group video calls
fix: resolve notification badge count on app resume
refactor: extract emoji picker into standalone component
docs: update setup instructions for Android SDK 35
chore: bump expo to SDK 54
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `chore`, `style`, `test`, `perf`

## Project Conventions

### File Naming
- **Screens:** `kebab-case.js` (e.g., `premium-settings.js`)
- **Components:** `PascalCase.js` (e.g., `PremiumBadge.js`)
- **Services/Utils:** `camelCase.js` (e.g., `pushNotifications.js`)

### Code Style
- Functional components with hooks (class components only for error boundaries)
- Named exports for services, default exports for screens
- Comments explain **why**, not **what**
- No hardcoded strings — use `utils/constants.js`

### Adding a New Screen
1. Create the file in `app/` following Expo Router conventions
2. Register it in `app/_layout.js` with appropriate animation
3. If it needs auth, the `AuthContext` redirect handles it automatically

### Adding a New Service
1. Create the file in `services/`
2. Import Firebase instances from `config/firebase.js`
3. Export named async functions — one function per Firestore operation

## Running the Project

```bash
npm install
npx expo start
```

For a release build:

```bash
cd android
./gradlew assembleRelease
```

## Questions?

Open an issue or reach out to the maintainer directly.
