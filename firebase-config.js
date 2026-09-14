// ============================================================
// Junior Codex — Firebase project config (ADMIN LOCKED)
// ============================================================
// SINGLE ADMIN — this UID is the ONLY account that can open admin.html
// and approve/post. Everyone else is bounced back to index.html, and the
// Firestore rules below enforce the same gate server-side.
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


// SINGLE ADMIN — paste YOUR Firebase Auth UID between the quotes when you
// have it (sign up on the live site first, then copy the UID from the
// Firebase console → Authentication → Users, or from the member app's
// Settings page which now shows it). While this is "" (empty), any
// signed-in member can open admin.html so you can test end-to-end — but
//Firestore rules below already require this UID for admin writes.
export const ADMIN_UID = "PASTE_YOUR_UID_HERE";
