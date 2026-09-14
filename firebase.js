// ============================================================
// Junior Codex — Firebase data layer
// All reads/writes for the app go through this file.
// Nothing here is mock data — every function talks to a real
// Firebase project once you've filled in firebase-config.js.
// ============================================================

import { firebaseConfig, ADMIN_UID } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc,
  deleteDoc, onSnapshot, query, orderBy, where, limit, serverTimestamp,
  increment, arrayUnion, writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export const isConfigured = !!(firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('YOUR_'));

// Single-admin gate. UID is set — only that account opens admin.html.
export const ADMIN_UID_SET = !!(ADMIN_UID && ADMIN_UID.length > 10 && ADMIN_UID.indexOf('PASTE_') !== 0);
export function isAdminUid(uid){
  if(!ADMIN_UID_SET) return false; // locked down: unknown UID never passes
  return uid === ADMIN_UID;
}

let _app, _auth, _db;
try{
  _app = initializeApp(firebaseConfig);
  _auth = getAuth(_app);
  _db = getFirestore(_app);
} catch(e){
  console.warn('Firebase did not initialize — check firebase-config.js', e);
}
export const app = _app;
export const auth = _auth;
export const db = _db;
// NOTE: Firebase Storage was removed on purpose — the project uses the free
// Spark plan only (Auth + Firestore + Hosting). File uploads below are stored
// as compressed data-URLs inside Firestore (`uploads` collection), so there is
// no Storage bucket, no Storage bill, and no storage.rules to deploy.
export const storage = null;
export { doc, getDoc, updateDoc, setDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp, increment, arrayUnion, writeBatch, collection };

const usersCol = db ? collection(db, 'users') : null;
const eventsCol = db ? collection(db, 'events') : null;
const gameRoomsCol = db ? collection(db, 'gameRooms') : null;
const suggestionsCol = db ? collection(db, 'suggestions') : null;
const chatsCol = db ? collection(db, 'chats') : null;
const contributorsCol = db ? collection(db, 'contributors') : null;
const themesCol = db ? collection(db, 'themes') : null;
const pendingCol = db ? collection(db, 'pending') : null;
const uploadsCol = db ? collection(db, 'uploads') : null;
const reportsCol = db ? collection(db, 'reports') : null;
const challengesCol = db ? collection(db, 'challenges') : null;
const challengeAttemptsCol = db ? collection(db, 'challengeAttempts') : null;
const throneAttemptsCol = db ? collection(db, 'throneAttempts') : null;
const notificationsCol = db ? collection(db, 'notifications') : null;

/* ============ AUTH + PROFILE ============ */

export async function signUpMember(email, password, profile){
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const userDoc = {
    ...profile,
    email: email,
    points: 0,
    level: profile.written === 'lots' ? 'Advanced' : profile.written === 'some' ? 'Intermediate' : 'Beginner',
    tag: null,
    blocked: [],
    createdAt: serverTimestamp()
  };
  try{
    await setDoc(doc(usersCol, uid), userDoc);
  } catch(e){
    // Auth account EXISTS now — only the Firestore profile write failed
    // (almost always a firestore.rules mismatch on /users/{uid}). Throw a
    // marked error so completeSignUp() can tell the user "account created,
    // sign in" instead of a generic failure.
    console.error('[auth] profile write after sign-up failed:', e);
    const marked = new Error('PROFILE_WRITE_FAILED: ' + (e && e.message ? e.message : e));
    marked.code = (e && e.code) || 'permission-denied';
    marked.uid = uid;
    marked.profile = userDoc;
    throw marked;
  }
  return { uid, ...userDoc };
}

