// ============================================================
// Junior Codex — Firebase project config (ADMIN LOCKED)
// ============================================================
// SINGLE ADMIN (2K4mB8Fw3oZJMSwB2PiozJy8Ycp2) — the ONLY account that can
// open admin.html and approve/post. Everyone else is bounced to index.html,
// and the Firestore rules enforce the same gate server-side.
// To rotate admin: replace the UID here AND in firestore.rules, redeploy.
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
// Firestore security rules, not by hiding these values.


// SINGLE ADMIN — UID verified. Do not change without also updating
// firestore.rules isAdmin().
export const ADMIN_UID = "2K4mB8Fw3oZJMSwB2PiozJy8Ycp2";
