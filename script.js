// ══════════════════════════════════════════════════════════
// STATE & STORAGE
// ══════════════════════════════════════════════════════════
const AVATARS = ['🦁','🐯','🦊','🐺','🦅','🐉','⚡','🔥','💎','🌟','🎯','🚀','🏆','🌊','🎭','🦋','🐬','🦖','🤖','🎪','🌙','☄️','🎸','🔮'];
const STORAGE_KEY = 'edubattle_v1';

function loadDB(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {users:[],globalStats:{users:0,duels:0,quizzes:0}}; }
  catch(e){ return {users:[],globalStats:{users:0,duels:0,quizzes:0}}; }
}
function saveDB(db){ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }

let db = loadDB();
let currentUser = null;
let activeQuiz = null;
let quizTimer = null;

// ══════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(id==='screen-landing') refreshLandingStats();
}

function switchTab(name){
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  document.querySelector(`[data-tab="${name}"]`)?.classList.add('active');
  document.getElementById(`tab-${name}`)?.classList.add('active');
  if(name==='defis') renderChallenges();
  if(name==='classement') renderRanking('mondial', document.querySelector('.rank-tab-btn.active'));
  if(name==='profil') renderProfile();
}

// ══════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════
function initAvatarGrid(){
  const g = document.getElementById('avatar-grid');
  g.innerHTML = AVATARS.map((a,i)=>
    `<div class="avatar-opt" data-av="${a}" onclick="selectAvatar('${a}',this)">${a}</div>`
  ).join('');
}
initAvatarGrid();
let selectedAvatar = AVATARS[0];
document.querySelector('.avatar-opt').classList.add('selected');

function selectAvatar(av, el){
  document.querySelectorAll('.avatar-opt').forEach(e=>e.classList.remove('selected'));
  el.classList.add('selected');
  selectedAvatar = av;
}

function doRegister(){
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const password = document.getElementById('reg-password').value;
  const country = document.getElementById('reg-country').value.trim();
  const classe = document.getElementById('reg-classe').value;

  // clear errors
  ['err-username','err-email','err-global'].forEach(id=>showError(id,''));

  if(!username || username.length < 3){ showError('err-username','Pseudo trop court (min. 3 caractères)'); return; }
  if(!email.includes('@')){ showError('err-email','Email invalide'); return; }
  if(password.length < 6){ showError('err-global','Mot de passe trop court (min. 6 caractères)'); return; }
  if(!classe){ showError('err-global','Sélectionne ta classe'); return; }
  if(!country){ showError('err-global','Indique ton pays'); return; }

  db = loadDB();
  if(db.users.find(u=>u.email===email)){ showError('err-email','Cet email est déjà utilisé'); return; }
  if(db.users.find(u=>u.username.toLowerCase()===username.toLowerCase())){ showError('err-username','Ce pseudo est déjà pris'); return; }

  const user = {
    id: Date.now().toString(),
    username, email,
    password: btoa(password), // basic obfuscation (not real security)
    country, classe,
    avatar: selectedAvatar,
    xp: 0, level: 1, streak: 0, maxStreak: 0,
    quizzesCompleted: 0, duelsWon: 0, duelsLost: 0,
    badges: [],
    joinedAt: new Date().toISOString(),
    lastActive: new Date().toISOString(),
  };
  db.users.push(user);
  db.globalStats.users = db.users.length;
  saveDB(db);

  toast('✅ Compte créé ! Bienvenue dans la bataille !', 'success');
  loginAs(user);
}

function doLogin(){
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  db = loadDB();
  const user = db.users.find(u=>u.email===email && u.password===btoa(password));
  if(!user){ showError('err-login','Email ou mot de passe incorrect'); return; }
  loginAs(user);
}

function loginAs(user){
  currentUser = user;
  // update last active
  const idx = db.users.findIndex(u=>u.id===user.id);
  if(idx>=0){ db.users[idx].lastActive = new Date().toISOString(); saveDB(db); }

  document.getElementById('top-avatar').textContent = user.avatar;
  document.getElementById('top-username').textContent = user.username;
  document.getElementById('top-xp').textContent = user.xp;

  refreshDashboard();
  showScreen('screen-app');
  toast(`Bienvenue ${user.username} ! ⚡`, 'success');
}

function doLogout(){
  currentUser = null;
  showScreen('screen-landing');
  toast('À bientôt !', 'info');
}

function showError(id, msg){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = msg;
  el.classList.toggle('show', !!msg);
}

