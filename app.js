/* ============ app.js — member app, wired to Firebase ============ */
import {
  isConfigured, signUpMember, signInMember, watchAuth, signOutMember, getProfile, updateProfile, addPoints,
  onEvents, onGameRooms, hostGameRoom, joinGameRoom, onLeaderboard,
  onSuggestions, addSuggestion, reactToSuggestion,
  onMyChats, onMessages, sendMessage, openOrCreateChat, searchUsers, blockUser,
  onContributors, onApprovedThemes, submitPending, seedIfEmpty,
  validateTheme, submitThemeValidated, contrastRatio,
  createThroneAttempt, onMyThroneAttempts, submitThroneCode, expireThroneAttempts, approveThroneAttempt, declineThroneAttempt,
  createChallenge, onPublicChallenges, onMyChallenges, submitChallengeAnswer, gradeChallengeAttempt,
  onChallengeAttempts, approvePrimusChallenge, declinePrimusChallenge, approvePrimusAttempt, declinePrimusAttempt,
  doc, getDoc, callAI,
  getChallengesCol, getChallengeAttemptsCol, getThroneAttemptsCol, getThemesCol, getPendingCol, getContributorsCol,
  createNotification, onMyNotifications, markNotificationRead, markAllNotificationsRead, broadcastChatNotification
} from './firebase.js';
import { AVATARS, GAMES } from './data.js';

/* ============ STATE ============ */
const state = {
  step: 0,
  form: { name:'', age:'', residence:'', school:'', education:'', heard:'', written:'', interests:[], hackathonKnown:'', hackInterest:'' },
  uid: null,
  profile: null,
  page: 'home',
  gameSort: 'played',
  avatarSel: 0,
  guideStep: 0,
  chatCache: [],
  activeChatId: null,
  activeOtherUid: null,
  activeOtherName: null,
  unsub: {},
  game: null,
  throneAttempt: null,
  throneTimer: null,
  throneRemaining: 0,
  primusChallenge: null,
  primusRevealed: false,
  primusRemaining: 0,
  primusTimer: null,
  lastSubmitTime: 0,
  notifications: [],
  notifUnsub: null
};

function requireFirebase(){
  if(!isConfigured){
    showToast('Connect Firebase in firebase-config.js to enable this');
    return false;
  }
  return true;
}

/* ============ ONBOARDING ============ */
function ObShell(inner, stepIndex, total){
  const dots = Array.from({length: total}).map((_,i)=>{
    const cls = i < stepIndex ? 'done' : (i===stepIndex ? 'active' : '');
    return `<i class="${cls}"><span></span></i>`;
  }).join('');
  return `<div class="ob-card">
    <div class="brand-row"><div class="logo-mark"><img src="logo.png" alt="Junior Codex"></div><div class="name">Junior Codex</div></div>
    <div class="ob-progress">${dots}</div>
    ${inner}
  </div>`;
}

function renderOnboard(){
  const wrap = document.getElementById('onboardWrap');
  const f = state.form;
  let html = '';

  if(state.step === 0){
    html = `<div class="ob-card">
      <div class="brand-row"><div class="logo-mark"><img src="logo.png" alt="Junior Codex"></div><div class="name">Junior Codex</div></div>
      <div class="ob-eyebrow mono">&gt; a community for young coders<span class="cursor-blink">_</span></div>
      <h1>Learn, build, and hack together.</h1>
      <p class="sub">Junior Codex is where beginners write their first line of HTML and where advanced members host hackathons for everyone else. Let's get you set up — it takes two minutes.</p>
      <button class="btn btn-primary" onclick="nextStep()">Get started</button>
      <div class="inline-link" onclick="goSignIn()">Already a member? Sign in</div>
    </div>`;
  }
  else if(state.step === 'signin'){
    html = `<div class="ob-card">
      <div class="brand-row"><div class="logo-mark"><img src="logo.png" alt="Junior Codex"></div><div class="name">Junior Codex</div></div>
      <h1 style="font-size:24px;">Welcome back</h1>
      <p class="sub">Sign in to jump straight to your feed.</p>
      <div id="authError" class="banner" style="display:none;background:rgba(240,72,62,0.1);border-color:rgba(240,72,62,0.3);color:#a3291f;"></div>
      <div class="field"><label>Email</label><input id="si_email" type="email" placeholder="you@example.com"></div>
      <div class="field"><label>Password</label><input id="si_password" type="password" placeholder="••••••••"></div>
      <div class="ob-nav">
        <button class="btn btn-ghost" onclick="backToWelcome()">Back</button>
        <button class="btn btn-primary" id="signinBtn" onclick="submitSignIn()">Sign in</button>
      </div>
    </div>`;
  }
  else if(state.step === 1){
    html = ObShell(`
      <h1 style="font-size:24px;">Tell us about you</h1>
      <p class="sub">This stays visible to admins only.</p>
      <div class="grid2">
        <div class="field"><label>Full name</label><input id="f_name" type="text" value="${f.name}" placeholder="Ama Serwaa"></div>
        <div class="field"><label>Age</label><input id="f_age" type="number" value="${f.age}" placeholder="16"></div>
      </div>
      <div class="field"><label>Residence</label><input id="f_res" type="text" value="${f.residence}" placeholder="City, country"></div>
      <div class="grid2">
        <div class="field"><label>School</label><input id="f_school" type="text" value="${f.school}" placeholder="Your school"></div>
        <div class="field"><label>Level of education</label>
          <select id="f_edu">
            <option ${f.education==='JHS'?'selected':''}>JHS</option>
            <option ${f.education==='SHS'?'selected':''}>SHS</option>
            <option ${f.education==='University'?'selected':''}>University</option>
            <option ${f.education==='Self-taught'?'selected':''}>Self-taught</option>
          </select>
        </div>
      </div>
      <div class="field"><label>How did you hear about us?</label>
        <select id="f_heard">
          <option ${f.heard==='Instagram'?'selected':''}>Instagram</option>
          <option ${f.heard==='Friend'?'selected':''}>Friend</option>
          <option ${f.heard==='School club'?'selected':''}>School club</option>
          <option ${f.heard==='Other'?'selected':''}>Other</option>
        </select>
      </div>
      <div class="grid2">
        <div class="field"><label>Email</label><input id="f_email" type="email" placeholder="you@example.com"></div>
        <div class="field"><label>Password</label><input id="f_password" type="password" placeholder="At least 6 characters"></div>
      </div>
      <div class="ob-nav">
        <button class="btn btn-ghost" onclick="prevStep()">Back</button>
        <button class="btn btn-primary" onclick="saveStep1()">Continue</button>
      </div>
    `, 1, 5);
  }
  else if(state.step === 2){
    html = ObShell(`
      <h1 style="font-size:24px;">What do you already know?</h1>
      <p class="sub">Quick and informal — helps us route you to the right level.</p>
      <div class="q-block">
        <div class="qtext">Have you written any code before?</div>
        <div class="chip-wrap">
          <button class="chip" data-q="written" data-v="none" onclick="pickChip(this)">Never</button>
          <button class="chip" data-q="written" data-v="some" onclick="pickChip(this)">A little</button>
          <button class="chip" data-q="written" data-v="lots" onclick="pickChip(this)">A lot</button>
        </div>
      </div>
      <div class="q-block">
        <div class="qtext">Which areas interest you?</div>
        <div class="chip-wrap" id="interestWrap">
          <button class="chip" data-i="HTML/CSS" onclick="toggleInterest(this)">HTML/CSS</button>
          <button class="chip" data-i="JavaScript" onclick="toggleInterest(this)">JavaScript</button>
          <button class="chip" data-i="ML" onclick="toggleInterest(this)">Machine Learning</button>
          <button class="chip" data-i="Python" onclick="toggleInterest(this)">Python</button>
          <button class="chip" data-i="Game Dev" onclick="toggleInterest(this)">Game Dev</button>
        </div>
      </div>
      <div class="field"><label>Anything else? (optional)</label><input type="text" id="f_other_interest" placeholder="e.g. Robotics"></div>
      <div class="ob-nav">
        <button class="btn btn-ghost" onclick="prevStep()">Back</button>
        <button class="btn btn-primary" onclick="nextStep()">Continue</button>
      </div>
    `, 2, 5);
  }
  else if(state.step === 3){
    html = ObShell(`
      <h1 style="font-size:24px;">Hackathons</h1>
      <p class="sub">No wrong answers here.</p>
      <div class="q-block">
        <div class="qtext">Do you know what a hackathon is / been to one?</div>
        <div class="yn-row">
          <button class="btn" data-hk="yes" onclick="pickYN('hackathonKnown', this)">Yes</button>
          <button class="btn" data-hk="no" onclick="pickYN('hackathonKnown', this)">No</button>
        </div>
      </div>
      <div class="q-block">
        <div class="qtext">Interested in joining upcoming hackathons?</div>
        <div class="yn-row">
          <button class="btn" data-hi="yes" onclick="pickYN('hackInterest', this)">Yes, sign me up</button>
          <button class="btn" data-hi="no" onclick="pickYN('hackInterest', this)">Not right now</button>
        </div>
      </div>
      <div class="ob-nav">
        <button class="btn btn-ghost" onclick="prevStep()">Back</button>
        <button class="btn btn-primary" id="hackContinue" onclick="handleHackStep()" disabled>Continue</button>
      </div>
    `, 3, 5);
  }
  else if(state.step === 'declineCheck'){
    html = ObShell(`
      <h1 style="font-size:24px;">All good.</h1>
      <p class="sub">Hackathons aren't for everyone right now — would you still like to stay in the Junior Codex community?</p>
      <div class="yn-row">
        <button class="btn btn-primary" style="flex:1;justify-content:center" onclick="finishOnboard(true)">Yes, take me in</button>
        <button class="btn" style="flex:1;justify-content:center" onclick="finishOnboard(false)">No, maybe later</button>
      </div>
    `, 4, 5);
  }
  else if(state.step === 'exit'){
    html = `<div class="ob-card" style="text-align:center;">
      <div class="brand-row" style="justify-content:center;"><div class="logo-mark"><img src="logo.png" alt="Junior Codex"></div><div class="name">Junior Codex</div></div>
      <h1 style="font-size:24px;">See you around</h1>
      <p class="sub">Your spot is saved — come back anytime you're ready to jump in.</p>
      <button class="btn" onclick="state_reset()">Start over</button>
    </div>`;
  }
  else if(state.step === 4){
    html = ObShell(`
      <h1 style="font-size:24px;">You're in, ${f.name || 'coder'}.</h1>
      <p class="sub">Here's what you told us — welcome to Junior Codex.</p>
      <div class="glass" style="padding:16px;margin-bottom:20px;">
        <div style="font-size:12.5px;color:var(--muted);line-height:2;">
          <b style="color:var(--text)">${f.name||'—'}</b>, ${f.age||'—'} · ${f.residence||'—'}<br>
          ${f.school||'—'} · ${f.education||'—'}<br>
          Interested in: ${f.interests.length? f.interests.join(', ') : '—'}
        </div>
      </div>
      <div id="authError" class="banner" style="display:none;background:rgba(240,72,62,0.1);border-color:rgba(240,72,62,0.3);color:#a3291f;"></div>
      <button class="btn btn-primary" id="enterBtn" style="width:100%;justify-content:center" onclick="completeSignUp()">Enter Junior Codex</button>
    `, 4, 5);
  }

  wrap.innerHTML = html;
}

