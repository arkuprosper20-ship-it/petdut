/* ============ STATIC CATALOG ============ */
/* Only things that don't need a database: avatar emoji set and the
   fixed game catalog. Users, events, suggestions, chats, contributors,
   themes, and pending approvals all live in Firestore — see firebase.js */

export const AVATARS = ['🦊','🐙','🐝','🦉','🐼','🦁'];

export const GAMES = [
  {icon:'🧵', name:'Hackup', desc:'Design your own app theme and ship it — pass the code check and it goes live for everyone.', type:'Run-free'},
  {icon:'👑', name:"MVP's Throne", desc:'Pitch an idea, set your own deadline. Strict scope: under 50 lines or the game rejects your entry.', type:'Hack'},
  {icon:'🔐', name:'Codex Primus', desc:"Publish hidden code for others to decode within a time limit — or take on someone else's.", type:'Hack'},
];