// ══════════════════════════════════════════════════════════
// LANDING STATS
// ══════════════════════════════════════════════════════════
function refreshLandingStats(){
  db = loadDB();
  animCount('stat-users', db.globalStats.users||0);
  animCount('stat-duels', db.globalStats.duels||0);
  animCount('stat-quiz', db.globalStats.quizzes||0);
}
function animCount(id, target){
  const el = document.getElementById(id); if(!el) return;
  let cur=0; const step=Math.ceil(target/20)||1;
  const t=setInterval(()=>{ cur=Math.min(cur+step,target); el.textContent=cur; if(cur>=target) clearInterval(t); },50);
}
refreshLandingStats();

// ══════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════
function refreshDashboard(){
  if(!currentUser) return;
  const u = currentUser;
  document.getElementById('dash-name').textContent = u.username;
  document.getElementById('dash-classe').textContent = u.classe;

  const level = Math.floor(u.xp/200)+1;
  const xpInLevel = u.xp % 200;
  document.getElementById('dash-level').textContent = level;
  document.getElementById('dash-xp').textContent = `${xpInLevel} / 200 XP`;
  document.getElementById('dash-xp-fill').style.width = `${(xpInLevel/200)*100}%`;
  document.getElementById('top-xp').textContent = u.xp;

  document.getElementById('dash-streak').textContent = u.streak||0;
  document.getElementById('dash-duels-won').textContent = u.duelsWon||0;

  // World rank
  db = loadDB();
  const classmates = db.users.filter(uu=>uu.classe===u.classe).sort((a,b)=>b.xp-a.xp);
  const rank = classmates.findIndex(uu=>uu.id===u.id)+1;
  document.getElementById('dash-rank-world').textContent = rank>0?`#${rank}`:'#1';

  // Daily challenge
  const dailies = getDailyChallenges();
  if(dailies.length){
    const d = dailies[0];
    document.getElementById('daily-title').textContent = d.title;
    document.getElementById('daily-desc').textContent = d.desc;
    document.getElementById('daily-xp-label').textContent = `🎯 +${d.xp} XP`;
  }
}

// ══════════════════════════════════════════════════════════
// CHALLENGES DATA
// ══════════════════════════════════════════════════════════
function getChallengesForClasse(classe){
  const all = {
    // COLLÈGE
    '6ème': [
      { id:'m6_1',type:'calcul',icon:'🔢',color:'rgba(99,102,241,.15)',title:'Opérations de base',desc:'Addition, soustraction, multiplication et division',subject:'Maths',xp:30,difficulty:'Facile',questions: getQuestionsSet('calcul_6') },
      { id:'f6_1',type:'quiz',icon:'📖',color:'rgba(16,185,129,.15)',title:'Grammaire française',desc:'Accord, conjugaison, nature des mots',subject:'Français',xp:25,difficulty:'Facile',questions: getQuestionsSet('gram_6') },
      { id:'s6_1',type:'logique',icon:'🌿',color:'rgba(245,158,11,.15)',title:'Le vivant',desc:'Classification des êtres vivants',subject:'SVT',xp:30,difficulty:'Moyen',questions: getQuestionsSet('svt_6') },
    ],
    '5ème': [
      { id:'m5_1',type:'calcul',icon:'🔢',color:'rgba(99,102,241,.15)',title:'Fractions & Décimaux',desc:'Calcul sur les fractions et les décimaux',subject:'Maths',xp:35,difficulty:'Moyen',questions: getQuestionsSet('frac_5') },
      { id:'h5_1',type:'quiz',icon:'🌍',color:'rgba(239,68,68,.15)',title:'Histoire-Géo',desc:'L\'Afrique et le monde médiéval',subject:'Histoire-Géo',xp:30,difficulty:'Moyen',questions: getQuestionsSet('hist_5') },
    ],
    '3ème': [
      { id:'m3_1',type:'calcul',icon:'📐',color:'rgba(99,102,241,.15)',title:'Algèbre & Géométrie',desc:'Équations, théorème de Pythagore',subject:'Maths',xp:50,difficulty:'Difficile',questions: getQuestionsSet('alg_3') },
      { id:'f3_1',type:'quiz',icon:'📝',color:'rgba(16,185,129,.15)',title:'Prépa BEPC Français',desc:'Textes, analyse, rédaction',subject:'Français',xp:50,difficulty:'Difficile',questions: getQuestionsSet('bepc_fr') },
      { id:'pc3_1',type:'logique',icon:'⚗️',color:'rgba(245,158,11,.15)',title:'Physique-Chimie BEPC',desc:'Atomes, molécules, lumière',subject:'PC',xp:45,difficulty:'Difficile',questions: getQuestionsSet('bepc_pc') },
    ],
    'Tle D': [
      { id:'mtd_1',type:'calcul',icon:'∫',color:'rgba(99,102,241,.15)',title:'Dérivation & Intégration',desc:'Fonctions, dérivées, primitives',subject:'Maths',xp:80,difficulty:'Expert',questions: getQuestionsSet('math_tld') },
      { id:'svttd_1',type:'quiz',icon:'🧬',color:'rgba(16,185,129,.15)',title:'Génétique & Évolution',desc:'Hérédité, mutations, évolution',subject:'SVT',xp:70,difficulty:'Expert',questions: getQuestionsSet('svt_tld') },
    ],
  };

  // Generic fallback for classes not fully defined
  const generic = [
    { id:`g_${classe}_1`,type:'quiz',icon:'📝',color:'rgba(99,102,241,.15)',title:`Quiz général – ${classe}`,desc:'Questions variées pour réviser les fondamentaux',subject:'Général',xp:40,difficulty:'Moyen',questions: getQuestionsSet('generic') },
    { id:`g_${classe}_2`,type:'logique',icon:'🧠',color:'rgba(245,158,11,.15)',title:'Logique & Raisonnement',desc:'Exercices de logique pure',subject:'Logique',xp:35,difficulty:'Moyen',questions: getQuestionsSet('logique') },
    { id:`g_${classe}_3`,type:'calcul',icon:'🔢',color:'rgba(16,185,129,.15)',title:`Calcul – ${classe}`,desc:'Exercices de calcul rapide',subject:'Maths',xp:30,difficulty:'Facile',questions: getQuestionsSet('calcul_gen') },
  ];

  return all[classe] || generic;
}

