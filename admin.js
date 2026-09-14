/* ============ admin.js — admin dashboard, wired to Firebase ============ */
import {
  isConfigured, watchAuth, signInMember, signOutMember, getProfile,
  onAllUsers, onEvents, postEvent, onPending, approvePending, declinePending,
  uploadAsset, seedIfEmpty,
  approveThroneAttempt, declineThroneAttempt, approvePrimusAttempt, declinePrimusChallenge,
  broadcastEventNotification, broadcastApprovalNotification, broadcastDeclineNotification
} from './firebase.js';

const adminState = { tab: 'users', users: [], events: [] };

function requireFirebase(){
  if(!isConfigured){
    showToast('Connect Firebase in firebase-config.js to enable this');
    return false;
  }
  return true;
}

/* ============ TABS ============ */
function setAdminTab(tab){
  adminState.tab = tab;
  document.querySelectorAll('[data-atab]').forEach(b=>b.classList.toggle('active', b.dataset.atab===tab));
  document.querySelectorAll('.admin-tab').forEach(t=>t.style.display='none');
  document.getElementById('admin-'+tab).style.display='block';
}

/* ============ STATS + MEMBERS ============ */
function renderStats(){
  const users = adminState.users;
  const topPoints = users.reduce((m,u)=>Math.max(m,u.points||0),0);
  const liveEvents = adminState.events.filter(ev=>{
    const now = Date.now();
    const starts = toMillis(ev.startsAt, now);
    const deadline = toMillis(ev.deadline, now+7*86400000);
    return now>=starts && now<=deadline;
  }).length;
  document.getElementById('statUsers').textContent = users.length;
  document.getElementById('statTopPoints').textContent = topPoints;
  document.getElementById('statLiveEvents').textContent = liveEvents;
}
function toMillis(v, fallback){
  if(!v) return fallback;
  if(v.toDate) return v.toDate().getTime();
  return new Date(v).getTime();
}
function buildUserTable(users){
  adminState.users = users;
  document.getElementById('userTableBody').innerHTML = users.map(u=>`
    <tr>
      <td>${u.name||'Member'}${u.tag?`<span class="lb-tag" style="margin-left:6px;">${u.tag}</span>`:''}</td>
      <td>${u.level||'—'}</td>
      <td>${(u.interests||[]).join(', ')||'—'}</td>
      <td class="mono" style="color:var(--mint);font-weight:600;">${u.points||0}</td>
      <td>${u.heard||'—'}</td>
      <td><button class="btn btn-sm" onclick="showToast('${(u.name||'Member').replace(/'/g,"")} — full profile view coming soon')">View</button></td>
    </tr>`).join('') || `<tr><td colspan="6"><div class="empty"><div class="em-icon">👥</div>No members yet</div></td></tr>`;
  renderStats();
}

/* ============ EVENTS (Home feed classification, shared logic with app.js) ============ */
function trackEvents(events){
  adminState.events = events;
  renderStats();
}

/* ============ PENDING APPROVALS ============ */
function renderPending(items){
  document.getElementById('pendingList').innerHTML = items.map(p=>`
    <div class="glass pending-row" style="margin-bottom:10px;">
      <div class="lb-avatar">${(p.submittedByName||'?')[0]}</div>
      <div class="who">
        <div class="name">${p.name} <span class="chip" style="padding:2px 8px;font-size:10px;">${p.type}</span></div>
        <div class="desc">${p.desc} — submitted by ${p.submittedByName||'a member'}</div>
      </div>
      <button class="btn btn-sm btn-primary" onclick="handleApprove('${p.id}')">Approve</button>
      <button class="btn btn-sm" onclick="handleDecline('${p.id}')">Decline</button>
    </div>`).join('') || `<div class="empty"><div class="em-icon">✅</div>Nothing waiting on review</div>`;
  document.getElementById('statPending').textContent = items.length;
  adminState.pending = items;
}
async function handleApprove(id){
  if(!requireFirebase()) return;
  const item = (adminState.pending||[]).find(p=>p.id===id);
  if(!item) return;
  await approvePending(item);
  if(item.type === 'throne'){
    showToast('Throne attempt approved — points credited');
  } else if(item.type === 'primus'){
    showToast('Primus challenge approved — points credited');
  } else {
    showToast(item.type==='theme' ? 'Theme approved and live' : 'Moved to contributors');
  }
  const typeLabel = item.type === 'theme' ? 'Theme' : item.type === 'game' ? 'Game proposal' : item.type === 'throne' ? 'Throne attempt' : 'Primus challenge';
  try{ await broadcastApprovalNotification(item.submittedByUid, typeLabel, item.name); } catch(e){}
}
async function handleDecline(id){
  if(!requireFirebase()) return;
  const item = (adminState.pending||[]).find(p=>p.id===id);
  await declinePending(id);
  showToast('Declined');
  if(item){
    const typeLabel = item.type === 'theme' ? 'Theme' : item.type === 'game' ? 'Game proposal' : item.type === 'throne' ? 'Throne attempt' : 'Primus challenge';
    try{ await broadcastDeclineNotification(item.submittedByUid, typeLabel, item.name); } catch(e){}
  }
}