function nextStep(){ state.step++; renderOnboard(); }
function prevStep(){ if(typeof state.step==='number') state.step = Math.max(0,state.step-1); else state.step=3; renderOnboard(); }
function goSignIn(){ state.step = 'signin'; renderOnboard(); }
function backToWelcome(){ state.step = 0; renderOnboard(); }
function state_reset(){ state.step = 0; renderOnboard(); }

function friendlyAuthError(e){
  const code = (e && e.code) || '';
  if(code.includes('user-not-found') || code.includes('invalid-credential')) return "We couldn't find that account — check the email, or sign up instead.";
  if(code.includes('wrong-password')) return 'That password looks wrong.';
  if(code.includes('email-already-in-use')) return 'That email already has an account — try signing in instead.';
  if(code.includes('weak-password')) return 'Password needs to be at least 6 characters.';
  if(code.includes('invalid-email')) return 'That email address looks off.';
  return 'Something went wrong — please try again.';
}

async function submitSignIn(){
  if(!requireFirebase()) return;
  const email = document.getElementById('si_email').value.trim();
  const password = document.getElementById('si_password').value;
  const err = document.getElementById('authError');
  const btn = document.getElementById('signinBtn');
  err.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Signing in…';
  try{
    const profile = await signInMember(email, password);
    state.uid = profile.uid;
    state.profile = profile;
    state.form.name = profile.name || 'Coder';
    await enterApp();
  } catch(e){
    err.textContent = friendlyAuthError(e);
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Sign in';
  }
}

function saveStep1(){
  state.form.name = document.getElementById('f_name').value || 'Coder';
  state.form.age = document.getElementById('f_age').value;
  state.form.residence = document.getElementById('f_res').value;
  state.form.school = document.getElementById('f_school').value;
  state.form.education = document.getElementById('f_edu').value;
  state.form.heard = document.getElementById('f_heard').value;
  state.form.email = document.getElementById('f_email').value.trim();
  state.form.password = document.getElementById('f_password').value;
  nextStep();
}

function pickChip(el){
  document.querySelectorAll(`[data-q="${el.dataset.q}"]`).forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  state.form.written = el.dataset.v;
}
function toggleInterest(el){
  el.classList.toggle('active');
  const v = el.dataset.i;
  const idx = state.form.interests.indexOf(v);
  if(el.classList.contains('active') && idx===-1) state.form.interests.push(v);
  if(!el.classList.contains('active') && idx>-1) state.form.interests.splice(idx,1);
}
function pickYN(field, el){
  const attr = field==='hackathonKnown' ? 'hk' : 'hi';
  document.querySelectorAll(`[data-${attr}]`).forEach(b=>{ b.classList.remove('btn-primary'); });
  el.classList.add('btn-primary');
  state.form[field] = el.dataset[attr];
  const btn = document.getElementById('hackContinue');
  if(state.form.hackathonKnown && state.form.hackInterest) btn.disabled = false;
}
function handleHackStep(){
  if(state.form.hackInterest === 'yes'){ state.step = 4; renderOnboard(); }
  else { state.step = 'declineCheck'; renderOnboard(); }
}
function finishOnboard(stay){
  if(stay){ state.step = 4; renderOnboard(); }
  else { state.step = 'exit'; renderOnboard(); }
}