function getDailyChallenges(){
  if(!currentUser) return [];
  const c = getChallengesForClasse(currentUser.classe);
  return c.slice(0,1).map(ch=>({...ch, title:'⚡ '+ch.title, desc:ch.desc+' — Défi du jour !', xp:ch.xp+20}));
}

function getQuestionsSet(key){
  const sets = {
    calcul_6: [
      {q:'Combien font 7 × 8 ?', opts:['54','56','64','48'], ans:1},
      {q:'Quel est le résultat de 144 ÷ 12 ?', opts:['11','13','12','14'], ans:2},
      {q:'Combien font 256 + 189 ?', opts:['435','445','425','455'], ans:1},
      {q:'Quel est le double de 37 ?', opts:['74','76','64','73'], ans:0},
      {q:'Combien font 1000 – 357 ?', opts:['653','643','663','743'], ans:1},
    ],
    gram_6: [
      {q:'Quel est le pluriel de "cheval" ?', opts:['chevals','chevaux','chevales','chevals'], ans:1},
      {q:'Quel est l\'adjectif dans : "Le grand chien dort" ?', opts:['Le','grand','chien','dort'], ans:1},
      {q:'Quelle est la nature du mot "rapidement" ?', opts:['Adjectif','Verbe','Adverbe','Nom'], ans:2},
      {q:'"Ils mangent." — Quel est le temps de ce verbe ?', opts:['Imparfait','Passé composé','Présent','Futur'], ans:2},
      {q:'Quel est le sujet dans : "Les oiseaux chantent" ?', opts:['Les','oiseaux','chantent','Les oiseaux'], ans:3},
    ],
    svt_6: [
      {q:'Les champignons appartiennent au règne :', opts:['Animal','Végétal','Fongique','Minéral'], ans:2},
      {q:'Quelle cellule utilise la photosynthèse ?', opts:['Neurone','Cellule végétale','Globule rouge','Bactérie'], ans:1},
      {q:'Quel organe filtre le sang ?', opts:['Foie','Poumon','Rein','Cœur'], ans:2},
      {q:'Les vertébrés ont :', opts:['6 pattes','Une carapace','Une colonne vertébrale','Des antennes'], ans:2},
      {q:'La photosynthèse produit :', opts:['CO₂ et eau','Oxygène et glucose','Azote et sel','Carbone et eau'], ans:1},
    ],
    frac_5: [
      {q:'Combien vaut 1/2 + 1/3 ?', opts:['2/5','5/6','2/6','3/5'], ans:1},
      {q:'Quelle est la fraction irréductible de 6/8 ?', opts:['3/4','2/3','6/8','1/2'], ans:0},
      {q:'3/4 × 8 = ?', opts:['5','6','24','3'], ans:1},
      {q:'0.75 = ?', opts:['7/10','3/5','3/4','7/5'], ans:2},
      {q:'Combien vaut 2/3 de 90 ?', opts:['45','60','30','72'], ans:1},
    ],
    hist_5: [
      {q:'En quelle année a été fondé l\'empire du Mali ?', opts:['Vers 1235','Vers 800','Vers 1000','Vers 1450'], ans:0},
      {q:'Qui a fondé l\'empire du Ghana ?', opts:['Soundiata Keïta','Inconnu','Kankou Moussa','Chaka'], ans:1},
      {q:'Le royaume du Dahomey était situé dans l\'actuel :', opts:['Ghana','Nigeria','Bénin','Togo'], ans:2},
      {q:'Quel pays a colonisé le Bénin ?', opts:['Portugal','Belgique','France','Angleterre'], ans:2},
      {q:'Quelle est la capitale de la géographie africaine la plus peuplée ?', opts:['Lagos','Kinshasa','Le Caire','Johannesburg'], ans:2},
    ],
    alg_3: [
      {q:'Résous : 2x + 5 = 13. x = ?', opts:['3','4','5','6'], ans:1},
      {q:'Dans un triangle rectangle, les côtés sont 3 et 4. L\'hypoténuse vaut ?', opts:['5','6','7','√7'], ans:0},
      {q:'Développe (x+2)². Résultat ?', opts:['x²+4','x²+2x+4','x²+4x+4','x+4'], ans:2},
      {q:'Factorise x²–9', opts:['(x+3)²','(x–3)(x+3)','(x–9)(x+9)','(x–3)²'], ans:1},
      {q:'Si 3x – 7 = 2x + 1, alors x = ?', opts:['6','8','7','9'], ans:1},
    ],
    bepc_fr: [
      {q:'Un "oxymore" est :', opts:['Une figure de style','Une faute de grammaire','Un type de poème','Un mode verbal'], ans:0},
      {q:'Le mode subjonctif exprime :', opts:['Une certitude','Un doute ou souhait','Une action passée','Un ordre'], ans:1},
      {q:'"Il pleuvait à verse." — "à verse" est un complément :', opts:['d\'objet direct','circonstanciel de manière','de lieu','de temps'], ans:1},
      {q:'La "métaphore" est une comparaison :', opts:['Avec "comme"','Avec "tel que"','Sans outil comparatif','Avec "ainsi que"'], ans:2},
      {q:'Quel temps emploie-t-on dans un récit au passé ?', opts:['Présent','Passé composé','Imparfait et passé simple','Futur'], ans:2},
    ],
    bepc_pc: [
      {q:'Quelle est la formule de l\'eau ?', opts:['HO','H₂O','H₂O₂','HO₂'], ans:1},
      {q:'L\'atome est électriquement :', opts:['Positif','Négatif','Neutre','Variable'], ans:2},
      {q:'La vitesse de la lumière dans le vide est environ :', opts:['300 000 km/s','30 000 km/s','3 000 000 km/s','150 000 km/s'], ans:0},
      {q:'Un ion positif s\'appelle :', opts:['Anion','Cation','Proton','Électron'], ans:1},
      {q:'La masse volumique de l\'eau est :', opts:['0.5 g/cm³','2 g/cm³','1 g/cm³','10 g/cm³'], ans:2},
    ],
    math_tld: [
      {q:'La dérivée de f(x) = x³ est :', opts:['3x','x²','3x²','2x³'], ans:2},
      {q:'∫x dx = ?', opts:['x²+C','x²/2+C','2x+C','x+C'], ans:1},
      {q:'La limite de (sin x)/x quand x→0 est :', opts:['0','∞','1','–1'], ans:2},
      {q:'log₁₀(100) = ?', opts:['1','2','10','100'], ans:1},
      {q:'Si f\'(x) = 0, alors f est :', opts:['Croissante','Décroissante','Constante ou a un extremum','Nulle'], ans:2},
    ],
    svt_tld: [
      {q:'Le brassage interchromosomique se produit lors de :', opts:['La mitose','La méiose','La méiose II','La fécondation'], ans:1},
      {q:'L\'ADN est une molécule :', opts:['Lipidique','Protéique','Polypeptidique','Polynucléotidique'], ans:3},
      {q:'La mutation est une modification :', opts:['Du phénotype','Du génotype','Du caryotype','De l\'ARN seulement'], ans:1},
      {q:'L\'ovule non fécondé est :', opts:['Diploïde','Haploïde','Triploïde','Polyploïde'], ans:1},
      {q:'Les immunoglobulines sont produites par les :', opts:['Lymphocytes T','Macrophages','Lymphocytes B','Neutrophiles'], ans:2},
    ],
    generic: [
      {q:'Quelle est la capitale du Bénin ?', opts:['Lagos','Cotonou','Porto-Novo','Abomey'], ans:2},
      {q:'Combien de côtés a un hexagone ?', opts:['5','6','7','8'], ans:1},
      {q:'Quel est le plus grand continent ?', opts:['Amérique','Europe','Asie','Afrique'], ans:2},
      {q:'Qui a écrit "Les Misérables" ?', opts:['Balzac','Flaubert','Victor Hugo','Zola'], ans:2},
      {q:'L\'eau bout à quelle température (à pression normale) ?', opts:['90°C','100°C','110°C','80°C'], ans:1},
    ],
    logique: [
      {q:'Si tous les chats sont noirs et Félix est un chat, alors Félix est :', opts:['Blanc','Noir','Gris','Indéterminé'], ans:1},
      {q:'Quel chiffre continue la suite : 2, 4, 8, 16, __ ?', opts:['24','30','32','36'], ans:2},
      {q:'ABCDEF : quelle lettre est à la 4ème position ?', opts:['C','D','E','F'], ans:1},
      {q:'Si A > B et B > C, alors :', opts:['C > A','A > C','A = C','Indéterminé'], ans:1},
      {q:'Quel nombre est premier parmi ceux-ci ?', opts:['9','15','17','21'], ans:2},
    ],
    calcul_gen: [
      {q:'√144 = ?', opts:['11','12','13','14'], ans:1},
      {q:'2⁵ = ?', opts:['10','16','32','64'], ans:2},
      {q:'15% de 200 = ?', opts:['20','25','30','35'], ans:2},
      {q:'PGCD(18, 24) = ?', opts:['3','6','9','12'], ans:1},
      {q:'0.1 × 0.1 = ?', opts:['0.1','0.01','0.001','1'], ans:1},
    ],
  };
  return sets[key] || sets['generic'];
}