/* ============ POST EVENT ============ */
async function handlePostEvent(){
  if(!requireFirebase()) return;
  const title = document.getElementById('evTitle').value.trim();
  const place = document.getElementById('evPlace').value.trim();
  const startsAt = document.getElementById('evStart').value;
  const deadline = document.getElementById('evDeadline').value;
  const link = document.getElementById('evLink').value.trim();
  if(!title){ showToast('Give the event a title first'); return; }
  const eventId = await postEvent({
    title, place: place || 'TBA', link,
    startsAt: startsAt ? new Date(startsAt) : null,
    deadline: deadline ? new Date(deadline) : null,
    img: '✨'
  });
  showToast('Event posted — live on member Home instantly');
  ['evTitle','evPlace','evStart','evDeadline','evLink'].forEach(id=>document.getElementById(id).value='');
  try{ await broadcastEventNotification(eventId, title); } catch(e){ /* best-effort */ }
}

/* ============ UPLOADS (real Firebase Storage) ============ */
async function handleUpload(category, inputId, statusId, barId){
  if(!requireFirebase()) return;
  const input = document.getElementById(inputId);
  const file = input.files[0];
  if(!file){ showToast('Choose a file first'); return; }
  const status = document.getElementById(statusId);
  const bar = document.getElementById(barId);
  status.textContent = 'Uploading…';
  try{
    await uploadAsset(category, file, pct => { bar.style.width = pct + '%'; status.textContent = pct + '%'; });
    status.textContent = 'Uploaded ✓';
    showToast(`${file.name} uploaded to ${category}`);
    input.value = '';
    setTimeout(()=>{ bar.style.width='0%'; status.textContent=''; }, 1800);
  } catch(e){
    status.textContent = 'Failed — check Storage rules';
    showToast('Upload failed — see console');
    console.error(e);
  }
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

/* ============ AUTH GATE + BOOTSTRAP ============ */
function friendlyAuthError(e){
  const code = (e && e.code) || '';
  if(code.includes('user-not-found') || code.includes('invalid-credential')) return "We couldn't find that account — sign up as a member first.";
  if(code.includes('wrong-password')) return 'That password looks wrong.';
  if(code.includes('invalid-email')) return 'That email address looks off.';
  return 'Something went wrong — please try again.';
}
async function handleGateSignIn(){
  if(!requireFirebase()) return;
  const email = document.getElementById('ga_email').value.trim();
  const password = document.getElementById('ga_password').value;
  const err = document.getElementById('authError');
  const btn = document.getElementById('gateSigninBtn');
  err.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Signing in…';
  try{
    await signInMember(email, password);
    // watchAuth's listener picks up the new session and renders the dashboard
  } catch(e){
    err.textContent = friendlyAuthError(e);
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Sign in';
  }
}

async function handleSignOut(){
  if(isConfigured){ try{ await signOutMember(); } catch(e){} }
  window.location.href = 'index.html';
}

if(!isConfigured){
  document.getElementById('configBanner').style.display = 'block';
  document.getElementById('adminMain').style.display = 'block';
  setAdminTab('users');
} else {
  watchAuth(async (user) => {
    if(!user){
      document.getElementById('authGate').style.display = 'flex';
      document.getElementById('adminMain').style.display = 'none';
      return;
    }
    document.getElementById('authGate').style.display = 'none';
    document.getElementById('adminMain').style.display = 'block';
    try{ await seedIfEmpty(); } catch(e){ /* best-effort */ }
    onAllUsers(buildUserTable);
    onEvents(trackEvents);
    onPending(renderPending);
    setAdminTab('users');
  });
}

/* ============ EXPOSE TO INLINE onclick HANDLERS ============ */
Object.assign(window, {
  setAdminTab, handleApprove, handleDecline, handlePostEvent, handleUpload, handleGateSignIn, handleSignOut, showToast,
  approveThroneAttempt, declineThroneAttempt, approvePrimusAttempt, declinePrimusChallenge
});