export async function signInMember(email, password){
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  let snap = null;
  try{
    snap = await getDoc(doc(usersCol, uid));
    if(snap && snap.exists()) return { uid, ...snap.data() };
  } catch(e){
    // Firestore read blocked (e.g. rules) — still let them in; the profile
    // loads lazily via watchAuth/enterApp instead of failing sign-in outright.
    console.warn('[auth] profile read after sign-in failed:', e);
    return { uid, email: cred.user.email, name: 'Coder' };
  }
  // Auth account exists but has no Firestore profile (created in the console,
  // or an older partial sign-up) — backfill a minimal one so the app never
  // lands on a broken null-profile state.
  const minimal = {
    name: ((cred.user.email || 'Coder').split('@'))[0],
    email: cred.user.email || '', points: 0, level: 'Beginner',
    interests: [], tag: null, blocked: [], createdAt: serverTimestamp()
  };
  try{ await setDoc(doc(usersCol, uid), minimal, { merge: true }); } catch(e){
    console.warn('[auth] profile backfill after sign-in failed:', e);
  }
  return { uid, ...minimal };
}

export function watchAuth(callback){
  return onAuthStateChanged(auth, callback);
}

export async function signOutMember(){
  await signOut(auth);
}

export async function getProfile(uid){
  const snap = await getDoc(doc(usersCol, uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export async function updateProfile(uid, data){
  await updateDoc(doc(usersCol, uid), data);
}

export async function addPoints(uid, amount){
  await updateDoc(doc(usersCol, uid), { points: increment(amount) });
}

/* ============ EVENTS (Home sessions) ============ */

export function onEvents(callback, onError){
  // No orderBy here on purpose: sorting happens client-side so the app works
  // with zero composite indexes.
  const q = query(eventsCol, limit(50));
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => toMillis(b.createdAt, 0) - toMillis(a.createdAt, 0));
    callback(items);
  }, err => { console.error('onEvents:', err); onError && onError(err); });
}

export async function postEvent({ title, place, startsAt, deadline, link, img }){
  const ref = await addDoc(eventsCol, {
    title, place, link: link || '',
    img: img || '✨',
    startsAt: startsAt || null,
    deadline: deadline || null,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

/* ============ GAMES / ROOMS / LEADERBOARD ============ */

export function onGameRooms(gameName, callback){
  const q = query(gameRoomsCol, where('game', '==', gameName), where('status', '==', 'open'));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function hostGameRoom(gameName, hostUid, hostName){
  await addDoc(gameRoomsCol, {
    game: gameName, hostUid, hostName, status: 'open',
    joined: [], createdAt: serverTimestamp()
  });
}

export async function joinGameRoom(roomId, uid){
  await updateDoc(doc(gameRoomsCol, roomId), { joined: arrayUnion(uid) });
}

export function onLeaderboard(callback, onError){
  const q = query(usersCol, limit(50));
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    items.sort((a, b) => (b.points || 0) - (a.points || 0));
    callback(items.slice(0, 10));
  }, err => { console.error('onLeaderboard:', err); onError && onError(err); });
}

/* ============ SUGGESTIONS ============ */

export function onSuggestions(callback, onError){
  const q = query(suggestionsCol, orderBy('createdAt', 'desc'), limit(30));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('onSuggestions:', err); onError && onError(err); });
}

export async function addSuggestion(uid, who, text){
  await addDoc(suggestionsCol, { uid, who, text, reactions: {}, createdAt: serverTimestamp() });
}

export async function reactToSuggestion(id, emoji){
  await updateDoc(doc(suggestionsCol, id), { [`reactions.${emoji}`]: increment(1) });
}

/* ============ CHAT ============ */

function chatIdFor(uidA, uidB){
  return [uidA, uidB].sort().join('_');
}

export async function openOrCreateChat(uidA, nameA, uidB, nameB){
  const id = chatIdFor(uidA, uidB);
  const ref = doc(chatsCol, id);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    await setDoc(ref, {
      participants: [uidA, uidB],
      participantNames: { [uidA]: nameA, [uidB]: nameB },
      lastMessage: '', updatedAt: serverTimestamp()
    });
  }
  return id;
}

export function onMyChats(uid, callback, onError){
  const q = query(chatsCol, where('participants', 'array-contains', uid), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('onMyChats:', err); onError && onError(err); });
}

export function onMessages(chatId, callback){
  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'), limit(200));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function sendMessage(chatId, from, text){
  await addDoc(collection(db, 'chats', chatId, 'messages'), { from, text, createdAt: serverTimestamp() });
  await updateDoc(doc(chatsCol, chatId), { lastMessage: text, updatedAt: serverTimestamp() });
}