async function completeSignUp(){
  const err = document.getElementById('authError');
  if(!requireFirebase()){
    // Preview mode without a connected Firebase project — show the shell, no persistence.
    state.uid = 'preview';
    await enterApp();
    return;
  }
  const btn = document.getElementById('enterBtn');
  err.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Creating your account…';
  try{
    const f = state.form;
    const profile = await signUpMember(f.email, f.password, {
      name: f.name, age: f.age, residence: f.residence, school: f.school,
      education: f.education, heard: f.heard, written: f.written,
      interests: f.interests, hackathonKnown: f.hackathonKnown, hackInterest: f.hackInterest
    });
    state.uid = profile.uid;
    state.profile = profile;
    await enterApp();
  } catch(e){
    err.textContent = friendlyAuthError(e);
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Enter Junior Codex';
  }
}

async function handleSignOut(){
  if(isConfigured){ try{ await signOutMember(); } catch(e){} }
  Object.values(state.unsub).forEach(u => u && u());
  state.unsub = {};
  if(state.notifUnsub){ state.notifUnsub(); state.notifUnsub = null; }
  state.uid = null; state.profile = null; state.step = 0;
  document.getElementById('appShell').style.display = 'none';
  document.getElementById('onboardWrap').style.display = 'flex';
  renderOnboard();
}

/* ============ ENTER APP ============ */
async function enterApp(){
  document.getElementById('onboardWrap').style.display = 'none';
  document.getElementById('appShell').style.display = 'flex';
  document.getElementById('greetLine').textContent = `Welcome, ${state.form.name || state.profile?.name || 'coder'}`;
  buildFooter();
  goPage('home');
  buildAvatarPicker();

  if(!isConfigured){
    renderHome([]); renderLeaderboard([]); renderSuggestions([]); renderContrib([]); renderThemes([]);
    document.getElementById('chatList').innerHTML = `<div class="empty"><div class="em-icon">💬</div>Connect Firebase to enable chat</div>`;
    renderGames();
    setTimeout(openGuide, 500);
    return;
  }

  try{ await seedIfEmpty(); } catch(e){ /* best-effort */ }
  try{ await expireThroneAttempts(); } catch(e){ /* best-effort */ }

  state.unsub.events = onEvents(renderHome);
  state.unsub.leaderboard = onLeaderboard(renderLeaderboard);
  state.unsub.suggestions = onSuggestions(renderSuggestions);
  state.unsub.chats = onMyChats(state.uid, chats => {
    state.chatCache = chats;
    if(state.page==='chat' && !state.activeChatId) renderChatList();
  });
  state.unsub.contrib = onContributors(renderContrib);
  state.unsub.themes = onApprovedThemes(renderThemes);
  startNotificationListener();

  renderGames();
  setTimeout(openGuide, 500);
}

/* ============ FOOTER NAV ============ */
const NAV_ITEMS = [
  { id:'home', label:'Home', icon:'<path d="M4 11l8-7 8 7"/><path d="M6 10v9h5v-6h2v6h5v-9"/>' },
  { id:'chat', label:'Chat', icon:'<path d="M4 5h16v11H8l-4 4V5z"/>' },
  { id:'games', label:'Games', icon:'<rect x="3" y="8" width="18" height="9" rx="3"/><path d="M8 12h2M9 11v2M15 12h.01M17.5 13.5h.01"/>' },
  { id:'suggest', label:'Ideas', icon:'<path d="M9 18h6M10 22h4M12 2a6 6 0 00-3.5 10.9c.6.4 1 1 1 1.8V16h5v-1.3c0-.7.4-1.4 1-1.8A6 6 0 0012 2z"/>' },
  { id:'contrib', label:'Contrib', icon:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-3.5 3.5-6 8-6s8 2.5 8 6"/>' },
  { id:'personalize', label:'Theme', icon:'<circle cx="12" cy="12" r="9"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>' },
  { id:'settings', label:'Settings', icon:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.2-1.6l2-1.5-2-3.4-2.4.7a7 7 0 00-2.8-1.6L13 2h-4l-.6 2.6a7 7 0 00-2.8 1.6l-2.4-.7-2 3.4 2 1.5A7 7 0 003 12c0 .5 0 1 .2 1.6l-2 1.5 2 3.4 2.4-.7a7 7 0 002.8 1.6L9 22h4l.6-2.6a7 7 0 002.8-1.6l2.4.7 2-3.4-2-1.5c.2-.6.2-1.1.2-1.6z"/>' },
];
function buildFooter(){
  const el = document.getElementById('footerNav');
  el.innerHTML = NAV_ITEMS.map(n=>`
    <button class="nav-btn ${n.id==='home'?'active':''}" data-nav="${n.id}" onclick="goPage('${n.id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${n.icon}</svg>
      <span>${n.label}</span>
    </button>`).join('');
}
function goPage(id){
  state.page = id;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.nav===id));
  if(id === 'chat'){ closeThread(); renderChatList(); }
  if(id === 'settings') loadAISettings();
  document.getElementById('notifDropdown').style.display = 'none';
}

/* ============ NOTIFICATIONS ============ */

function toggleNotifications(){
  const dropdown = document.getElementById('notifDropdown');
  const isVisible = dropdown.style.display === 'block';
  dropdown.style.display = isVisible ? 'none' : 'block';
  if(!isVisible) renderNotifications();
}

function renderNotifications(){
  const list = document.getElementById('notifList');
  if(!list) return;
  if(state.notifications.length === 0){
    list.innerHTML = `<div class="empty" style="padding:30px 20px;"><div class="em-icon">🔔</div>No notifications yet</div>`;
    return;
  }
  list.innerHTML = state.notifications.map(n => `
    <div class="glass" style="padding:12px;margin:8px;border-radius:var(--radius-sm);cursor:pointer;${n.read ? 'opacity:0.7;' : ''}" onclick="handleNotificationClick('${n.id}', '${n.link || ''}')">
      <div style="font-size:12px;font-weight:600;margin-bottom:4px;">${n.title}</div>
      <div style="font-size:11px;color:var(--muted);line-height:1.4;">${n.message}</div>
      <div style="font-size:10px;color:var(--muted-2);margin-top:6px;">${timeAgo(n.createdAt?.toDate ? n.createdAt.toDate() : new Date(n.createdAt))}</div>
    </div>`).join('');
}

async function handleNotificationClick(id, link){
  await markNotificationRead(id);
  document.getElementById('notifDropdown').style.display = 'none';
  if(link){
    if(link.startsWith('/chat/')){
      const chatId = link.replace('/chat/', '');
      const otherName = 'Member';
      openThread(chatId, null, otherName);
    }
  }
}

async function markAllRead(){
  if(!requireFirebase() || !state.uid) return;
  await markAllNotificationsRead(state.uid);
  updateNotifBadge();
}

function updateNotifBadge(){
  const unread = state.notifications.filter(n => !n.read).length;
  const dot = document.getElementById('notifDot');
  const count = document.getElementById('notifCount');
  if(unread > 0){
    dot.style.display = 'none';
    count.style.display = 'block';
    count.textContent = unread > 99 ? '99+' : unread;
  } else {
    dot.style.display = 'block';
    count.style.display = 'none';
  }
}

function startNotificationListener(){
  if(state.notifUnsub) state.notifUnsub();
  state.notifUnsub = onMyNotifications(state.uid, notifications => {
    state.notifications = notifications;
    updateNotifBadge();
    if(document.getElementById('notifDropdown').style.display === 'block'){
      renderNotifications();
    }
  });
}

