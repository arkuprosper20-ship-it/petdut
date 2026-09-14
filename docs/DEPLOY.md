# Deploy & CI — Junior Codex

Live: **https://codex-i.web.app** (project `codex-i`)

## Manual deploy

```powershell
firebase deploy --project codex-i --only firestore   # rules + indexes
firebase deploy --project codex-i --only hosting     # the site
firebase deploy --project codex-i --only storage     # after Storage is enabled (see below)
```

## Storage one-time setup

`firebase deploy --only storage` fails until the default bucket exists:

1. Open https://console.firebase.google.com/project/codex-i/storage → **Get Started**
2. Accept defaults (creates `codex-i.firebasestorage.app`)
3. Re-run: `firebase deploy --project codex-i --only storage`

## CI (GitHub Actions → Firebase)

Two workflows live in `.github/workflows/`:

| Workflow | Trigger | Does |
|---|---|---|
| `firebase-hosting-merge.yml` | push to `main` | deploys `hosting` + `firestore` to production |
| `firebase-hosting-pr.yml` | pull request → `main` | creates a 7-day preview channel `pr-<n>` |

Both need a `FIREBASE_TOKEN` repo secret (they use `firebase deploy --non-interactive`):

```powershell
firebase login:ci          # prints a token (run locally, once)
gh secret set FIREBASE_TOKEN --body "PASTE_TOKEN_HERE" --repo arkuprosper20-ship-it/petdut
```

Verify: push to `main` → Actions tab → green run → https://codex-i.web.app updated.

## Single-admin lockdown (before public launch)

1. Sign in on the live site, copy your Firebase Auth UID (Console → Authentication → Users).
2. Paste it as `ADMIN_UID` in `firebase-config.js`.
3. In `firestore.rules`: uncomment the `isAdmin()` helper, put the same UID in it,
   and swap the three `ADMIN-ONLY` lines to `allow write: if isAdmin();`
   (`events`, `contributors`, `themes` — the admin-curated collections).
4. Redeploy: `firebase deploy --project codex-i --only firestore,hosting`.