export async function blockUser(myUid, blockedUid){
  await updateDoc(doc(usersCol, myUid), { blocked: arrayUnion(blockedUid) });
}

export async function searchUsers(term, excludeUid){
  // Firestore has no substring search built in — for a community-sized
  // member list, fetching once and filtering client-side is the simplest
  // reliable approach. Swap for Algolia/Typesense if the member base grows large.
  const snap = await getDocs(usersCol);
  const t = term.trim().toLowerCase();
  return snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => u.uid !== excludeUid && (!t || (u.name || '').toLowerCase().includes(t)));
}

/* ============ CONTRIBUTORS ============ */

export function onContributors(callback, onError){
  const q = query(contributorsCol, orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('onContributors:', err); onError && onError(err); });
}

/* ============ THEMES ============ */

export function onApprovedThemes(callback, onError){
  const q = query(themesCol, where('status', '==', 'approved'));
  return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => toMillis(b.createdAt, 0) - toMillis(a.createdAt, 0));
      callback(items);
    },
    err => { console.error('onApprovedThemes:', err); onError && onError(err); });
}

/* ============ PENDING (theme / game submissions for admin review) ============ */

export async function submitPending(type, submittedByUid, submittedByName, name, desc, extra){
  await addDoc(pendingCol, {
    type, submittedByUid, submittedByName, name, desc,
    extra: extra || null, status: 'pending', createdAt: serverTimestamp()
  });
}

export function onPending(callback){
  const q = query(pendingCol, where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function approvePending(item){
  if(item.type === 'theme'){
    await addDoc(themesCol, {
      name: item.name, colors: item.extra?.colors || ['#0BAF77','#E8940C','#16213E'],
      status: 'approved', submittedBy: item.submittedByName, createdAt: serverTimestamp()
    });
  } else if(item.type === 'game'){
    await addDoc(contributorsCol, {
      name: item.submittedByName,
      desc: `Proposed the game "${item.name}" — ${item.desc}`,
      createdAt: serverTimestamp()
    });
  } else if(item.type === 'throne' || item.type === 'primus'){
    await addPoints(item.submittedByUid, 5);
    await addDoc(contributorsCol, {
      name: item.submittedByName,
      desc: item.type === 'throne' ? `Completed the "${item.name}" throne challenge` : `Solved the "${item.name}" primus challenge`,
      createdAt: serverTimestamp()
    });
  }
  await deleteDoc(doc(pendingCol, item.id));
}

export async function declinePending(id){
  await deleteDoc(doc(pendingCol, id));
}

/* ============ USERS (admin table) ============ */

export function onAllUsers(callback){
  const q = query(usersCol, orderBy('points', 'desc'));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ uid: d.id, ...d.data() }))));
}

/* ============ UPLOADS (no Storage — free plan only) ============ */
// Uploads are stored as compressed data-URLs in the `uploads` Firestore
// collection. Limits: images are downscaled to max 640px / JPEG 0.7 and
// capped at ~700KB (Firestore doc limit is 1MB); non-images capped at ~700KB
// raw. Returns the data-URL (or text) so callers can render instantly.