/* ============ HOME (live Firestore events) ============ */
function toMillis(v, fallback){
  if(!v) return fallback;
  if(v.toDate) return v.toDate().getTime();
  return new Date(v).getTime();
}
function classifyEvent(ev){
  const now = Date.now();
  const starts = toMillis(ev.startsAt, now);
  const deadline = toMillis(ev.deadline, now + 7*86400000);
  const createdAt = toMillis(ev.createdAt, now);
  if(now > deadline) return 'past';
  if(now >= starts && now <= deadline) return 'ongoing';
  if(now - createdAt < 14*86400000) return 'new';
  return 'ongoing';
}
function eventCard(ev, status){
  const cls = status==='past' ? 'event-card past' : 'event-card';
  const pill = status==='new' ? '<span class="status-pill new" style="position:absolute;top:10px;left:10px;">NEW</span>'
    : status==='ongoing' ? '<span class="status-pill live" style="position:absolute;top:10px;left:10px;">LIVE</span>' : '';
  const title = (ev.title || 'Event').replace(/'/g, '');
  return `<div class="${cls}" onclick="showToast('${title} — opening link')">
    <div class="thumb">${ev.img||'✨'}${pill}</div>
    <div class="info"><h4>${ev.title||'Untitled event'}</h4><p>${ev.place||'TBA'}</p></div>
  </div>`;
}
function renderHome(events){
  const groups = { new: [], ongoing: [], past: [] };
  events.forEach(ev => groups[classifyEvent(ev)].push(ev));
  const emptyRow = `<div class="empty" style="padding:24px 12px;"><div class="em-icon">📭</div>Nothing here yet</div>`;
  document.getElementById('row-new').innerHTML = groups.new.map(e=>eventCard(e,'new')).join('') || emptyRow;
  document.getElementById('row-ongoing').innerHTML = groups.ongoing.map(e=>eventCard(e,'ongoing')).join('') || emptyRow;
  document.getElementById('row-past').innerHTML = groups.past.map(e=>eventCard(e,'past')).join('') || emptyRow;
}

/* ============ HACKUP ============ */
let hackupUnsub;
function updateThemePreview(){
  const bg = document.getElementById('thBg')?.value || '#F6F9FD';
  const text = document.getElementById('thText')?.value || '#16213E';
  const primary = document.getElementById('thPrimary')?.value || '#0BAF77';
  const secondary = document.getElementById('thSecondary')?.value || '#E8940C';
  const name = document.getElementById('thName')?.value || 'Preview';
  
  const preview = document.getElementById('themePreview');
  if(preview){
    preview.style.background = bg;
    preview.style.color = text;
  }
  const pName = document.getElementById('previewName');
  if(pName) pName.textContent = name;
  const pText = document.getElementById('previewText');
  if(pText) pText.style.color = text;
  const pPrimary = document.getElementById('previewPrimaryBtn');
  if(pPrimary){ pPrimary.style.background = primary; pPrimary.style.color = text; }
  const pSecondary = document.getElementById('previewSecondaryBtn');
  if(pSecondary){ pSecondary.style.background = secondary; pSecondary.style.color = text; }
  
  const validation = document.getElementById('themeValidation');
  if(validation && isConfigured){
    const result = validateTheme(name, { bg, text, primaryAccent: primary, secondaryAccent: secondary });
    if(result.valid){
      validation.innerHTML = '<span style="color:var(--mint);">Looks good — ready to submit</span>';
    } else {
      validation.innerHTML = result.errors.map(e => `<div style="color:var(--coral);">${e}</div>`).join('');
    }
  }
}
function toggleDesignTheme(){
  const panel = document.getElementById('designThemePanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if(panel.style.display === 'block'){
    ['thBg','thText','thPrimary','thSecondary','thName'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.addEventListener('input', updateThemePreview);
      el?.addEventListener('change', updateThemePreview);
    });
    updateThemePreview();
  }
}
async function submitTheme(){
  if(!requireFirebase()) return;
  const name = document.getElementById('thName').value.trim();
  const colors = {
    bg: document.getElementById('thBg').value,
    text: document.getElementById('thText').value,
    primaryAccent: document.getElementById('thPrimary').value,
    secondaryAccent: document.getElementById('thSecondary').value
  };
  const userName = state.form.name || state.profile?.name || 'Member';
  const result = await submitThemeValidated(name, colors, state.uid, userName);
  if(result.submitted){
    showToast('Theme sent to admin for review');
    document.getElementById('designThemePanel').style.display = 'none';
  } else {
    const validation = document.getElementById('themeValidation');
    validation.innerHTML = result.errors.map(e => `<div style="color:var(--coral);">${e}</div>`).join('');
  }
}

/* ============ MVP'S THRONE ============ */

function openGameOverlay(game){
  state.game = game;
  document.getElementById('gameOverlay').style.display = 'block';
  document.getElementById('thronePanel').style.display = 'none';
  document.getElementById('primusPanel').style.display = 'none';
  
  if(game === "MVP's Throne"){
    document.getElementById('thronePanel').style.display = 'block';
    document.getElementById('gameOverlayTitle').textContent = "MVP's Throne";
    renderThroneSetup();
  } else if(game === 'Codex Primus'){
    document.getElementById('primusPanel').style.display = 'block';
    document.getElementById('gameOverlayTitle').textContent = 'Codex Primus';
    renderPrimusAuthor();
  }
}
function closeGameOverlay(){
  document.getElementById('gameOverlay').style.display = 'none';
  state.game = null;
  stopThroneTimer();
  stopPrimusTimer();
}

function renderThroneSetup(){
  document.getElementById('throneSetup').style.display = 'block';
  document.getElementById('throneActive').style.display = 'none';
  document.getElementById('throneResult').style.display = 'none';
  stopThroneTimer();
  state.throneAttempt = null;
  
  if(state.unsub.throne) state.unsub.throne();
  
  state.unsub.throne = onMyThroneAttempts(state.uid, attempts => {
    const active = attempts.find(a => a.status === 'active');
    if(active){
      state.throneAttempt = active;
      startThroneTimer();
    }
  });
}

async function startThrone(){
  if(!requireFirebase()) return;
  const now = Date.now();
  const deadlineVal = document.getElementById('thDeadline').value;
  const customVal = parseInt(document.getElementById('thCustomDeadline').value) || 30;
  const minutes = parseInt(deadlineVal) || customVal;
  const clamped = Math.min(Math.max(minutes, 5), 240);
  const deadlineAt = new Date(now + clamped * 60 * 1000);
  const pitch = document.getElementById('thPitch').value.trim();
  if(!pitch){ showToast('Write a pitch first'); return; }
  
  try{
    const attemptId = await createThroneAttempt(state.uid, state.form.name || state.profile?.name || 'Member', pitch, deadlineAt);
    state.throneAttempt = { id: attemptId, status: 'active', pitch, deadlineAt };
    startThroneTimer();
  } catch(e){
    showToast('Failed to start — try again');
  }
}

function updateThroneDeadline(){
  const sel = document.getElementById('thDeadline');
  const custom = document.getElementById('thCustomDeadline');
  if(sel.value !== 'custom') custom.value = sel.value;
  else sel.value = 'custom';
}