// ══════════════════════════════════════════════════════════
// CHALLENGES RENDER
// ══════════════════════════════════════════════════════════
let currentFilter = 'tous';
function renderChallenges(){
  if(!currentUser) return;
  const challenges = getChallengesForClasse(currentUser.classe);
  const filtered = currentFilter==='tous' ? challenges : challenges.filter(c=>c.type===currentFilter);
  const list = document.getElementById('challenge-list');
  if(!filtered.length){ list.innerHTML='<p style="color:var(--muted);text-align:center;padding:2rem">Aucun défi disponible pour ce filtre.</p>'; return; }
  list.innerHTML = filtered.map(c=>`
    <div class="challenge-item" onclick="startQuiz('${c.id}')">
      <div class="challenge-icon" style="background:${c.color}">${c.icon}</div>
      <div class="challenge-info">
        <h3>${c.title}</h3>
        <p>${c.desc}</p>
        <div class="challenge-meta">
          <span class="chip">${c.subject}</span>
          <span class="chip ${c.difficulty==='Facile'?'green':c.difficulty==='Difficile'||c.difficulty==='Expert'?'hot':'gold'}">${c.difficulty}</span>
          <span class="chip">📝 5 questions</span>
          <span class="chip">⏱ 30s/question</span>
        </div>
      </div>
      <div class="challenge-xp">+${c.xp}<div class="lbl">XP</div></div>
    </div>
  `).join('');
}

