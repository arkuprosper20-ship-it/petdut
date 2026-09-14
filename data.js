/* ============ STATIC CATALOG ============ */
/* Only things that don't need a database: avatar emoji set, the
   fixed game catalog, and first-party theme presets. Users, events,
   suggestions, chats, contributors, member themes, and pending approvals
   all live in Firestore — see firebase.js */

export const AVATARS = ['🦊','🐙','🐝','🦉','🐼','🦁'];

export const GAMES = [
  {icon:'🧵', name:'Hackup', desc:'Pick a starter template, write a real page (HTML + CSS + JS), then run the built-in code check: contrast, responsive, and no broken tags. Pass it and your theme goes live for everyone.', type:'Solo build', level:'Beginner', how:'Open Hackup → pick a template (Personal Card / Event Poster / Mini Quiz) → write your code in the editor → Run check → fix what fails → Submit. The check requires: readable text contrast (4.5:1), a mobile @media rule, and balanced HTML tags. Admin approves passing entries.', win:'Theme approved → Contributor credit + 5 pts.'},
  {icon:'👑', name:"MVP's Throne", desc:'Pitch a micro-app idea, get a countdown, and ship it in under 50 lines. The checker counts real code lines and rejects padding.', type:'Timed build', level:'Intermediate', how:'Open the game → pitch your idea in one line → set a deadline (5 min–4 hrs) → write your build in the code box → submit before the timer hits zero. Fewer, denser lines score better. The admin reviews the entry and approves real builds.', win:'Approved build → 5 pts + leaderboard climb.'},
  {icon:'🔐', name:'Codex Primus', desc:"Hide a snippet behind a question, lock it with a timer — or crack someone else's. Answers are checked blind against the author's key.", type:'Duel', level:'Advanced', how:'Author: paste a short snippet, write what it outputs, set a time limit. Solver: open a challenge → Reveal code → study it against the clock → type what it does/outputs → Submit. One attempt per challenge; the timer auto-submits at zero.', win:'Correct decode → 5 pts; authoring a solved challenge → Contributor credit.'},
];

/* First-party theme presets — always available, never need admin approval.
   Member submissions (via Hackup) join these in the Personalize gallery. */
export const BUILT_IN_THEMES = [
  { name:'Junior Classic', colors:['#F4F5F7','#16213E','#6C3CE0','#0BAF77'], blurb:'The default Devpost-style look. Clean, bright, for everyone.' },
  { name:'Terminal Night', colors:['#0B0F1A','#E6F1E9','#2DE1A7','#7C5CFF'], blurb:'Deep navy, mint-green accents. For night owls and hacker-culture fans.' },
  { name:'Sunrise Sprint', colors:['#FFF8F0','#3A2A1A','#FF6B4A','#F5A623'], blurb:'Warm coral-to-amber energy. Playful, beginner-friendly.' },
  { name:'Blueprint', colors:['#FFFFFF','#1B3A6B','#2456D6','#0BAF77'], blurb:'Engineering-grid white, blue-ink accents. Learn-to-build vibes.' },
  { name:'Mint Paper', colors:['#F2FBF6','#22352C','#0BAF77','#FFC145'], blurb:'Soft pastel mint/cream. Gentle and approachable.' },
];