function startThroneTimer(){
  document.getElementById('throneSetup').style.display = 'none';
  document.getElementById('throneActive').style.display = 'block';
  document.getElementById('throneResult').style.display = 'none';
  document.getElementById('thActivePitch').textContent = state.throneAttempt?.pitch || '—';
  stopThroneTimer();
  
  state.throneTimer = setInterval(() => {
    const now = Date.now();
    const deadline = toMillis(state.throneAttempt?.deadlineAt, now);
    state.throneRemaining = Math.max(0, deadline - now);
    const mins = Math.floor(state.throneRemaining / 60000);
    const secs = Math.floor((state.throneRemaining % 60000) / 1000);
    const el = document.getElementById('thTimer');
    if(el) el.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    
    const code = document.getElementById('thCode')?.value || '';
    const lines = code.split('\n').filter(l => l.trim().length > 0).length;
    const lcEl = document.getElementById('thLineCount');
    if(lcEl) lcEl.textContent = `${lines} / 50 lines`;
    
    if(state.throneRemaining <= 0){
      const currentCode = document.getElementById('thCode')?.value || '';
      const currentLines = currentCode.split('\n').filter(l => l.trim().length > 0).length;
      if(currentLines > 0 && currentLines <= 50){
        submitThroneSilent(currentCode, currentLines);
      } else {
        stopThroneTimer();
        document.getElementById('throneActive').style.display = 'none';
        document.getElementById('throneResult').style.display = 'block';
        document.getElementById('throneResultContent').innerHTML = `
          <div class="glass" style="padding:24px;text-align:center;">
            <div style="font-size:30px;margin-bottom:10px;">⏰</div>
            <h4>Time's up</h4>
            <p style="color:var(--muted);font-size:13px;">Your throne has been vacated. No submission was made.</p>
          </div>`;
      }
    }
  }, 500);
}

function stopThroneTimer(){
  if(state.throneTimer){ clearInterval(state.throneTimer); state.throneTimer = null; }
}

async function submitThrone(){
  if(!requireFirebase() || !state.throneAttempt?.id) return;
  const code = document.getElementById('thCode').value || '';
  const lines = code.split('\n').filter(l => l.trim().length > 0).length;
  if(lines > 50) return;
  if(lines === 0){ showToast('Paste your solution first'); return; }
  
  stopThroneTimer();
  const result = await submitThroneCode(state.throneAttempt.id, code, lines);
  if(result.accepted){
    document.getElementById('throneActive').style.display = 'none';
    document.getElementById('throneResult').style.display = 'block';
    document.getElementById('throneResultContent').innerHTML = `
      <div class="glass" style="padding:24px;text-align:center;">
        <div style="font-size:30px;margin-bottom:10px;">🚀</div>
        <h4>Submitted</h4>
        <p style="color:var(--muted);font-size:13px;">${lines} lines — awaiting review</p>
      </div>`;
    state.throneAttempt = null;
  } else {
    showToast('Submission failed');
  }
}

async function submitThroneSilent(code, lines){
  if(!state.throneAttempt?.id) return;
  stopThroneTimer();
  try{
    await submitThroneCode(state.throneAttempt.id, code, lines);
  } catch(e){}
  document.getElementById('throneActive').style.display = 'none';
  document.getElementById('throneResult').style.display = 'block';
  document.getElementById('throneResultContent').innerHTML = `
    <div class="glass" style="padding:24px;text-align:center;">
      <div style="font-size:30px;margin-bottom:10px;">⏰</div>
      <h4>Time's up</h4>
      <p style="color:var(--muted);font-size:13px;">Your answer was auto-submitted (${lines} lines) — awaiting review</p>
    </div>`;
  state.throneAttempt = null;
}

/* ============ CODEX PRIMUS ============ */

function renderPrimusAuthor(){
  document.getElementById('primusAuthor').style.display = 'block';
  document.getElementById('primusSolve').style.display = 'none';
  document.getElementById('primusChallengeList').style.display = 'block';
  document.getElementById('primusSolveActive').style.display = 'none';
  document.getElementById('primusResult').style.display = 'none';
  document.getElementById('primusTabAuthor')?.classList.add('active');
  document.getElementById('primusTabSolve')?.classList.remove('active');
  if(state.unsub.primusMy) state.unsub.primusMy();
  if(state.unsub.primusPublic) state.unsub.primusPublic();
  stopPrimusTimer();
  state.primusChallenge = null;
  state.primusRevealed = false;
  
  state.unsub.primusMy = onMyChallenges(state.uid, challenges => {
    const list = document.getElementById('primusChallengeListContent');
    if(!list) return;
    if(challenges.length === 0){
      list.innerHTML = `<div class="empty"><div class="em-icon">🔐</div>No challenges yet</div>`;
      return;
    }
    list.innerHTML = challenges.map(c => `
      <div class="glass" style="padding:14px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:13px;font-weight:600;">${c.difficulty || 'Untitled'} ${c.difficulty ? '' : 'challenge'}</div>
            <div style="font-size:11px;color:var(--muted-2);">${c.visibility === 'public' ? 'Public' : 'Direct'} · ${c.timeLimitSec}s · ${c.attempts?.length || 0} attempts</div>
          </div>
        </div>
      </div>`).join('');
  });
}

function switchPrimusTab(tab){
  if(tab === 'author') renderPrimusAuthor();
  else renderPrimusSolver();
}

function renderPrimusSolver(){
  document.getElementById('primusAuthor').style.display = 'none';
  document.getElementById('primusSolve').style.display = 'block';
  document.getElementById('primusChallengeList').style.display = 'block';
  document.getElementById('primusSolveActive').style.display = 'none';
  document.getElementById('primusResult').style.display = 'none';
  document.getElementById('primusTabSolve')?.classList.add('active');
  document.getElementById('primusTabAuthor')?.classList.remove('active');
  stopPrimusTimer();
  state.primusChallenge = null;
  state.primusRevealed = false;
  
  if(state.unsub.primusPublic) state.unsub.primusPublic();
  state.unsub.primusPublic = onPublicChallenges(challenges => {
    const list = document.getElementById('primusChallengeListContent');
    if(!list) return;
    if(challenges.length === 0){
      list.innerHTML = `<div class="empty"><div class="em-icon">🔐</div>No public challenges yet — be the first to create one</div>`;
      return;
    }
    list.innerHTML = challenges.map(c => `
      <div class="glass" style="padding:14px;margin-bottom:10px;cursor:pointer;" onclick="openPrimusChallenge('${c.id}')">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:13px;font-weight:600;">${c.authorName || 'Anonymous'}</div>
            <div style="font-size:11px;color:var(--muted-2);">${c.difficulty ? c.difficulty + ' · ' : ''}${c.timeLimitSec}s limit</div>
          </div>
          <span class="chip" style="padding:3px 10px;font-size:10px;">${c.attempts?.length || 0} attempts</span>
        </div>
      </div>`).join('');
  }, state.uid);
}

async function createPrimusChallenge(){
  if(!requireFirebase()) return;
  const code = document.getElementById('prCode').value.trim();
  const answer = document.getElementById('prAnswer').value.trim();
  const timeLimit = parseInt(document.getElementById('prTime').value);
  const difficulty = document.getElementById('prDiff').value;
  const visibility = document.getElementById('prVis').value;
  const recipientName = document.getElementById('prRecipient')?.value?.trim() || '';
  
  if(!code){ showToast('Add a code snippet first'); return; }
  if(!answer){ showToast('Add an answer key'); return; }
  if(visibility === 'direct' && !recipientName){ showToast('Enter a recipient name'); return; }
  
  try{
    await createChallenge({
      code, answerKey: answer, authorUid: state.uid,
      authorName: state.form.name || state.profile?.name || 'Anonymous',
      visibility, recipientUid: recipientName,
      timeLimitSec: timeLimit, difficulty: difficulty || null
    });
    showToast('Challenge created');
    renderPrimusAuthor();
    document.getElementById('prCode').value = '';
    document.getElementById('prAnswer').value = '';
  } catch(e){
    showToast('Failed to create challenge');
  }
}