function filterChallenges(f, el){
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  renderChallenges();
}

// ══════════════════════════════════════════════════════════
// QUIZ ENGINE
// ══════════════════════════════════════════════════════════
function startDailyChallenge(){
  if(!currentUser) return;
  const d = getDailyChallenges()[0];
  if(d) startQuiz(d.id.replace('⚡ ',''));
  else startQuizFromData(getChallengesForClasse(currentUser.classe)[0]);
}

function startQuiz(id){
  if(!currentUser) return;
  const challenges = getChallengesForClasse(currentUser.classe);
  const c = challenges.find(ch=>ch.id===id);
  if(!c){ toast('Défi introuvable','error'); return; }
  startQuizFromData(c);
}

function startQuizFromData(c){
  activeQuiz = { challenge:c, questions:c.questions, current:0, score:0, answers:[] };
  document.getElementById('quiz-category').textContent = c.subject + ' · ' + c.difficulty;
  document.getElementById('quiz-title-modal').textContent = c.title;
  document.getElementById('quiz-overlay').classList.add('show');
  renderQuizQuestion();
}

function renderQuizQuestion(){
  const q = activeQuiz;
  if(q.current >= q.questions.length){ showQuizResult(); return; }
  const question = q.questions[q.current];
  const pct = (q.current/q.questions.length)*100;

  document.getElementById('quiz-body').innerHTML = `
    <div class="quiz-progress">
      <div class="quiz-q-num">Question ${q.current+1} / ${q.questions.length}</div>
      <div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="quiz-question">${question.q}</div>
    <div class="quiz-options">
      ${question.opts.map((opt,i)=>`
        <div class="quiz-option" onclick="selectAnswer(${i})" id="opt-${i}">
          <span class="opt-letter">${String.fromCharCode(65+i)}</span>
          ${opt}
        </div>
      `).join('')}
    </div>
    <div class="quiz-footer">
      <div class="quiz-timer" id="quiz-timer">⏱ 30</div>
      <div style="font-size:.85rem;color:var(--muted)">Score: ${q.score}/${q.current}</div>
    </div>
  `;
  startQuizTimer(30);
}