export function uploadAsset(category, file, onProgress){
  return new Promise((resolve, reject) => {
    onProgress && onProgress(5);
    const done = async (url, extra) => {
      try{
        await addDoc(uploadsCol, {
          category, name: file.name, url,
          size: file.size || null, type: file.type || null,
          uploadedBy: auth?.currentUser?.uid || null,
          createdAt: serverTimestamp(), ...(extra || {})
        });
        onProgress && onProgress(100);
        resolve(url);
      } catch(e){ reject(e); }
    };
    if(file.type && file.type.startsWith('image/')){
      downscaleImage(file, 640, 0.7).then(dataUrl => {
        onProgress && onProgress(60);
        if(dataUrl.length > 750000){
          reject(new Error('Image is still over ~700KB after compression — try a smaller image.'));
          return;
        }
        done(dataUrl, { dataUrl: true });
      }).catch(reject);
    } else {
      if(file.size > 700000){
        reject(new Error('Files over ~700KB need Firebase Storage (paid Blaze plan) — keep uploads small or use an image.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => { onProgress && onProgress(60); done(reader.result, { dataUrl: true }); };
      reader.onerror = () => reject(reader.error || new Error('Could not read file'));
      reader.readAsDataURL(file);
    }
  });
}

function downscaleImage(file, maxSide, quality){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      try{
        let { width, height } = img;
        const scale = Math.min(1, maxSide / Math.max(width, height));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(objUrl);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch(e){ URL.revokeObjectURL(objUrl); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('Could not read that image')); };
    img.src = objUrl;
  });
}

/* ============ HACKUP (theme validation + submission) ============ */

function hexToRgb(hex){
  const m = hex.replace('#','').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) } : null;
}