async function openPrimusChallenge(challengeId){
  if(!requireFirebase()) return;
  const snap = await getDoc(doc(getChallengesCol(), challengeId));
  if(!snap.exists()) return;
  const challenge = { id: snap.id, ...snap.data() };
  
  state.primusChallenge = challenge;
  state.primusRevealed = false;
  
  document.getElementById('primusChallengeList').style.display = 'none';
  document.getElementById('primusSolveActive').style.display = 'block';
  document.getElementById('primusResult').style.display = 'none';
  document.getElementById('prAuthorName').textContent = challenge.authorName || 'Anonymous';
  document.getElementById('prCodeReveal').textContent = challenge.code;
  document.getElementById('prAnswerInput').value = '';
  stopPrimusTimer();
  
  state.primusRevealed = true;
  const now = Date.now();
  const limit = challenge.timeLimitSec * 1000;
  const deadline = now + limit;
  
  state.primusTimer = setInterval(() => {
    const remaining = Math.max(0, deadline - Date.now());
    state.primusRemaining = remaining;
    const secs = Math.ceil(remaining / 1000);
    const el = document.getElementById('prTimer');
    if(el) el.textContent = `${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`;
    
    if(remaining <= 0){
      const answer = document.getElementById('prAnswerInput')?.value?.trim() || '';
      submitPrimusSilent(challenge.id, answer, deadline);
    }
  }, 500);
}

async function submitPrimusAnswer(){
  if(!state.primusChallenge?.id || !state.primusRevealed) return;
  const answer = document.getElementById('prAnswerInput').value.trim();
  if(!answer){ showToast('Write an answer first'); return; }
  stopPrimusTimer();
  await submitPrimusSilent(state.primusChallenge.id, answer, Date.now() - state.primusRemaining + (state.primusChallenge.timeLimitSec * 1000));
}

async function submitPrimusSilent(challengeId, answer, revealedAt){
  stopPrimusTimer();
  try{
    const attemptId = await submitChallengeAnswer(challengeId, state.uid, answer, revealedAt);
    const isCorrect = answer.toLowerCase().includes(state.primusChallenge?.answerKey?.toLowerCase()?.substring(0, 20) || '') || 
                      answer.trim().toLowerCase() === state.primusChallenge?.answerKey?.trim().toLowerCase();
    
    await gradeChallengeAttempt(attemptId, isCorrect);
    if(isCorrect) await addPoints(state.uid, 5);
    
    document.getElementById('primusSolveActive').style.display = 'none';
    document.getElementById('primusResult').style.display = 'block';
    document.getElementById('primusResultContent').innerHTML = `
      <div class="glass" style="padding:24px;text-align:center;">
        <div style="font-size:30px;margin-bottom:10px;">${isCorrect ? '✅' : '❌'}</div>
        <h4>${isCorrect ? 'Correct!' : 'Not quite'}</h4>
        <p style="color:var(--muted);font-size:13px;">${isCorrect ? '+5 points' : 'Keep practicing — you can try another challenge'}</p>
        <button class="btn btn-sm" onclick="renderPrimusSolver()" style="margin-top:14px;">Back to challenges</button>
      </div>`;
  } catch(e){
    showToast('Already attempted this challenge');
    renderPrimusSolver();
  }
  state.primusChallenge = null;
  state.primusRevealed = false;
}

function stopPrimusTimer(){
  if(state.primusTimer){ clearInterval(state.primusTimer); state.primusTimer = null; }
}

/* ============ AI CHAT ============ */

async function openAIChat(){
  document.getElementById('aiChatOverlay').style.display = 'flex';
  document.getElementById('aiMessages').innerHTML = `<div class="empty-msgs">Ask me anything — I'll use your saved AI provider.</div>`;
  document.getElementById('aiChatInput').focus();
}

function closeAIChat(){
  document.getElementById('aiChatOverlay').style.display = 'none';
}