let timerCount = 30;
function startQuizTimer(sec){
  clearInterval(quizTimer); timerCount = sec;
  const el = ()=>document.getElementById('quiz-timer');
  quizTimer = setInterval(()=>{
    timerCount--;
    if(el()) el().textContent = `⏱ ${timerCount}`;
    if(timerCount<=5 && el()) el().classList.add('urgent');
    if(timerCount<=0){ clearInterval(quizTimer); autoSkip(); }
  },1000);
}

function autoSkip(){
  // Time out — mark as wrong
  const question = activeQuiz.questions[activeQuiz.current];
  const opts = document.querySelectorAll('.quiz-option');
  opts.forEach(o=>o.classList.add('disabled'));
  opts[question.ans]?.classList.add('correct');
  activeQuiz.answers.push({correct:false});
  setTimeout(()=>{ activeQuiz.current++; renderQuizQuestion(); }, 1200);
}

function selectAnswer(i){
  clearInterval(quizTimer);
  const question = activeQuiz.questions[activeQuiz.current];
  const opts = document.querySelectorAll('.quiz-option');
  opts.forEach(o=>o.classList.add('disabled'));
  const correct = i === question.ans;
  opts[i].classList.add(correct?'correct':'wrong');
  if(!correct) opts[question.ans].classList.add('correct');
  if(correct) activeQuiz.score++;
  activeQuiz.answers.push({correct, chosen:i});
  setTimeout(()=>{ activeQuiz.current++; renderQuizQuestion(); }, 1200);
}

function showQuizResult(){
  const q = activeQuiz;
  const total = q.questions.length;
  const pct = Math.round((q.score/total)*100);
  const xpEarned = Math.round((q.score/total)*q.challenge.xp);

  const icons = pct>=80?'🏆':pct>=60?'😊':pct>=40?'😐':'😅';
  const msgs = pct>=80?'Excellent ! Tu maîtrises ce sujet !':pct>=60?'Bien joué ! Continue comme ça !':pct>=40?'Pas mal, il faut encore réviser.':'Courage, la prochaine sera meilleure !';

  document.getElementById('quiz-body').innerHTML = `
    <div class="quiz-result">
      <div class="result-icon">${icons}</div>
      <div class="result-score">${q.score}/${total}</div>
      <div class="result-msg">${msgs}</div>
      <div class="result-sub">${pct}% de bonnes réponses</div>
      <div class="xp-gained">⚡ +${xpEarned} XP gagnés !</div>
      <div style="display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="closeQuiz();refreshDashboard()">Continuer</button>
        <button class="btn btn-outline" onclick="retryQuiz()">🔄 Réessayer</button>
      </div>
    </div>
  `;

  // Save XP
  awardXP(xpEarned);
  db = loadDB();
  db.globalStats.quizzes = (db.globalStats.quizzes||0)+1;
  saveDB(db);
}

function retryQuiz(){
  const c = activeQuiz.challenge;
  activeQuiz = null;
  startQuizFromData(c);
}

function closeQuiz(){
  clearInterval(quizTimer);
  document.getElementById('quiz-overlay').classList.remove('show');
  activeQuiz = null;
  refreshDashboard();
}

function awardXP(amount){
  if(!currentUser || amount<=0) return;
  db = loadDB();
  const idx = db.users.findIndex(u=>u.id===currentUser.id);
  if(idx<0) return;
  db.users[idx].xp = (db.users[idx].xp||0)+amount;
  db.users[idx].quizzesCompleted = (db.users[idx].quizzesCompleted||0)+1;
  db.users[idx].lastActive = new Date().toISOString();
  saveDB(db);
  currentUser = db.users[idx];
  document.getElementById('top-xp').textContent = currentUser.xp;
  toast(`+${amount} XP ⚡`, 'success');
}

// ══════════════════════════════════════════════════════════
// DUEL
// ══════════════════════════════════════════════════════════
function searchOpponent(){
  const q = document.getElementById('duel-search-input').value.trim().toLowerCase();
  const res = document.getElementById('duel-results');
  if(!q){ res.innerHTML=''; return; }
  db = loadDB();
  const found = db.users.filter(u=>
    u.id !== currentUser.id &&
    u.username.toLowerCase().includes(q)
  ).slice(0,5);

  if(!found.length){
    res.innerHTML=`<p style="color:var(--muted);font-size:.85rem;padding:.5rem 0">Aucun élève trouvé. Invite tes amis à s'inscrire !</p>`;
    return;
  }
  res.innerHTML = found.map(u=>`
    <div class="player-result">
      <div class="pinfo">
        <div class="pav">${u.avatar}</div>
        <div>
          <div class="pname">${u.username}</div>
          <div class="pmeta">${u.classe} · ${u.country} · ${u.xp} XP</div>
        </div>
      </div>
      <button class="btn btn-gold btn-sm" onclick="startDuel('${u.id}')">Défier ⚔️</button>
    </div>
  `).join('');
}

