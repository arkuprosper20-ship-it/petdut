// ============================================================
// Junior Codex — Firebase project config
// ============================================================
// 1. Go to https://console.firebase.google.com → create a project
// 2. Project settings → General → "Your apps" → add a Web app
// 3. Copy the config object Firebase gives you and paste the values below
// 4. In the console, enable:
//      - Authentication → Sign-in method → Email/Password
//      - Firestore Database → Create database (start in production mode)
//      - Storage → Get started
//    Then apply the security rules from README.md
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyBAZPiRBKtR0IqWRKh4E6c4cy5ZvY5UQDg",
  authDomain: "codex-i.firebaseapp.com",
  projectId: "codex-i",
  storageBucket: "codex-i.firebasestorage.app",
  messagingSenderId: "238840055348",
  appId: "1:238840055348:web:cd26d192b835defa3dec61",
  measurementId: "G-8PVQWVVG97"
};

// NOTE: These are public client-side Firebase keys — Firebase docs state
// they are safe to ship in client code. Access is enforced by
// Firestore/Storage security rules, not by hiding these values.


// SINGLE ADMIN — paste the admin's Firebase Auth UID here when you have it.
// While this is "" (empty), any signed-in member can open admin.html so you
// can test end-to-end. The moment you paste a UID, only that user can open
// the dashboard and approve/post (rules in firestore.rules must be tightened
// with the same UID — see the commented block at the top of that file).
export const ADMIN_UID = "";