async function sendAIChat(){
  const input = document.getElementById('aiChatInput');
  const text = input.value.trim();
  if(!text) return;
  
  const profile = state.profile;
  const provider = profile?.aiProvider;
  const apiKey = profile?.aiApiKey;
  const model = profile?.aiModel;
  
  if(!provider || !apiKey){
    showToast('Save an AI provider + key in Settings first');
    return;
  }
  
  const messagesDiv = document.getElementById('aiMessages');
  messagesDiv.innerHTML += `<div class="msg-bubble mine" style="align-self:flex-end;background:var(--mint-dim);color:var(--mint);padding:10px 15px;border-radius:16px 16px 4px 16px;font-size:13.5px;margin-bottom:10px;">${text.replace(/</g,'&lt;')}</div>`;
  input.value = '';
  
  try{
    const history = (messagesDiv.dataset.history || '').split('\n').filter(Boolean);
    history.push(`user: ${text}`);
    messagesDiv.dataset.history = history.join('\n');
    
    const messages = history.map(h => {
      const [role, ...content] = h.split(': ');
      return { role, content: content.join(': ') };
    }).filter(m => m.role && m.content);
    
    const reply = await callAI({ provider, apiKey, model: model || undefined, messages });
    messagesDiv.innerHTML += `<div class="msg-bubble theirs" style="align-self:flex-start;background:var(--panel-strong);border:1px solid var(--border-soft);padding:10px 15px;border-radius:16px 16px 16px 4px;font-size:13.5px;margin-bottom:10px;">${reply.replace(/</g,'&lt;')}</div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  } catch(e){
    messagesDiv.innerHTML += `<div class="msg-bubble theirs" style="align-self:flex-start;background:rgba(240,72,62,0.1);color:var(--coral);padding:10px 15px;border-radius:16px 16px 16px 4px;font-size:13.5px;margin-bottom:10px;">Error: ${e.message}</div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

/* ============ GAMES LIST ============ */
function setSort(mode){
  state.gameSort = mode;
  document.getElementById('sortPlayed')?.classList.toggle('active', mode==='played');
  document.getElementById('sortPopular')?.classList.toggle('active', mode==='popular');
  renderGames();
}
function renderGames(){
  document.getElementById('gameGrid').innerHTML = GAMES.map(g=>`
    <div class="glass game-card">
      <div class="g-icon">${g.icon}</div>
      <h4>${g.name}</h4>
      <p>${g.desc}</p>
      <div class="game-meta"><span class="mono">${g.type}</span></div>
      <div class="game-actions">
        <button class="btn btn-primary btn-sm" onclick="openGameOverlay('${g.name}')">Play</button>
        <button class="btn btn-sm" onclick="showToast('Looking for a room...')">Join</button>
        <button class="btn btn-sm btn-ghost" title="Demo: earn points" onclick="winGame('${g.name}')">+5 pts</button>
      </div>
    </div>`).join('');
}
async function hostGame(name){
  if(!requireFirebase()) return;
  await hostGameRoom(name, state.uid, state.form.name || state.profile?.name || 'Member');
  showToast(`Hosting ${name} — room is open`);
}
async function joinGame(roomId){
  if(!requireFirebase()) return;
  if(!roomId){ showToast('Looking for a room...'); return; }
  await joinGameRoom(roomId, state.uid);
  showToast('Joined room');
}
async function winGame(name){
  if(!requireFirebase()) return;
  await addPoints(state.uid, 5);
  showToast(`+5 points from ${name}`);
}
function renderLeaderboard(users){
  document.getElementById('leaderboard').innerHTML = users.map((u,i)=>`
    <div class="lb-row">
      <div class="lb-rank ${i===0?'top':''}">#${i+1}</div>
      <div class="lb-avatar">${AVATARS[i%AVATARS.length]}</div>
      <div class="lb-name">${u.name||'Member'}${u.tag?`<span class="lb-tag">${u.tag}</span>`:''}</div>
      <div class="lb-pts mono">${u.points||0} pts</div>
    </div>`).join('') || `<div class="empty"><div class="em-icon">🏆</div>No scores yet — be the first</div>`;
}

/* ============ SUGGESTIONS ============ */
async function postSuggestion(){
  if(!requireFirebase()) return;
  const box = document.getElementById('sugText');
  const txt = box.value.trim();
  if(!txt) return;
  box.value = '';
  await addSuggestion(state.uid, state.form.name || state.profile?.name || 'Member', txt);
  showToast('Suggestion sent to admin');
}
async function react(id, emoji){
  if(!requireFirebase()) return;
  await reactToSuggestion(id, emoji);
}
function timeAgo(date){
  const secs = Math.floor((Date.now() - date.getTime())/1000);
  if(secs < 60) return 'just now';
  if(secs < 3600) return Math.floor(secs/60) + 'm ago';
  if(secs < 86400) return Math.floor(secs/3600) + 'h ago';
  return Math.floor(secs/86400) + 'd ago';
}
function renderSuggestions(list){
  document.getElementById('sugList').innerHTML = list.map((s,i)=>`
    <div class="glass sug-card">
      <div class="sug-head">
        <div class="lb-avatar">${AVATARS[i%AVATARS.length]}</div>
        <div class="who">${s.who}</div>
        <div class="when">${s.createdAt?.toDate ? timeAgo(s.createdAt.toDate()) : 'just now'}</div>
      </div>
      <div class="sug-text">${s.text}</div>
      <div class="reactions">
        ${['🔥','💡','👏'].map(e=>`<button class="react-btn" onclick="react('${s.id}','${e}')">${e} ${s.reactions?.[e]||''}</button>`).join('')}
      </div>
    </div>`).join('') || `<div class="empty"><div class="em-icon">💡</div>No suggestions yet — add the first one</div>`;
}

/* ============ CHAT ============ */
let searchDebounce;
function otherUid(chat){ return (chat.participants||[]).find(p => p !== state.uid); }

function handleChatSearch(){
  const q = document.getElementById('chatSearch').value.trim();
  const results = document.getElementById('chatSearchResults');
  clearTimeout(searchDebounce);
  if(!q){ results.innerHTML = ''; return; }
  if(!requireFirebase()){ results.innerHTML = ''; return; }
  searchDebounce = setTimeout(async () => {
    const found = (await searchUsers(q, state.uid)).filter(u => !(state.profile?.blocked||[]).includes(u.uid));
    results.innerHTML = found.map((u,i)=>`
      <div class="glass search-result-row" style="cursor:pointer;" onclick="startChat('${u.uid}','${(u.name||'Member').replace(/'/g,"")}')">
        <div class="lb-avatar">${AVATARS[i%AVATARS.length]}</div>
        <div class="name">${u.name||'Member'}</div>
        <span class="chip">Message</span>
      </div>`).join('') || `<div class="empty" style="padding:20px;"><div class="em-icon">🔍</div>No members match "${q}"</div>`;
  }, 250);
}

function renderChatList(){
  const list = state.chatCache.filter(c => !(state.profile?.blocked||[]).includes(otherUid(c)));
  document.getElementById('chatList').innerHTML = list.map((c,i)=>{
    const otherName = c.participantNames?.[otherUid(c)] || 'Member';
    return `<div class="glass chat-item" onclick="openThread('${c.id}','${otherUid(c)}','${otherName.replace(/'/g,"")}')">
      <div class="lb-avatar">${AVATARS[i%AVATARS.length]}</div>
      <div class="meta">
        <div class="top"><span class="name">${otherName}</span></div>
        <div class="last">${c.lastMessage || 'Say hello 👋'}</div>
      </div>
    </div>`;
  }).join('') || `<div class="empty"><div class="em-icon">💬</div>No chats yet — search a member above to start one</div>`;
}

async function startChat(uid, name){
  if(!requireFirebase()) return;
  document.getElementById('chatSearch').value = '';
  document.getElementById('chatSearchResults').innerHTML = '';
  const chatId = await openOrCreateChat(state.uid, state.form.name || state.profile?.name || 'Member', uid, name);
  openThread(chatId, uid, name);
}
function openThread(chatId, otherUidVal, name){
  state.activeChatId = chatId;
  state.activeOtherUid = otherUidVal;
  state.activeOtherName = name;
  document.getElementById('chatListView').style.display = 'none';
  document.getElementById('chatThread').classList.add('active');
  document.getElementById('threadName').textContent = name;
  document.getElementById('threadAvatar').textContent = AVATARS[Math.abs(hashCode(name))%AVATARS.length];
  if(state.unsub.messages) state.unsub.messages();
  state.unsub.messages = onMessages(chatId, renderMessages);
}
function hashCode(str){ let h=0; for(let i=0;i<str.length;i++){ h = ((h<<5)-h) + str.charCodeAt(i); h|=0; } return h; }
function closeThread(){
  state.activeChatId = null;
  if(state.unsub.messages){ state.unsub.messages(); state.unsub.messages = null; }
  document.getElementById('chatListView').style.display = 'block';
  document.getElementById('chatThread').classList.remove('active');
}
function renderMessages(messages){
  const wrap = document.getElementById('threadMessages');
  wrap.innerHTML = messages.map(m => `
    <div class="msg-bubble ${m.from===state.uid?'mine':'theirs'}">${m.text}</div>
  `).join('') || `<div class="empty-msgs">Say hi 👋</div>`;
  wrap.scrollTop = wrap.scrollHeight;
}
async function sendThreadMessage(){
  if(!requireFirebase()) return;
  const input = document.getElementById('threadInput');
  const text = input.value.trim();
  if(!text || !state.activeChatId) return;
  input.value = '';
  await sendMessage(state.activeChatId, state.uid, text);
  if(state.activeOtherUid && isConfigured){
    const name = state.form.name || state.profile?.name || 'Member';
    broadcastChatNotification(state.activeChatId, state.uid, name, text.substring(0, 100));
  }
}
async function blockActiveChat(){
  if(!requireFirebase() || !state.activeOtherUid) return;
  await blockUser(state.uid, state.activeOtherUid);
  if(state.profile) state.profile.blocked = [...(state.profile.blocked||[]), state.activeOtherUid];
  showToast(`${state.activeOtherName} blocked`);
  closeThread();
  renderChatList();
}

/* ============ SETTINGS ============ */
function buildAvatarPicker(){
  document.getElementById('avatarPicker').innerHTML = AVATARS.map((a,i)=>
    `<div class="avatar-opt ${i===state.avatarSel?'sel':''}" onclick="selectAvatar(${i})">${a}</div>`).join('');
}
function selectAvatar(i){ state.avatarSel = i; buildAvatarPicker(); }

function toggleAIKeyField(){
  const provider = document.getElementById('aiProvider')?.value;
  document.getElementById('aiKeyField').style.display = provider ? 'block' : 'none';
  document.getElementById('aiModelField').style.display = provider ? 'block' : 'none';
  if(provider === 'gemini'){
    document.getElementById('aiModel').placeholder = 'gemini-2.0-flash';
  } else if(provider === 'openai'){
    document.getElementById('aiModel').placeholder = 'gpt-4o-mini';
  } else if(provider === 'deepseek'){
    document.getElementById('aiModel').placeholder = 'deepseek-chat';
  }
}

function loadAISettings(){
  const profile = state.profile;
  if(!profile) return;
  const provider = profile.aiProvider || '';
  const apiKey = profile.aiApiKey || '';
  const model = profile.aiModel || '';
  document.getElementById('aiProvider').value = provider;
  document.getElementById('aiApiKey').value = apiKey;
  document.getElementById('aiModel').value = model;
  toggleAIKeyField();
}

async function saveAISettings(){
  if(!requireFirebase()) return;
  const provider = document.getElementById('aiProvider')?.value;
  const apiKey = document.getElementById('aiApiKey')?.value?.trim();
  const model = document.getElementById('aiModel')?.value?.trim();
  if(!provider || !apiKey){ showToast('Pick a provider and paste a key'); return; }
  await updateProfile(state.uid, { aiProvider: provider, aiApiKey: apiKey, aiModel: model || null });
  showToast('AI settings saved');
}

async function testAISettings(){
  if(!requireFirebase()) return;
  const provider = document.getElementById('aiProvider')?.value;
  const apiKey = document.getElementById('aiApiKey')?.value?.trim();
  const model = document.getElementById('aiModel')?.value?.trim();
  if(!provider || !apiKey){ showToast('Pick a provider and paste a key first'); return; }
  showToast('Testing...');
  try{
    const reply = await callAI({
      provider, apiKey, model: model || undefined,
      messages: [{ role: 'user', content: 'Say "AI is working" in exactly 3 words.' }]
    });
    showToast(`AI responded: ${reply?.substring(0, 60) || 'empty response'}`);
  } catch(e){
    showToast(`Test failed: ${e.message}`);
  }
}

async function saveSettings(){
  if(!requireFirebase()) return;
  const bio = document.getElementById('setBio')?.value || '';
  const prefs = {};
  document.querySelectorAll('[data-pref]').forEach(el => { prefs[el.dataset.pref] = el.classList.contains('on'); });
  await updateProfile(state.uid, { bio, avatarIndex: state.avatarSel, prefs });
  showToast('Profile saved');
}

/* ============ CONTRIBUTORS / PERSONALIZE ============ */
function renderContrib(list){
  document.getElementById('contribList').innerHTML = list.map((c,i)=>`
    <div class="glass contrib-card">
      <div class="lb-avatar">${AVATARS[i%AVATARS.length]}</div>
      <div><h4>${c.name}</h4><p>${c.desc}</p></div>
    </div>`).join('') || `<div class="empty"><div class="em-icon">🛠️</div>No contributions yet</div>`;
}
function renderThemes(list){
  document.getElementById('themeGrid').innerHTML = list.map(t=>`
    <div class="theme-swatch">
      <div class="dotrow">${(t.colors||[]).map(c=>`<div style="background:${c}"></div>`).join('')}</div>
      <span>${t.name}</span>
    </div>`).join('') + `<div class="theme-swatch" style="border-style:dashed;cursor:pointer;" onclick="toggleDesignTheme()">
      <div style="font-size:20px;margin-bottom:8px;">+</div><span>Design your own</span>
    </div>`;
}
function toggleProposeGame(){
  const panel = document.getElementById('proposeGamePanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}
async function submitProposeGame(){
  if(!requireFirebase()) return;
  const name = document.getElementById('pgName').value.trim();
  const desc = document.getElementById('pgDesc').value.trim();
  if(!name || !desc){ showToast('Add a name and description first'); return; }
  await submitPending('game', state.uid, state.form.name || state.profile?.name || 'Member', name, desc);
  document.getElementById('pgName').value = ''; document.getElementById('pgDesc').value = '';
  document.getElementById('proposeGamePanel').style.display = 'none';
  showToast('Sent to admin for review');
}
/* ============ TOAST ============ */
let toastTimer;
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove('show'), 2200);
}

/* ============ FIRST-TIME GUIDE ============ */
const GUIDE_STEPS = [
  { title:'This is your Home', text:'New, ongoing and past events live here, grouped into sessions so you always know what to jump into.' },
  { title:'Everything else is one tap away', text:'Chat, Games, Ideas, Contributors and Theme all sit in the footer — thumb-friendly, always visible.' },
  { title:'Games earn you points', text:"Host or join Hackup, MVP's Throne, or Codex Primus. Winning a round adds points to the live leaderboard." },
  { title:"You're set", text:'Explore at your own pace — your first suggestion or theme could be the next one live for everyone.' },
];
function openGuide(){
  state.guideStep = 0;
  document.getElementById('guideOverlay').classList.add('show');
  renderGuide();
}
function renderGuide(){
  const s = GUIDE_STEPS[state.guideStep];
  const last = state.guideStep === GUIDE_STEPS.length-1;
  document.getElementById('guideCard').innerHTML = `
    <div class="g-step">STEP ${state.guideStep+1} OF ${GUIDE_STEPS.length}</div>
    <h4>${s.title}</h4>
    <p>${s.text}</p>
    <div class="guide-nav">
      <button class="btn btn-ghost btn-sm" onclick="closeGuide()">Skip</button>
      <button class="btn btn-primary btn-sm" onclick="${last?'closeGuide()':'guideNext()'}">${last?'Start exploring':'Next'}</button>
    </div>`;
}
function guideNext(){ state.guideStep++; renderGuide(); }
function closeGuide(){ document.getElementById('guideOverlay').classList.remove('show'); }

/* ============ BOOTSTRAP ============ */
if(!isConfigured){
  document.getElementById('configBanner').style.display = 'block';
  renderOnboard();
} else {
  watchAuth(async (user) => {
    if(user){
      const profile = await getProfile(user.uid);
      if(profile){
        state.uid = user.uid;
        state.profile = profile;
        state.form.name = profile.name || 'Coder';
        await enterApp();
        return;
      }
    }
    renderOnboard();
  });
}

/* ============ EXPOSE TO INLINE onclick HANDLERS ============ */
Object.assign(window, {
  nextStep, prevStep, goSignIn, backToWelcome, state_reset, submitSignIn, saveStep1, pickChip, toggleInterest,
  pickYN, handleHackStep, finishOnboard, completeSignUp, handleSignOut, goPage, setSort, toggleProposeGame,
  submitProposeGame, hostGame, joinGame, winGame, postSuggestion, react, handleChatSearch, startChat, openThread,
  closeThread, sendThreadMessage, blockActiveChat, selectAvatar, saveSettings, toggleDesignTheme, submitTheme,
  showToast, closeGuide, guideNext,
  openGameOverlay, closeGameOverlay, updateThroneDeadline, startThrone, submitThrone,
  createPrimusChallenge, openPrimusChallenge, submitPrimusAnswer, renderPrimusSolver, renderPrimusAuthor, switchPrimusTab,
  openAIChat, closeAIChat, sendAIChat, saveAISettings, testAISettings, loadAISettings, toggleAIKeyField,
  toggleNotifications, markAllRead, handleNotificationClick
});