function startDuel(opponentId){
  db = loadDB();
  const opp = db.users.find(u=>u.id===opponentId);
  if(!opp){ toast('Adversaire introuvable','error'); return; }

  // Start a quick quiz duel
  const challenges = getChallengesForClasse(currentUser.classe);
  const c = challenges[Math.floor(Math.random()*challenges.length)];

  // Display duel arena
  document.getElementById('duel-search-section').style.display='none';
  document.getElementById('duel-active-section').style.display='block';
  document.getElementById('duel-players-display').innerHTML = `
    <div class="duel-player">
      <div class="av-big">${currentUser.avatar}</div>
      <div class="name">${currentUser.username}</div>
      <div class="rank">${currentUser.xp} XP</div>
      <div class="score-big" id="duel-my-score">0</div>
    </div>
    <div class="duel-vs">VS</div>
    <div class="duel-player">
      <div class="av-big">${opp.avatar}</div>
      <div class="name">${opp.username}</div>
      <div class="rank">${opp.xp} XP</div>
      <div class="score-big" id="duel-opp-score">0</div>
    </div>
  `;

  // Run duel quiz
  let duelScore = 0;
  let duelQ = 0;
  const questions = c.questions;

  function renderDuelQ(){
    if(duelQ>=questions.length){
      // Simulate opponent score
      const oppScore = Math.floor(Math.random()*(questions.length+1));
      document.getElementById('duel-opp-score').textContent = oppScore;
      const won = duelScore > oppScore;
      const tied = duelScore===oppScore;

      // Award XP
      const xp = won?60:tied?30:10;
      awardXP(xp);

      // Update stats
      const idx = db.users.findIndex(u=>u.id===currentUser.id);
      db = loadDB();
      if(won){ db.users[idx].duelsWon=(db.users[idx].duelsWon||0)+1; }
      else { db.users[idx].duelsLost=(db.users[idx].duelsLost||0)+1; }
      db.globalStats.duels = (db.globalStats.duels||0)+1;
      saveDB(db);

      document.getElementById('duel-quiz-zone').innerHTML = `
        <div style="text-align:center;padding:1.5rem 0">
          <div style="font-size:3rem;margin-bottom:.8rem">${won?'🏆':tied?'🤝':'😅'}</div>
          <h3 style="font-size:1.3rem;font-weight:700;margin-bottom:.5rem">${won?'Victoire !':tied?'Égalité !':'Défaite...'}</h3>
          <p style="color:var(--muted);margin-bottom:1.5rem">Tu : ${duelScore} pts • ${opp.username} : ${oppScore} pts</p>
          <div style="display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="resetDuel()">Nouveau duel</button>
            <button class="btn btn-outline" onclick="switchTab('classement')">Voir classement</button>
          </div>
        </div>
      `;
      return;
    }
    const q = questions[duelQ];
    document.getElementById('duel-quiz-zone').innerHTML = `
      <div style="margin-bottom:.8rem;font-size:.8rem;color:var(--muted);font-family:'JetBrains Mono',monospace">
        Question ${duelQ+1}/${questions.length}
      </div>
      <div style="font-size:1rem;font-weight:600;margin-bottom:1.2rem;line-height:1.5">${q.q}</div>
      <div style="display:flex;flex-direction:column;gap:.6rem">
        ${q.opts.map((opt,i)=>`
          <div onclick="answerDuel(${i})" id="dopt-${i}" style="padding:.75rem 1rem;border-radius:10px;border:1.5px solid var(--border);background:var(--bg2);cursor:pointer;font-size:.9rem;display:flex;align-items:center;gap:.7rem;transition:.15s;"
            onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            <span style="width:26px;height:26px;border-radius:6px;background:var(--bg);display:inline-flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:var(--muted)">${String.fromCharCode(65+i)}</span>
            ${opt}
          </div>
        `).join('')}
      </div>
    `;
  }

  window.answerDuel = function(i){
    const q = questions[duelQ];
    const correct = i===q.ans;
    if(correct){ duelScore++; document.getElementById('duel-my-score').textContent=duelScore; }
    const opts = document.querySelectorAll('[id^="dopt-"]');
    opts.forEach(o=>o.style.pointerEvents='none');
    const chosen = document.getElementById(`dopt-${i}`);
    const right = document.getElementById(`dopt-${q.ans}`);
    if(correct) chosen.style.borderColor='var(--accent3)';
    else { chosen.style.borderColor='var(--danger)'; right.style.borderColor='var(--accent3)'; }
    duelQ++;
    setTimeout(renderDuelQ, 1000);
  };

  renderDuelQ();
}