function luminance(r, g, b){
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(hex1, hex2){
  const a = hexToRgb(hex1);
  const b = hexToRgb(hex2);
  if(!a || !b) return 0;
  const l1 = luminance(a.r, a.g, a.b);
  const l2 = luminance(b.r, b.g, b.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function validateTheme(name, colors){
  const errors = [];
  const required = ['bg', 'text', 'primaryAccent', 'secondaryAccent'];
  const values = [
    colors.bg, colors.text, colors.primaryAccent, colors.secondaryAccent
  ];
  const validHex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  values.forEach((v, i) => {
    if(!v || !validHex.test(v)) errors.push(`${required[i]} must be a valid hex color`);
  });
  if(!name || name.trim().length === 0) errors.push('Theme name is required');
  else if(name.trim().length > 40) errors.push('Theme name must be under 40 characters');
  
  if(values.every(v => validHex.test(v))){
    const bg = values[0];
    const text = values[1];
    const primary = values[2];
    const secondary = values[3];
    if(contrastRatio(text, bg) < 4.5) errors.push('Text on background fails contrast — try darkening the background or lightening the text');
    if(contrastRatio(text, primary) < 4.5) errors.push('Text on primary accent fails contrast — try lightening the text or darkening the accent');
    if(contrastRatio(text, secondary) < 4.5) errors.push('Text on secondary accent fails contrast — try lightening the text or darkening the accent');
  }
  return { valid: errors.length === 0, errors };
}

export async function submitThemeValidated(name, colors, uid, userName){
  const { valid, errors } = validateTheme(name, colors);
  if(!valid) return { submitted: false, errors };
  
  const snap = await getDocs(query(themesCol, where('name', '==', name.trim())));
  if(!snap.empty){
    return { submitted: false, errors: ['A theme with this name already exists — try a different name'] };
  }
  
  await submitPending('theme', uid, userName, name.trim(), 'Custom theme submission', {
    colors: [colors.bg, colors.text, colors.primaryAccent, colors.secondaryAccent]
  });
  return { submitted: true, errors: [] };
}

/* ============ MVP'S THRONE ============ */

export async function createThroneAttempt(uid, userName, pitch, deadlineAt){
  const docRef = await addDoc(throneAttemptsCol, {
    uid, userName, pitch,
    deadlineAt,
    startedAt: serverTimestamp(),
    code: null, lineCount: 0,
    status: 'active',
    submittedAt: null, rejectionReason: null
  });
  return docRef.id;
}

export function onMyThroneAttempts(uid, callback){
  const q = query(throneAttemptsCol, where('uid', '==', uid), orderBy('startedAt', 'desc'), limit(5));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function submitThroneCode(attemptId, code, lineCount){
  const ref = doc(throneAttemptsCol, attemptId);
  const snap = await getDoc(ref);
  if(!snap.exists()) throw new Error('Attempt not found');
  const data = snap.data();
  if(data.status !== 'active') throw new Error('Attempt already submitted');
  if(lineCount > 50) return { accepted: false };
  await updateDoc(ref, {
    code, lineCount,
    status: 'submitted',
    submittedAt: serverTimestamp()
  });
  return { accepted: true };
}

export async function expireThroneAttempts(){
  const now = Date.now();
  const q = query(throneAttemptsCol, where('status', '==', 'active'));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => {
    const data = d.data();
    const deadline = toMillis(data.deadlineAt, now);
    if(now > deadline){
      batch.update(doc(throneAttemptsCol, d.id), { status: 'timedOut' });
    }
  });
  await batch.commit();
}

/* ============ CODEX PRIMUS ============ */

export async function createChallenge(data){
  const docRef = await addDoc(challengesCol, {
    code: data.code,
    answerKey: data.answerKey,
    authorUid: data.authorUid,
    authorName: data.authorName,
    visibility: data.visibility || 'public',
    recipientUid: data.recipientUid || null,
    timeLimitSec: data.timeLimitSec || 60,
    difficulty: data.difficulty || null,
    status: 'active',
    attempts: [],
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export function onPublicChallenges(callback, excludeUid){
  const q = query(challengesCol, where('visibility', '==', 'public'), where('status', '==', 'active'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items.filter(c => c.authorUid !== excludeUid));
  });
}

export function onMyChallenges(uid, callback){
  const q = query(challengesCol, where('authorUid', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export function onChallengeAttempts(challengeId, callback){
  const q = query(challengeAttemptsCol, where('challengeId', '==', challengeId), orderBy('submittedAt', 'desc'));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function submitChallengeAnswer(challengeId, solverUid, answer, revealedAt){
  const ref = doc(challengeAttemptsCol, challengeId + '_' + solverUid);
  const snap = await getDoc(ref);
  if(snap.exists()) throw new Error('You already attempted this challenge');
  
  await setDoc(ref, {
    challengeId, solverUid, answer,
    revealedAt,
    submittedAt: serverTimestamp(),
    correct: false,
    manuallyGraded: false
  });
  
  const challengeSnap = await getDoc(doc(challengesCol, challengeId));
  if(challengeSnap.exists()){
    await updateDoc(doc(challengesCol, challengeId), {
      attempts: arrayUnion({ solverUid, revealedAt, submittedAt: serverTimestamp(), answer, correct: false })
    });
  }
  
  return ref.id;
}

export async function gradeChallengeAttempt(attemptId, correct){
  await updateDoc(doc(challengeAttemptsCol, attemptId), { correct, manuallyGraded: true });
  const snap = await getDoc(doc(challengeAttemptsCol, attemptId));
  const data = snap.data();
  if(data){
    await updateDoc(doc(challengesCol, data.challengeId), {
      [`attempts`]: arrayUnion({ solverUid: data.solverUid, revealedAt: data.revealedAt, submittedAt: data.submittedAt, answer: data.answer, correct })
    });
  }
}

export async function approveThroneAttempt(attemptId, uid){
  await addPoints(uid, 5);
  const snap = await getDoc(doc(throneAttemptsCol, attemptId));
  if(snap.exists()){
    await updateDoc(doc(throneAttemptsCol, attemptId), { status: 'approved' });
  }
}

export async function declineThroneAttempt(attemptId){
  await updateDoc(doc(throneAttemptsCol, attemptId), { status: 'rejected' });
}

export async function approvePrimusChallenge(challengeId, solverUid){
  await addPoints(solverUid, 5);
  const snap = await getDoc(doc(challengesCol, challengeId));
  if(snap.exists()){
    await updateDoc(doc(challengesCol, challengeId), { status: 'approved' });
  }
}

export async function declinePrimusChallenge(challengeId, solverUid){
  const ref = doc(challengeAttemptsCol, challengeId + '_' + solverUid);
  await updateDoc(ref, { correct: false, manuallyGraded: true });
}

export async function approvePrimusAttempt(attemptId, solverUid){
  await addPoints(solverUid, 5);
  await updateDoc(doc(challengeAttemptsCol, attemptId), { correct: true, manuallyGraded: true });
}

export async function declinePrimusAttempt(attemptId){
  await updateDoc(doc(challengeAttemptsCol, attemptId), { correct: false, manuallyGraded: true });
}

/* ============ PENDING (enhanced with rejection reason) ============ */

export async function submitPendingWithReason(type, submittedByUid, submittedByName, name, desc, extra, rejectionReason){
  await addDoc(pendingCol, {
    type, submittedByUid, submittedByName, name, desc,
    extra: extra || null, status: 'pending', rejectionReason: rejectionReason || null,
    createdAt: serverTimestamp()
  });
}

/* ============ SEED (first-run demo content — safe to skip if data exists) ============ */

export async function seedIfEmpty(){
  const existing = await getDocs(query(eventsCol, limit(1)));
  if(!existing.empty) return false;

  // Only the admin account may seed (rules: events/themes writes = isAdmin).
  // Everyone else silently skips so sign-up never hits permission-denied.
  if(!(auth?.currentUser && isAdminUid(auth.currentUser.uid))) return false;

  const batch = writeBatch(db);
  const now = Date.now();
  const day = 86400000;

  batch.set(doc(eventsCol), {
    title: 'CSS Battle Royale', place: 'Online', img: '🎨', link: '',
    startsAt: new Date(now + day), deadline: new Date(now + 10 * day), createdAt: serverTimestamp()
  });
  batch.set(doc(eventsCol), {
    title: 'Junior Codex Hack Week', place: 'Accra Hub', img: '🔥', link: '',
    startsAt: new Date(now - day), deadline: new Date(now + 4 * day), createdAt: serverTimestamp()
  });
  batch.set(doc(eventsCol), {
    title: 'Welcome Meetup', place: 'Kumasi Hub', img: '👋', link: '',
    startsAt: new Date(now - 20 * day), deadline: new Date(now - 18 * day), createdAt: serverTimestamp()
  });
  // First-party Personalize presets — live on day one, no approval needed.
  batch.set(doc(themesCol), { name: 'Terminal Night', colors: ['#0A0F1E', '#C8F7D4', '#34D399', '#7C6CFF'], status: 'approved', submittedBy: 'Junior Codex', desc: 'Deep-navy hacker preset for late-night builds.', createdAt: serverTimestamp() });
  batch.set(doc(themesCol), { name: 'Sunrise Sprint', colors: ['#FFF8F0', '#3A2E2A', '#FF6B4A', '#FFB020'], status: 'approved', submittedBy: 'Junior Codex', desc: 'Warm, energetic preset for younger builders.', createdAt: serverTimestamp() });
  batch.set(doc(themesCol), { name: 'Blueprint', colors: ['#FFFFFF', '#14324F', '#1B6FD6', '#FF8A00'], status: 'approved', submittedBy: 'Junior Codex', desc: 'Engineering-grid preset that leans into learning to build.', createdAt: serverTimestamp() });
  batch.set(doc(themesCol), { name: 'Mint Paper', colors: ['#F3FBF5', '#234036', '#0BAF77', '#7C6CFF'], status: 'approved', submittedBy: 'Junior Codex', desc: 'Soft pastel preset — gentle and approachable.', createdAt: serverTimestamp() });
  batch.set(doc(contributorsCol), { name: 'Nadia F.', desc: 'Built the "Confetti Win" animation now used across all three games.', createdAt: serverTimestamp() });

  await batch.commit();
  return true;
}

/* ============ AI PROVIDERS ============ */

export async function callAI({ provider, apiKey, messages, model }){
  if(!provider || !apiKey) throw new Error('Missing provider or API key');
  
  let url, headers, body;
  
  if(provider === 'openai'){
    url = 'https://api.openai.com/v1/chat/completions';
    headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    body = JSON.stringify({ model: model || 'gpt-4o-mini', messages, max_tokens: 1024 });
  } else if(provider === 'gemini'){
    const modelName = model || 'gemini-2.0-flash';
    url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    headers = { 'Content-Type': 'application/json' };
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    body = JSON.stringify({ contents, generationConfig: { maxOutputTokens: 1024 } });
  } else if(provider === 'deepseek'){
    url = 'https://api.deepseek.com/v1/chat/completions';
    headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    body = JSON.stringify({ model: model || 'deepseek-chat', messages, max_tokens: 1024 });
  } else {
    throw new Error('Unknown provider');
  }
  
  const res = await fetch(url, { method: 'POST', headers, body });
  if(!res.ok){
    const text = await res.text();
    throw new Error(`AI request failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  
  if(provider === 'gemini'){
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  return data.choices?.[0]?.message?.content || '';
}

export function getChallengesCol(){ return challengesCol; }
export function getChallengeAttemptsCol(){ return challengeAttemptsCol; }
export function getThroneAttemptsCol(){ return throneAttemptsCol; }
export function getThemesCol(){ return themesCol; }
export function getPendingCol(){ return pendingCol; }
export function getContributorsCol(){ return contributorsCol; }
export function getNotificationsCol(){ return notificationsCol; }
export function getReportsCol(){ return reportsCol; }

/* ============ REPORTS (moderation — minors safety, admin-only reads) ============ */

export async function flagContent({ targetType, targetId, targetText, reason, reporterUid, reporterName }){
  await addDoc(reportsCol, {
    targetType, targetId,
    targetText: (targetText || '').slice(0, 500),
    reason: reason || 'inappropriate',
    reporterUid, reporterName: reporterName || 'Member',
    status: 'open', createdAt: serverTimestamp()
  });
}

export function onReports(callback, onError){
  const q = query(reportsCol, orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))), err => { console.error('onReports:', err); onError && onError(err); });
}

export async function resolveReport(id, action, targetType, targetId){
  if(action === 'remove' && targetId){
    try{
      const col = targetType === 'suggestion' ? suggestionsCol : targetType === 'message' ? null : null;
      if(col) await deleteDoc(doc(col, targetId));
    } catch(e){ console.warn('[reports] remove failed:', e); }
  }
  await updateDoc(doc(reportsCol, id), { status: action === 'remove' ? 'removed' : 'dismissed', resolvedAt: serverTimestamp() });
}

/* ============ NOTIFICATIONS ============ */

export async function createNotification(uid, type, title, message, link){
  await addDoc(notificationsCol, {
    uid, type, title, message, link: link || null,
    read: false, createdAt: serverTimestamp()
  });
}

export function onMyNotifications(uid, callback){
  const q = query(notificationsCol, where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function markNotificationRead(id){
  await updateDoc(doc(notificationsCol, id), { read: true });
}

export async function markAllNotificationsRead(uid){
  const q = query(notificationsCol, where('uid', '==', uid), where('read', '==', false));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(doc(notificationsCol, d.id), { read: true }));
  await batch.commit();
}

export async function broadcastEventNotification(eventId, eventTitle){
  const snap = await getDocs(query(usersCol, limit(500)));
  const batch = writeBatch(db);
  snap.docs.forEach(d => {
    const ref = doc(notificationsCol);
    batch.set(ref, {
      uid: d.id, type: 'event', title: 'New event posted', message: eventTitle,
      link: `/event/${eventId}`, read: false, createdAt: serverTimestamp()
    });
  });
  await batch.commit();
}

export async function broadcastChatNotification(chatId, fromUid, fromName, preview){
  const snap = await getDoc(doc(chatsCol, chatId));
  if(!snap.exists()) return;
  const data = snap.data();
  const recipientUid = (data.participants || []).find(p => p !== fromUid);
  if(!recipientUid) return;
  await createNotification(recipientUid, 'chat', `New message from ${fromName}`, preview, `/chat/${chatId}`);
}

export async function broadcastApprovalNotification(uid, type, name){
  await createNotification(uid, 'approval', `${type} approved`, `Your ${type.toLowerCase()} "${name}" was approved`, null);
}

export async function broadcastDeclineNotification(uid, type, name, reason){
  await createNotification(uid, 'decline', `${type} declined`, `Your ${type.toLowerCase()} "${name}" was declined${reason ? ': ' + reason : ''}`, null);
}

function toMillis(v, fallback){
  if(!v) return fallback;
  if(v.toDate) return v.toDate().getTime();
  return new Date(v).getTime();
}
