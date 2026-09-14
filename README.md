# Junior Codex

[![Deploy to Firebase](https://github.com/arkuprosper20-ship-it/petdut/actions/workflows/firebase-hosting-merge.yml/badge.svg)](https://github.com/arkuprosper20-ship-it/petdut/actions)
[![Live site](https://img.shields.io/badge/live-codex--i.web.app-0BAF77)](https://codex-i.web.app)

A community platform for young coders — onboarding, a member app (Home, Games, Chat, Suggestions, Settings, Contributors, Personalize), and a separate admin dashboard. Built in plain HTML/CSS/JS (no build step, no framework) and wired to **Firebase** for real accounts, live data, and file uploads.

**Live:** https://codex-i.web.app · **Repo:** https://github.com/arkuprosper20-ship-it/petdut

**Games:** Hackup (theme design with contrast validation), MVP's Throne (timed 50-line build challenge), Codex Primus (hidden-code decode duel with auto-grading).

**AI Assistant:** Members can connect their own AI provider (OpenAI, Gemini, DeepSeek) via Settings and chat with an AI assistant directly in the app.

## Files

| File | What it is |
|---|---|
| `index.html` | Public/member page — onboarding + the full member app |
| `admin.html` | Admin dashboard, its own page, sign-in gated |
| `styles.css` | Shared design system (glassmorphism, color, type, motion) |
| `firebase-config.js` | **You edit this** — your Firebase project's keys |
| `firebase.js` | All Firebase calls (Auth, Firestore, Storage) live here — the only file that talks to Firebase directly |
| `data.js` | Static catalog only: avatar emoji set + the fixed 3-game list. Everything else is live Firestore data |
| `app.js` | Logic for `index.html` |
| `admin.js` | Logic for `admin.html` |
| `sw.js` | Offline-first service worker (app shell cached, Firebase traffic bypasses cache) |
| `404.html` | Custom "Lost in the code?" page for unknown routes |
| `.github/workflows/` | CI: production deploy on push to `main`, preview channels on PRs (see `docs/DEPLOY.md`) |

Keep all files together in one folder — `index.html` and `admin.html` both load `styles.css`, and the JS files import each other by relative path.

## 1. Set up Firebase (one-time)

1. Go to the [Firebase console](https://console.firebase.google.com) → **Add project**.
2. Inside the project: **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**.
3. **Build → Firestore Database → Create database** (start in production mode, pick a region).
4. **Build → Storage → Get started** (same defaults are fine).
5. **Project settings (gear icon) → General → Your apps → Web (`</>`)** → register an app (no need for Firebase Hosting yet) → copy the `firebaseConfig` object it gives you.
6. Paste those values into `firebase-config.js` in this folder, replacing the `YOUR_...` placeholders.

That's it — reload `index.html` and the banner telling you Firebase isn't connected disappears. Onboarding now creates a real account; the admin dashboard now needs you to sign in.

## 2. Security rules

Default Firestore/Storage rules lock everything down, which will make every read/write fail silently. Paste these in **before** testing.

**Firestore rules** (Firestore Database → Rules):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    match /events/{id} { allow read: if true; allow write: if request.auth != null; }
    match /gameRooms/{id} { allow read, write: if request.auth != null; }
    match /suggestions/{id} { allow read: if true; allow write: if request.auth != null; }
    match /chats/{chatId} {
      allow read, create, update: if request.auth != null;
      match /messages/{msgId} { allow read, write: if request.auth != null; }
    }
    match /contributors/{id} { allow read: if true; allow write: if request.auth != null; }
    match /themes/{id} { allow read: if true; allow write: if request.auth != null; }
    match /pending/{id} { allow read, write: if request.auth != null; }
    match /uploads/{id} { allow read, write: if request.auth != null; }
    match /challenges/{id} { allow read: if true; allow write: if request.auth != null; }
    match /challengeAttempts/{id} { allow read, write: if request.auth != null; }
    match /throneAttempts/{id} { allow read, write: if request.auth != null; }
    match /notifications/{id} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null;
    }
  }
}
```

**Storage rules** (Storage → Rules):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

⚠️ These rules are intentionally open among signed-in members (any member can write most collections) to match the prototype's flat structure — good enough for a small community, but before a public launch you'll want an `isAdmin` custom claim so only admins can approve/decline/post events, rather than "any signed-in member who opens `admin.html`."

## 3. Run it

No build step — this is plain HTML/CSS/JS with the Firebase SDK imported straight from Google's CDN. Just serve the folder:

```
npx serve .
```

or open `index.html` directly in a browser. (Opening via `file://` also works for everything except Firebase Auth in some browsers, which is picky about `file://` origins — a local server avoids that.)

## 4. Deploy (Firebase Hosting)

```
npm install -g firebase-tools
firebase login
firebase init hosting     # pick this project, public dir = "." , single-page app = No
firebase deploy
```

## What's real vs. simplified

**Real and live** (writes to Firestore/Storage, syncs between `index.html` and `admin.html` instantly):
- Sign-up / sign-in (Firebase Auth)
- Events — admin posts one, it appears on member Home in real time, auto-sorted into New/Ongoing/Past by date
- Suggestions + emoji reactions
- Chat — search a member, message them, block them; messages are a live Firestore subcollection
- Leaderboard, points
- Theme submissions with WCAG contrast validation → admin queue → approved themes in Personalize
- MVP's Throne — pitch, self-set deadline, 50-line silent gate, auto-submit on timeout, admin review
- Codex Primus — create hidden-code challenges, solve with reveal-triggered timer, auto-grade, points on correct
- File uploads (games/events/themes/icons) → real Firebase Storage, with a progress bar
- AI Assistant — per-member saved provider/key (OpenAI, Gemini, DeepSeek) with in-app chat

**Simplified on purpose:**
- "Admin" is currently any signed-in member who opens `admin.html` — add a custom claim before shipping this for real, as noted above.
- Notification/privacy toggles in Settings are visual only (not wired to anything that sends notifications).