function resetDuel(){
  document.getElementById('duel-search-section').style.display='block';
  document.getElementById('duel-active-section').style.display='none';
  document.getElementById('duel-search-input').value='';
  document.getElementById('duel-results').innerHTML='';
}

// ══════════════════════════════════════════════════════════
// CLASSEMENT
// ══════════════════════════════════════════════════════════
let currentRankingScope = 'mondial';

function showRanking(scope, el){
  currentRankingScope = scope;
  document.querySelectorAll('.rank-tab-btn').forEach(b=>b.classList.remove('active'));
  if(el) el.classList.add('active');
  renderRanking(scope);
}

function renderRanking(scope){
  if(!currentUser) return;
  db = loadDB();
  let users = [...db.users];

  if(scope==='regional'){
    // crude: same region = first word of country
    const myRegion = currentUser.country.split(' ')[0].toLowerCase();
    users = users.filter(u=>u.country.toLowerCase().includes(myRegion)||u.country.split(' ')[0].toLowerCase()===myRegion);
  } else if(scope==='local'){
    users = users.filter(u=>u.country.toLowerCase()===currentUser.country.toLowerCase());
  }

  // Filter by same classe
  users = users.filter(u=>u.classe===currentUser.classe).sort((a,b)=>b.xp-a.xp);

  const table = document.getElementById('ranking-table');
  if(!users.length || (users.length===1 && users[0].id===currentUser.id)){
    table.innerHTML = `
      <div class="empty-ranking">
        <div class="icon">🌐</div>
        <h3>Classement vide pour l'instant</h3>
        <p>Tu es le premier inscrit dans ta classe ! Partage l'application pour faire monter le classement.</p>
      </div>
    `;
    return;
  }

  table.innerHTML = users.map((u,i)=>{
    const pos = i+1;
    const posClass = pos===1?'p1':pos===2?'p2':pos===3?'p3':'';
    const posIcon = pos===1?'🥇':pos===2?'🥈':pos===3?'🥉':`${pos}`;
    const isMe = u.id===currentUser.id;
    return `
      <div class="rank-row ${isMe?'me':''}">
        <div class="rank-pos ${posClass}">${posIcon}</div>
        <div class="rank-av">${u.avatar}</div>
        <div class="rank-info">
          <div class="rname">${u.username}${isMe?' (toi)':''}</div>
          <div class="rmeta">${u.classe} · ${u.country}</div>
        </div>
        <div class="rank-pts">${u.xp}<div class="pts-lbl">XP</div></div>
      </div>
    `;
  }).join('');
}

// ══════════════════════════════════════════════════════════
// PROFILE
// ══════════════════════════════════════════════════════════
function renderProfile(){
  if(!currentUser) return;
  db = loadDB();
  const u = db.users.find(uu=>uu.id===currentUser.id)||currentUser;
  const level = Math.floor(u.xp/200)+1;

  document.getElementById('prof-avatar').textContent = u.avatar;
  document.getElementById('prof-name').textContent = u.username;
  document.getElementById('prof-classe').textContent = `📚 ${u.classe}`;
  document.getElementById('prof-country').textContent = `📍 ${u.country}`;
  document.getElementById('prof-xp').textContent = u.xp;
  document.getElementById('prof-level').textContent = level;
  document.getElementById('prof-quizzes').textContent = u.quizzesCompleted||0;
  document.getElementById('prof-duels-w').textContent = u.duelsWon||0;
  document.getElementById('prof-streak').textContent = u.maxStreak||0;

  const classmates = db.users.filter(uu=>uu.classe===u.classe).sort((a,b)=>b.xp-a.xp);
  const rank = classmates.findIndex(uu=>uu.id===u.id)+1;
  document.getElementById('prof-rank').textContent = rank>0?`#${rank}`:'#1';

  // Badges
  const badges = [];
  if(u.xp>=200) badges.push('⭐ Niveau 2');
  if(u.quizzesCompleted>=5) badges.push('📝 5 Quiz');
  if(u.duelsWon>=1) badges.push('⚔️ Guerrier');
  if(u.streak>=3) badges.push('🔥 En feu');
  document.getElementById('prof-badges').innerHTML = badges.map(b=>`<span class="badge-item">${b}</span>`).join('') || '<span style="color:var(--muted);font-size:.8rem">Complète des défis pour obtenir des badges !</span>';
}

// ══════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════
function toast(msg, type='info', duration=3000){
  const icons = {success:'✅',error:'❌',info:'ℹ️'};
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(()=>el.remove(), duration);
}

// ══════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') closeQuiz();
});