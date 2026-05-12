/* ═══════════════════════════════════════════════════
   EDUBATTLE — app.js
   Structure :
     1. Config & Variables globales
     2. Supabase helpers
     3. Init & Session
     4. Navigation
     5. Auth (inscription, connexion, déconnexion)
     6. Dashboard
     7. Défis & Questions
     8. Quiz Engine
     9. Duel
    10. Classement
    11. Profil
    12. Utilitaires (toast, loader, erreurs)
═══════════════════════════════════════════════════ */

/* ── 1. CONFIG & VARIABLES GLOBALES ─────────────── */

const SB_URL = 'https://yvituzketmfqwfrgerlr.supabase.co';
const SB_KEY = 'sb_publishable_cAF7PdUhzXaUYMwT1PY0YA_p2Qpnc_5';

const AVATARS = [
  '🦁','🐯','🦊','🐺','🦅','🐉',
  '⚡','🔥','💎','🌟','🎯','🚀',
  '🏆','🌊','🎭','🦋','🐬','🦖',
  '🤖','🎪','🌙','☄️','🎸','🔮'
];

let USER      = null;   // Profil utilisateur (table profiles)
let SESSION   = null;   // Session Supabase Auth
let activeQuiz = null;  // Quiz en cours
let quizTimer  = null;  // Timer intervalle
let timerSec   = 30;    // Secondes restantes
let defFilter  = 'tous'; // Filtre défis actif
let selAvatar  = AVATARS[0]; // Avatar sélectionné


/* ── 2. SUPABASE CLIENT (SDK officiel) ───────────── */

// Initialisation du client Supabase via le SDK
let _supabase = null;

function getClient() {
  if (_supabase) return _supabase;
  _supabase = supabase.createClient(SB_URL, SB_KEY);
  return _supabase;
}

/** Inscription */
async function authSignUp(email, password) {
  const { data, error } = await getClient().auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/** Connexion */
async function authSignIn(email, password) {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** Déconnexion */
async function authSignOut() {
  await getClient().auth.signOut();
}

/** Récupérer un profil par ID */
async function getProfile(userId) {
  const { data, error } = await getClient()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

/** Créer ou mettre à jour un profil */
async function upsertProfile(profile) {
  const { error } = await getClient()
    .from('profiles')
    .upsert(profile);
  if (error) throw error;
}

/** Mettre à jour un profil */
async function updateProfile(userId, data) {
  const { error } = await getClient()
    .from('profiles')
    .update(data)
    .eq('id', userId);
  if (error) throw error;
}

/** Récupérer le classement */
async function getLeaderboard(classe, country, scope) {
  let query = getClient()
    .from('profiles')
    .select('*')
    .eq('classe', classe)
    .order('xp', { ascending: false })
    .limit(50);

  if (scope === 'local') {
    query = query.eq('country', country);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/** Rechercher des joueurs par pseudo */
async function searchUsers(query) {
  const { data, error } = await getClient()
    .from('profiles')
    .select('*')
    .ilike('username', `%${query}%`)
    .limit(10);
  if (error) throw error;
  return data || [];
}

/** Récupérer les stats globales */
async function getGlobalStats() {
  try {
    const { count } = await getClient()
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    return { users: count || 0, duels: 0, quizzes: 0 };
  } catch (e) {
    return { users: 0, duels: 0, quizzes: 0 };
  }
}


/* ── 3. INIT & SESSION ───────────────────────────── */

window.addEventListener('DOMContentLoaded', async () => {
  buildAvatarGrid();

  // Vérifier session active via SDK Supabase
  try {
    const { data: { session } } = await getClient().auth.getSession();
    if (session) {
      SESSION = session;
      const profile = await getProfile(session.user.id);
      if (profile) {
        USER = profile;
        enterApp();
        return;
      }
    }
  } catch (e) {
    console.log('Pas de session active');
  }

  hideLoader();
  loadLandingStats();
});

/** Construire la grille d'avatars */
function buildAvatarGrid() {
  const grid = document.getElementById('av-grid');
  if (!grid) return;
  grid.innerHTML = AVATARS.map((av, i) =>
    `<div class="av-opt${i === 0 ? ' sel' : ''}" onclick="pickAvatar('${av}', this)">${av}</div>`
  ).join('');
}

/** Sélectionner un avatar */
function pickAvatar(av, el) {
  document.querySelectorAll('.av-opt').forEach(e => e.classList.remove('sel'));
  el.classList.add('sel');
  selAvatar = av;
}

/** Charger les stats de la landing page */
async function loadLandingStats() {
  try {
    const s = await getGlobalStats();
    animateNumber('ls-users',  s.users);
    animateNumber('ls-duels',  s.duels);
    animateNumber('ls-quiz',   s.quizzes);
  } catch (e) { /* silencieux */ }
}


/* ── 4. NAVIGATION ───────────────────────────────── */

/** Aller vers un écran */
function go(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
}

function hideLoader() {
  document.getElementById('loader')?.classList.add('hide');
}
function showLoader() {
  document.getElementById('loader')?.classList.remove('hide');
}

/** Ouvrir un onglet de l'app */
function openTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name)?.classList.add('active');
  document.querySelector(`[data-tab="${name}"]`)?.classList.add('active');

  // Actions spécifiques par onglet
  if (name === 'defis')  renderDefis();
  if (name === 'rank')   showRank('mondial', document.querySelector('.rtab.active'));
  if (name === 'profil') renderProfile();
  if (name === 'home')   renderDashboard();
}


/* ── 5. AUTH ─────────────────────────────────────── */

/** Inscription */
async function doRegister() {
  const pseudo  = document.getElementById('r-pseudo').value.trim();
  const pays    = document.getElementById('r-pays').value;
  const classe  = document.getElementById('r-classe').value;
  const email   = document.getElementById('r-email').value.trim().toLowerCase();
  const mdp     = document.getElementById('r-mdp').value;

  // Reset erreurs
  ['e-pseudo', 'e-classe', 'e-email', 'e-global'].forEach(id => showErr(id, ''));

  // Validations
  if (pseudo.length < 3)      return showErr('e-pseudo', 'Pseudo trop court (min. 3 caractères)');
  if (!/^[a-zA-ZÀ-ÿ0-9_\-. ]{3,20}$/.test(pseudo)) return showErr('e-pseudo', 'Pseudo invalide (lettres, chiffres, _ uniquement)');
  if (!pays)                  return showErr('e-global', 'Sélectionne ton pays');
  if (!classe)                return showErr('e-classe', 'Sélectionne ta classe');
  if (!email.includes('@'))   return showErr('e-email',  'Email invalide');
  if (mdp.length < 6)         return showErr('e-global', 'Mot de passe trop court (min. 6 caractères)');

  const btn = document.getElementById('btn-register');
  btn.disabled = true;
  btn.textContent = 'Création en cours...';

  try {
    // Créer compte auth via SDK
    const authData = await authSignUp(email, mdp);
    if (!authData.user) {
      showErr('e-global', 'Vérifie ton email pour confirmer ton compte.');
      return;
    }
    SESSION = authData.session;

    // Créer profil dans la table profiles
    const profile = {
      id:           authData.user.id,
      username:     pseudo,
      email:        email,
      country:      pays,
      classe:       classe,
      avatar:       selAvatar,
      xp:           0,
      level:        1,
      streak:       0,
      max_streak:   0,
      quizzes_done: 0,
      duels_won:    0,
      duels_lost:   0,
      created_at:   new Date().toISOString()
    };
    await upsertProfile(profile);
    USER = profile;

    toast('✅ Compte créé ! Bienvenue dans la bataille !', 'ok');
    enterApp();

  } catch (e) {
    const msg = e?.message || e?.msg || 'Erreur. Réessaie.';
    if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered')) {
      showErr('e-email', 'Email déjà utilisé. Connecte-toi directement.');
    } else if (msg.toLowerCase().includes('email')) {
      showErr('e-email', msg);
    } else {
      showErr('e-global', msg);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Créer mon compte ⚡';
  }
}

/** Connexion */
async function doLogin() {
  const email = document.getElementById('l-email').value.trim().toLowerCase();
  const mdp   = document.getElementById('l-mdp').value;
  showErr('e-login', '');

  if (!email || !mdp) return showErr('e-login', 'Remplis tous les champs');

  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = 'Connexion...';

  try {
    const authData = await authSignIn(email, mdp);
    SESSION = authData.session;

    const profile = await getProfile(authData.user.id);
    if (!profile) {
      showErr('e-login', 'Profil introuvable. Recrée ton compte.');
      return;
    }
    USER = profile;
    toast('👋 Bienvenue ' + profile.username + ' !', 'ok');
    enterApp();

  } catch (e) {
    const msg = e?.message || '';
    if (msg.toLowerCase().includes('email not confirmed')) {
      showErr('e-login', 'Confirme ton email avant de te connecter.');
    } else {
      showErr('e-login', 'Email ou mot de passe incorrect');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Connexion';
  }
}

/** Déconnexion */
async function doLogout() {
  showLoader();
  await authSignOut();
  SESSION = null;
  USER    = null;
  localStorage.removeItem('eb_session');
  hideLoader();
  go('screen-landing');
  loadLandingStats();
  toast('À bientôt ! 👋', 'info');
}

/** Entrer dans l'application après connexion */
function enterApp() {
  hideLoader();
  // Mettre à jour la topbar
  document.getElementById('tb-av').textContent   = USER.avatar;
  document.getElementById('tb-name').textContent = USER.username;
  document.getElementById('tb-xp').textContent   = USER.xp || 0;
  renderDashboard();
  go('screen-app');
}


/* ── 6. DASHBOARD ────────────────────────────────── */

async function renderDashboard() {
  if (!USER) return;

  const xp      = USER.xp || 0;
  const level   = Math.floor(xp / 200) + 1;
  const xpInLvl = xp % 200;
  const pct     = Math.round((xpInLvl / 200) * 100);

  // Infos générales
  document.getElementById('d-name').textContent    = USER.username;
  document.getElementById('d-classe').textContent  = USER.classe;
  document.getElementById('d-lvl').textContent     = level;
  document.getElementById('d-xp-txt').textContent  = `${xpInLvl} / 200 XP`;
  document.getElementById('d-xp-fill').style.width = pct + '%';
  document.getElementById('d-streak').textContent  = USER.streak || 0;
  document.getElementById('d-duels').textContent   = USER.duels_won || 0;

  // Défi du jour
  const defis = getDefisForUser();
  if (defis.length) {
    const d = defis[0];
    document.getElementById('daily-title').textContent = d.title;
    document.getElementById('daily-desc').textContent  = d.desc;
    document.getElementById('daily-xp').textContent   = `🎯 +${d.xp + 20} XP`;
  }

  // Classement + mini-leaderboard
  try {
    const lb  = await getLeaderboard(USER.classe, USER.country, 'mondial');
    const pos = lb.findIndex(x => x.id === USER.id) + 1;
    document.getElementById('d-rank').textContent = pos > 0 ? `#${pos}` : '#1';

    const top3 = lb.slice(0, 3);
    const mr   = document.getElementById('mini-rank');

    if (!top3.length) {
      mr.innerHTML = '<p class="empty-text">Aucun autre élève dans ta classe pour l\'instant.</p>';
      return;
    }
    mr.innerHTML = top3.map((p, i) => `
      <div style="display:flex;align-items:center;gap:.65rem;padding:.45rem 0;
        border-bottom:1px solid var(--border);${i === top3.length - 1 ? 'border-bottom:none' : ''}">
        <span style="width:22px;text-align:center;font-weight:700;
          font-family:'JetBrains Mono',monospace;font-size:.82rem;
          color:${i === 0 ? 'var(--gold)' : i === 1 ? '#c0c0c0' : '#cd7c3f'}">
          ${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
        </span>
        <span style="font-size:1.05rem">${p.avatar}</span>
        <span style="flex:1;font-size:.83rem;font-weight:500">
          ${p.username}${p.id === USER.id ? ' (toi)' : ''}
        </span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:.8rem;
          color:var(--gold);font-weight:700">${p.xp} XP</span>
      </div>
    `).join('');

  } catch (e) {
    document.getElementById('d-rank').textContent = '#1';
  }
}

/** Lancer le défi du jour */
function launchDaily() {
  const defis = getDefisForUser();
  if (defis.length) launchQuiz(defis[0]);
}


/* ── 7. DÉFIS & QUESTIONS ────────────────────────── */

/** Récupérer les défis adaptés à l'utilisateur connecté */
function getDefisForUser() {
  if (!USER) return [];
  return getDefisForClasse(USER.classe, USER.country);
}

/**
 * Retourne la liste des défis selon la classe et le pays.
 * Les questions sont organisées par pays/curriculum.
 */
function getDefisForClasse(classe, country) {
  const curriculum = getCurriculum(country);
  const bank = getQuestionBank(curriculum);

  // Mapping classe → matières + difficulté
  const configs = {
    '6ème': [
      { id:'m6_1', type:'calcul', icon:'🔢', bg:'rgba(99,102,241,.15)', title:'Calcul mental', desc:'Addition, soustraction, multiplication, division', subject:'Maths', diff:'Facile', xp:30, key:'calcul_base' },
      { id:'f6_1', type:'quiz',   icon:'📖', bg:'rgba(16,185,129,.15)', title:'Grammaire & Langue', desc:'Accord, conjugaison, nature des mots', subject:'Français', diff:'Facile', xp:25, key:'gram_college' },
      { id:'s6_1', type:'logique',icon:'🌿', bg:'rgba(245,158,11,.15)', title:'Sciences du vivant', desc:'Classification, cellules, êtres vivants', subject:'SVT', diff:'Moyen', xp:30, key:'svt_college' },
    ],
    '5ème': [
      { id:'m5_1', type:'calcul', icon:'🔢', bg:'rgba(99,102,241,.15)', title:'Fractions & Décimaux', desc:'Opérations sur les fractions et nombres décimaux', subject:'Maths', diff:'Moyen', xp:35, key:'fractions' },
      { id:'h5_1', type:'quiz',   icon:'🌍', bg:'rgba(239,68,68,.15)',  title:'Histoire-Géographie', desc:'Afrique et monde médiéval', subject:'Hist-Géo', diff:'Moyen', xp:30, key:'hist_geo' },
      { id:'f5_1', type:'quiz',   icon:'📖', bg:'rgba(16,185,129,.15)', title:'Lecture & Compréhension', desc:'Textes narratifs et descriptifs', subject:'Français', diff:'Moyen', xp:25, key:'gram_college' },
    ],
    '4ème': [
      { id:'m4_1', type:'calcul', icon:'📐', bg:'rgba(99,102,241,.15)', title:'Géométrie plane', desc:'Triangles, angles, théorèmes de base', subject:'Maths', diff:'Moyen', xp:40, key:'geo_plane' },
      { id:'pc4_1',type:'logique',icon:'⚗️', bg:'rgba(245,158,11,.15)', title:'Physique-Chimie', desc:'États de la matière, mélanges', subject:'PC', diff:'Moyen', xp:35, key:'physchim_college' },
    ],
    '3ème': [
      { id:'m3_1', type:'calcul', icon:'📐', bg:'rgba(99,102,241,.15)', title:'Algèbre & Géométrie', desc:'Équations, Pythagore, trigonométrie', subject:'Maths', diff:'Difficile', xp:50, key:'algebre_3eme' },
      { id:'f3_1', type:'quiz',   icon:'📝', bg:'rgba(16,185,129,.15)', title:'Prépa BEPC — Français', desc:'Textes, analyse, figures de style', subject:'Français', diff:'Difficile', xp:50, key:'bepc_fr' },
      { id:'p3_1', type:'logique',icon:'⚗️', bg:'rgba(245,158,11,.15)', title:'Prépa BEPC — PC', desc:'Atomes, lumière, électricité', subject:'PC', diff:'Difficile', xp:45, key:'bepc_pc' },
      { id:'s3_1', type:'logique',icon:'🌿', bg:'rgba(16,185,129,.15)', title:'Prépa BEPC — SVT', desc:'Génétique, reproduction, écologie', subject:'SVT', diff:'Difficile', xp:45, key:'svt_3eme' },
    ],
    '2nde': [
      { id:'m2_1', type:'calcul', icon:'📐', bg:'rgba(99,102,241,.15)', title:'Fonctions & Suites', desc:'Fonctions de référence, variations', subject:'Maths', diff:'Moyen', xp:45, key:'fonctions_2nde' },
      { id:'pc2_1',type:'logique',icon:'⚗️', bg:'rgba(245,158,11,.15)', title:'Physique-Chimie 2nde', desc:'Mécanique, ondes, chimie organique', subject:'PC', diff:'Moyen', xp:40, key:'pc_lycee' },
    ],
    '1ère C': [
      { id:'mc1_1',type:'calcul', icon:'∑',  bg:'rgba(99,102,241,.15)', title:'Dérivation', desc:'Dérivées des fonctions usuelles', subject:'Maths', diff:'Difficile', xp:60, key:'derivation' },
      { id:'pc1_1',type:'logique',icon:'⚡', bg:'rgba(245,158,11,.15)', title:'Mécanique & Électricité', desc:'Newton, lois de Kirchhoff', subject:'PC', diff:'Difficile', xp:55, key:'mecanique' },
    ],
    '1ère D': [
      { id:'md1_1',type:'calcul', icon:'∑',  bg:'rgba(99,102,241,.15)', title:'Probabilités & Stats', desc:'Loi binomiale, espérance, variance', subject:'Maths', diff:'Difficile', xp:60, key:'proba' },
      { id:'sd1_1',type:'logique',icon:'🧬', bg:'rgba(16,185,129,.15)', title:'Génétique', desc:'Hérédité, brassage génétique', subject:'SVT', diff:'Difficile', xp:55, key:'genetique' },
    ],
    'Tle C': [
      { id:'mtc_1',type:'calcul', icon:'∫',  bg:'rgba(99,102,241,.15)', title:'Intégration', desc:'Primitives, calcul intégral', subject:'Maths', diff:'Expert', xp:80, key:'integration' },
      { id:'ptc_1',type:'logique',icon:'⚡', bg:'rgba(245,158,11,.15)', title:'Électronique', desc:'Condensateurs, transistors, signaux', subject:'PC', diff:'Expert', xp:75, key:'mecanique' },
    ],
    'Tle D': [
      { id:'mtd_1',type:'calcul', icon:'∫',  bg:'rgba(99,102,241,.15)', title:'Dérivation & Intégration', desc:'Fonctions, dérivées, primitives', subject:'Maths', diff:'Expert', xp:80, key:'integration' },
      { id:'std_1',type:'logique',icon:'🧬', bg:'rgba(16,185,129,.15)', title:'Génétique & Évolution', desc:'Mutations, évolution, immunologie', subject:'SVT', diff:'Expert', xp:70, key:'genetique' },
    ],
  };

  // Défis génériques si classe non listée
  const generic = [
    { id:`g1_${classe}`, type:'quiz',   icon:'📝', bg:'rgba(99,102,241,.15)', title:`Quiz général — ${classe}`, desc:'Questions variées pour réviser les fondamentaux', subject:'Général', diff:'Moyen', xp:40, key:'general' },
    { id:`g2_${classe}`, type:'logique',icon:'🧠', bg:'rgba(245,158,11,.15)', title:'Logique & Raisonnement', desc:'Exercices de logique et déduction', subject:'Logique', diff:'Moyen', xp:35, key:'logique' },
    { id:`g3_${classe}`, type:'calcul', icon:'🔢', bg:'rgba(16,185,129,.15)', title:'Calcul rapide', desc:'Entraîne ton cerveau avec des calculs variés', subject:'Maths', diff:'Facile', xp:30, key:'calcul_base' },
  ];

  const list = configs[classe] || generic;

  // Associer les questions depuis la banque
  return list.map(defi => ({
    ...defi,
    questions: bank[defi.key] || bank['general']
  }));
}

/** Déterminer le curriculum selon le pays */
function getCurriculum(country) {
  const maghreb  = ['Maroc', 'Algérie', 'Tunisie', 'Égypte'];
  const afrique  = ['Bénin', 'Togo', 'Sénégal', "Côte d'Ivoire", 'Mali', 'Burkina Faso', 'Niger', 'Guinée', 'Ghana', 'Nigeria', 'Cameroun', 'Congo', 'RDC', 'Gabon', 'Madagascar', 'Rwanda'];
  const europe   = ['France', 'Belgique', 'Suisse'];

  if (maghreb.includes(country))  return 'maghreb';
  if (afrique.includes(country))  return 'afrique';
  if (europe.includes(country))   return 'france';
  return 'afrique'; // par défaut
}

/** Banque de questions par curriculum */
function getQuestionBank(curriculum) {
  // Questions communes à tous les curriculums
  const common = {
    calcul_base: [
      { q: 'Combien font 7 × 8 ?',                opts: ['54','56','64','48'],        ans: 1 },
      { q: 'Résultat de 144 ÷ 12 ?',              opts: ['11','13','12','14'],        ans: 2 },
      { q: 'Combien font 256 + 189 ?',             opts: ['435','445','425','455'],    ans: 1 },
      { q: 'Le double de 37 ?',                    opts: ['74','76','64','73'],        ans: 0 },
      { q: 'Combien font 1000 – 357 ?',            opts: ['653','643','663','743'],    ans: 1 },
    ],
    fractions: [
      { q: 'Combien vaut 1/2 + 1/3 ?',            opts: ['2/5','5/6','2/6','3/5'],   ans: 1 },
      { q: 'Fraction irréductible de 6/8 ?',       opts: ['3/4','2/3','6/8','1/2'],   ans: 0 },
      { q: '3/4 × 8 = ?',                          opts: ['5','6','24','3'],          ans: 1 },
      { q: '0.75 = ?',                             opts: ['7/10','3/5','3/4','7/5'],  ans: 2 },
      { q: '2/3 de 90 = ?',                        opts: ['45','60','30','72'],       ans: 1 },
    ],
    geo_plane: [
      { q: 'Somme des angles d\'un triangle ?',    opts: ['90°','180°','270°','360°'],ans: 1 },
      { q: 'Dans un triangle rectangle, sin(30°) ?', opts:['0.5','0.75','1','√2/2'], ans: 0 },
      { q: 'Aire d\'un rectangle 6×4 ?',           opts: ['20','24','22','18'],       ans: 1 },
      { q: 'Périmètre d\'un carré de côté 5 ?',    opts: ['20','25','15','10'],       ans: 0 },
      { q: 'Un polygone à 8 côtés s\'appelle ?',   opts: ['Hexagone','Octogone','Heptagone','Pentagone'], ans: 1 },
    ],
    algebre_3eme: [
      { q: '2x + 5 = 13 → x = ?',                 opts: ['3','4','5','6'],           ans: 1 },
      { q: 'Côtés 3 et 4 d\'un tri. rectangle → hypoténuse ?', opts:['5','6','7','√7'], ans: 0 },
      { q: 'Développe (x+2)²',                     opts: ['x²+4','x²+2x+4','x²+4x+4','x+4'], ans: 2 },
      { q: 'Factorise x²–9',                       opts: ['(x+3)²','(x–3)(x+3)','(x–9)(x+9)','(x–3)²'], ans: 1 },
      { q: '3x – 7 = 2x + 1 → x = ?',             opts: ['6','8','7','9'],           ans: 1 },
    ],
    fonctions_2nde: [
      { q: 'f(x)=x² est-elle paire, impaire ?',    opts: ['Impaire','Paire','Ni l\'un ni l\'autre','Les deux'], ans: 1 },
      { q: 'f(x)=3x+2, f(4) = ?',                 opts: ['10','12','14','16'],       ans: 2 },
      { q: 'f(x)=x²–4. f(2) = ?',                 opts: ['0','4','–4','8'],          ans: 0 },
      { q: 'Zéro de f(x)=2x–6 ?',                 opts: ['2','3','4','6'],           ans: 1 },
      { q: 'f(x)=1/x est définie pour ?',          opts: ['x>0','x≠0','x≥0','Tous les x'], ans: 1 },
    ],
    derivation: [
      { q: 'Dérivée de f(x)=x³ ?',                opts: ['3x','x²','3x²','2x³'],    ans: 2 },
      { q: 'Dérivée de f(x)=sin(x) ?',            opts: ['cos(x)','-cos(x)','-sin(x)','tan(x)'], ans: 0 },
      { q: 'Dérivée de f(x)=e^x ?',               opts: ['e^x','xe^x','e^(x–1)','1'], ans: 0 },
      { q: 'Dérivée de f(x)=ln(x) ?',             opts: ['1','x','1/x','ln(x)'],    ans: 2 },
      { q: 'Dérivée de f(x)=x²+3x+1 ?',           opts: ['2x+3','x+3','2x','x²+3'],  ans: 0 },
    ],
    integration: [
      { q: '∫x dx = ?',                            opts: ['x²+C','x²/2+C','2x+C','x+C'], ans: 1 },
      { q: '∫e^x dx = ?',                          opts: ['e^x+C','xe^x+C','e^(x+1)+C','ln(x)+C'], ans: 0 },
      { q: '∫cos(x) dx = ?',                       opts: ['sin(x)+C','-sin(x)+C','cos(x)+C','-cos(x)+C'], ans: 0 },
      { q: 'Primitive de f(x)=3x² ?',              opts: ['6x+C','x³+C','3x+C','x²+C'], ans: 1 },
      { q: 'lim(x→0) sin(x)/x = ?',               opts: ['0','∞','1','–1'],         ans: 2 },
    ],
    proba: [
      { q: 'P(A∪B) = P(A)+P(B) si A et B sont ?', opts: ['Indépendants','Incompatibles','Complémentaires','Quelconques'], ans: 1 },
      { q: 'Espérance de X ~ B(10, 0.4) ?',       opts: ['4','6','2','8'],           ans: 0 },
      { q: 'Variance de X ~ B(n,p) ?',             opts: ['np','np(1–p)','n²p','np²'], ans: 1 },
      { q: 'P(X=0) si X ~ B(3, 0.5) ?',           opts: ['1/8','1/4','3/8','1/2'],  ans: 0 },
      { q: 'Coefficient binomial C(5,2) = ?',      opts: ['10','15','20','5'],        ans: 0 },
    ],
    mecanique: [
      { q: '2ème loi de Newton : ΣF = ?',          opts: ['mv','ma','m/a','v/t'],    ans: 1 },
      { q: 'Unité de la force en SI ?',            opts: ['Joule','Newton','Pascal','Watt'], ans: 1 },
      { q: 'Énergie cinétique : Ec = ?',           opts: ['mgh','½mv²','mv²','½mgh'], ans: 1 },
      { q: 'Loi d\'Ohm : U = ?',                  opts: ['R/I','I/R','RI','R+I'],   ans: 2 },
      { q: 'Unité de la résistance ?',             opts: ['Volt','Ampère','Ohm','Watt'], ans: 2 },
    ],
    pc_lycee: [
      { q: 'Formule de l\'eau ?',                  opts: ['HO','H₂O','H₂O₂','HO₂'], ans: 1 },
      { q: 'Vitesse de la lumière ?',              opts: ['300 000 km/s','30 000 km/s','3 000 000 km/s','150 000 km/s'], ans: 0 },
      { q: 'pH d\'une solution neutre ?',          opts: ['0','7','14','1'],          ans: 1 },
      { q: 'Nombre d\'électrons de l\'atome d\'oxygène ?', opts:['6','8','10','16'], ans: 1 },
      { q: 'Réaction acido-basique : l\'acide cède ?', opts:['Électron','Proton','Neutron','Photon'], ans: 1 },
    ],
    genetique: [
      { q: 'Le brassage interchromosomique se produit lors de ?', opts:['Mitose','Méiose I','Méiose II','Fécondation'], ans: 1 },
      { q: 'L\'ADN est une molécule ?',            opts: ['Lipidique','Protéique','Polynucléotidique','Glucidique'], ans: 2 },
      { q: 'Une mutation est une modification du ?', opts:['Phénotype','Génotype','Caryotype','ARN uniquement'], ans: 1 },
      { q: 'L\'ovule non fécondé est ?',           opts: ['Diploïde','Haploïde','Triploïde','Polyploïde'], ans: 1 },
      { q: 'Les immunoglobulines sont produites par les ?', opts:['Lymphocytes T','Macrophages','Lymphocytes B','Neutrophiles'], ans: 2 },
    ],
    svt_3eme: [
      { q: 'L\'unité fonctionnelle du rein est ?', opts: ['Neurone','Néphron','Alvéole','Cellule de Schwann'], ans: 1 },
      { q: 'L\'hormone de croissance est sécrétée par ?', opts:['Thyroïde','Hypophyse','Pancréas','Surrénale'], ans: 1 },
      { q: 'La photosynthèse produit ?',           opts: ['CO₂ + H₂O','O₂ + glucose','N₂ + sels','C + eau'], ans: 1 },
      { q: 'Les chromosomes homologues se séparent lors de ?', opts:['Mitose','Méiose I','Méiose II','Interphase'], ans: 1 },
      { q: 'La vaccination stimule ?',             opts: ['Le système nerveux','L\'immunité','Le métabolisme','La digestion'], ans: 1 },
    ],
    svt_college: [
      { q: 'Les champignons appartiennent au règne ?', opts:['Animal','Végétal','Fongique','Minéral'], ans: 2 },
      { q: 'La photosynthèse se fait dans ?',     opts: ['La racine','Le chloroplaste','La mitochondrie','La vacuole'], ans: 1 },
      { q: 'Quel organe filtre le sang ?',         opts: ['Foie','Poumon','Rein','Cœur'],  ans: 2 },
      { q: 'Les vertébrés ont ?',                  opts: ['6 pattes','Carapace','Colonne vertébrale','Antennes'], ans: 2 },
      { q: 'La respiration cellulaire produit ?',  opts: ['O₂','CO₂ + H₂O','Glucose','Chlorophylle'], ans: 1 },
    ],
    physchim_college: [
      { q: 'L\'eau pure est un mélange ?',         opts: ['Homogène','Hétérogène','Chimique','Corps pur'], ans: 3 },
      { q: 'Le changement d\'état liquide → gaz s\'appelle ?', opts:['Fusion','Solidification','Vaporisation','Condensation'], ans: 2 },
      { q: 'L\'atome est électriquement ?',        opts: ['Positif','Négatif','Neutre','Variable'], ans: 2 },
      { q: 'Symbole chimique du fer ?',            opts: ['Fe','F','Fr','Fi'],         ans: 0 },
      { q: 'Masse volumique de l\'eau (g/cm³) ?',  opts: ['0.5','2','1','10'],         ans: 2 },
    ],
    gram_college: [
      { q: 'Pluriel de "cheval" ?',                opts: ['chevals','chevaux','chevales','chevais'], ans: 1 },
      { q: 'Nature de "rapidement" ?',             opts: ['Adjectif','Verbe','Adverbe','Nom'], ans: 2 },
      { q: '"Ils mangent." — Temps du verbe ?',    opts: ['Imparfait','Passé composé','Présent','Futur'], ans: 2 },
      { q: 'Sujet dans "Les oiseaux chantent" ?',  opts: ['Les','oiseaux','chantent','Les oiseaux'], ans: 3 },
      { q: 'Pronom personnel 3ème personne pluriel ?', opts:['Il','Vous','Ils','Nous'], ans: 2 },
    ],
    bepc_fr: [
      { q: 'Un "oxymore" est ?',                   opts: ['Figure de style','Faute de grammaire','Type de poème','Mode verbal'], ans: 0 },
      { q: 'Le subjonctif exprime ?',              opts: ['Certitude','Doute ou souhait','Action passée','Ordre'], ans: 1 },
      { q: '"À verse" dans "il pleuvait à verse" est ?', opts:['COD','CC de manière','CC de lieu','CC de temps'], ans: 1 },
      { q: 'La métaphore est une comparaison ?',   opts: ['Avec "comme"','Avec "tel que"','Sans outil comparatif','Avec "ainsi que"'], ans: 2 },
      { q: 'Temps du récit au passé ?',            opts: ['Présent','Passé composé','Imparfait et passé simple','Futur'], ans: 2 },
    ],
    bepc_pc: [
      { q: 'Formule de l\'eau ?',                  opts: ['HO','H₂O','H₂O₂','HO₂'],  ans: 1 },
      { q: 'Vitesse de la lumière ?',              opts: ['300 000 km/s','30 000 km/s','3 000 000 km/s','150 000 km/s'], ans: 0 },
      { q: 'Un ion positif s\'appelle ?',          opts: ['Anion','Cation','Proton','Électron'], ans: 1 },
      { q: 'L\'atome est électriquement ?',        opts: ['Positif','Négatif','Neutre','Variable'], ans: 2 },
      { q: 'Masse volumique de l\'eau (g/cm³) ?',  opts: ['0.5','2','1','10'],         ans: 2 },
    ],
    hist_geo: [
      { q: 'Empire du Mali fondé vers ?',          opts: ['1235','800','1000','1450'], ans: 0 },
      { q: 'Capitale du Bénin ?',                  opts: ['Lagos','Cotonou','Porto-Novo','Abomey'], ans: 2 },
      { q: 'Qui a colonisé le Bénin ?',            opts: ['Portugal','Belgique','France','Angleterre'], ans: 2 },
      { q: 'Plus grand pays d\'Afrique ?',         opts: ['Nigeria','RDC','Algérie','Soudan du Sud'], ans: 2 },
      { q: 'Fleuve le plus long d\'Afrique ?',     opts: ['Congo','Niger','Nil','Zambèze'], ans: 2 },
    ],
    logique: [
      { q: 'Si tous les chats sont noirs et Félix est un chat, Félix est ?', opts:['Blanc','Noir','Gris','Indéterminé'], ans: 1 },
      { q: 'Suite : 2, 4, 8, 16, __ ?',           opts: ['24','30','32','36'],       ans: 2 },
      { q: 'Si A > B et B > C, alors ?',           opts: ['C>A','A>C','A=C','Indéterminé'], ans: 1 },
      { q: 'Quel nombre est premier ?',            opts: ['9','15','17','21'],        ans: 2 },
      { q: '√144 = ?',                             opts: ['11','12','13','14'],       ans: 1 },
    ],
    general: [
      { q: 'Capitale du Bénin ?',                  opts: ['Lagos','Cotonou','Porto-Novo','Abomey'], ans: 2 },
      { q: 'Combien de côtés a un hexagone ?',     opts: ['5','6','7','8'],           ans: 1 },
      { q: 'Plus grand continent ?',               opts: ['Amérique','Europe','Asie','Afrique'], ans: 2 },
      { q: 'Auteur des "Misérables" ?',            opts: ['Balzac','Flaubert','Victor Hugo','Zola'], ans: 2 },
      { q: 'L\'eau bout à (pression normale) ?',   opts: ['90°C','100°C','110°C','80°C'], ans: 1 },
    ],
  };

  // Questions spécifiques Maghreb
  const maghrebExtra = {
    hist_geo: [
      { q: 'Capital du Maroc ?',                   opts: ['Casablanca','Rabat','Fès','Marrakech'], ans: 1 },
      { q: 'Fleuve traversant l\'Algérie (N) ?',   opts: ['Nil','Chelif','Niger','Sénégal'], ans: 1 },
      { q: 'Indépendance du Maroc ?',              opts: ['1956','1962','1960','1958'], ans: 0 },
      { q: 'Plus haute montagne du Maghreb ?',     opts: ['Atlas','Hoggar','Aurès','Rif'], ans: 0 },
      { q: 'Mer baignant le nord du Maghreb ?',    opts: ['Rouge','Noire','Méditerranée','Caspienne'], ans: 2 },
    ],
  };

  // Questions spécifiques France
  const franceExtra = {
    hist_geo: [
      { q: 'Capitale de la France ?',              opts: ['Lyon','Marseille','Paris','Bordeaux'], ans: 2 },
      { q: 'Nombre de régions en France métropolitaine ?', opts:['13','18','22','27'], ans: 0 },
      { q: 'Fleuve traversant Paris ?',            opts: ['Loire','Rhône','Seine','Garonne'], ans: 2 },
      { q: 'Révolution française ?',               opts: ['1789','1815','1799','1792'], ans: 0 },
      { q: 'Plus haut sommet de France ?',         opts: ['Mont Blanc','Vosges','Pyrénées','Cévennes'], ans: 0 },
    ],
  };

  if (curriculum === 'maghreb') {
    return { ...common, ...maghrebExtra };
  }
  if (curriculum === 'france') {
    return { ...common, ...franceExtra };
  }
  return common;
}

/** Rendu de la liste des défis */
function renderDefis() {
  if (!USER) return;
  const all  = getDefisForUser();
  const list = defFilter === 'tous' ? all : all.filter(c => c.type === defFilter);
  const el   = document.getElementById('ch-list');

  if (!list.length) {
    el.innerHTML = '<p style="color:var(--text3);text-align:center;padding:2rem">Aucun défi pour ce filtre.</p>';
    return;
  }
  el.innerHTML = list.map(c => `
    <div class="ch-item" onclick="launchQuizById('${c.id}')">
      <div class="ch-icon" style="background:${c.bg}">${c.icon}</div>
      <div class="ch-info">
        <h3>${c.title}</h3>
        <p>${c.desc}</p>
        <div class="ch-meta">
          <span class="chip">${c.subject}</span>
          <span class="chip ${c.diff === 'Facile' ? 'green' : c.diff === 'Expert' || c.diff === 'Difficile' ? 'red' : 'gold'}">${c.diff}</span>
          <span class="chip">📝 5 questions</span>
          <span class="chip">⏱ 30s/question</span>
        </div>
      </div>
      <div class="ch-xp">+${c.xp}<div class="xl">XP</div></div>
    </div>
  `).join('');
}

/** Filtrer les défis */
function filterDef(f, el) {
  defFilter = f;
  document.querySelectorAll('.fbtn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderDefis();
}

/** Lancer un quiz par son ID */
function launchQuizById(id) {
  const all = getDefisForUser();
  const c   = all.find(x => x.id === id);
  if (c) launchQuiz(c);
}


/* ── 8. QUIZ ENGINE ──────────────────────────────── */

/** Démarrer un quiz */
function launchQuiz(challenge) {
  activeQuiz = {
    challenge,
    questions: challenge.questions,
    current:   0,
    score:     0
  };
  document.getElementById('q-cat').textContent   = challenge.subject + ' · ' + challenge.diff;
  document.getElementById('q-title').textContent = challenge.title;
  document.getElementById('quiz-overlay').classList.add('show');
  renderQuestion();
}

/** Afficher la question courante */
function renderQuestion() {
  const q = activeQuiz;
  if (q.current >= q.questions.length) { showQuizResult(); return; }

  const question = q.questions[q.current];
  const pct      = Math.round((q.current / q.questions.length) * 100);

  document.getElementById('q-body').innerHTML = `
    <div class="qprog-bar"><div class="qprog-fill" style="width:${pct}%"></div></div>
    <div class="qnum">Question ${q.current + 1} / ${q.questions.length}</div>
    <div class="qtext">${question.q}</div>
    <div class="qopts">
      ${question.opts.map((opt, i) => `
        <div class="qopt" id="o${i}" onclick="answerQuestion(${i})">
          <span class="ql">${'ABCD'[i]}</span>${opt}
        </div>
      `).join('')}
    </div>
    <div class="qfooter">
      <div class="qtimer" id="q-timer">⏱ 30</div>
      <div style="font-size:.78rem;color:var(--text3)">${q.score}/${q.current} correctes</div>
    </div>
  `;
  startQuizTimer(30);
}

/** Démarrer le timer */
function startQuizTimer(sec) {
  clearInterval(quizTimer);
  timerSec = sec;
  quizTimer = setInterval(() => {
    timerSec--;
    const el = document.getElementById('q-timer');
    if (el) {
      el.textContent = `⏱ ${timerSec}`;
      if (timerSec <= 5) el.classList.add('urgent');
    }
    if (timerSec <= 0) { clearInterval(quizTimer); onTimeOut(); }
  }, 1000);
}

/** Temps écoulé */
function onTimeOut() {
  const question = activeQuiz.questions[activeQuiz.current];
  document.querySelectorAll('.qopt').forEach(o => o.classList.add('disabled'));
  document.getElementById('o' + question.ans)?.classList.add('correct');
  setTimeout(() => { activeQuiz.current++; renderQuestion(); }, 1300);
}

/** Répondre à une question */
function answerQuestion(i) {
  clearInterval(quizTimer);
  const question = activeQuiz.questions[activeQuiz.current];
  document.querySelectorAll('.qopt').forEach(o => o.classList.add('disabled'));
  const correct  = (i === question.ans);
  document.getElementById('o' + i).classList.add(correct ? 'correct' : 'wrong');
  if (!correct) document.getElementById('o' + question.ans)?.classList.add('correct');
  if (correct)  activeQuiz.score++;
  setTimeout(() => { activeQuiz.current++; renderQuestion(); }, 1300);
}

/** Afficher le résultat du quiz */
async function showQuizResult() {
  const q     = activeQuiz;
  const total = q.questions.length;
  const pct   = Math.round((q.score / total) * 100);
  const xpEarned = Math.round((q.score / total) * q.challenge.xp);

  const icon = pct >= 80 ? '🏆' : pct >= 60 ? '😊' : pct >= 40 ? '😐' : '😅';
  const msg  = pct >= 80 ? 'Excellent ! Tu maîtrises ça !'
             : pct >= 60 ? 'Bien joué, continue !'
             : pct >= 40 ? 'Pas mal, continue à réviser.'
             : 'Courage, tu vas progresser !';

  document.getElementById('q-body').innerHTML = `
    <div class="result-wrap">
      <div class="result-icon">${icon}</div>
      <div class="result-score">${q.score}/${total}</div>
      <div class="result-msg">${msg}</div>
      <div class="result-sub">${pct}% de réussite</div>
      <div class="xp-won">⚡ +${xpEarned} XP</div>
      <div class="result-btns">
        <button class="btn btn-primary" onclick="closeQuiz()">Continuer</button>
        <button class="btn btn-outline" onclick="retryQuiz()">🔄 Réessayer</button>
      </div>
    </div>
  `;

  await awardXP(xpEarned, true);
}

/** Réessayer le même quiz */
function retryQuiz() {
  const c = activeQuiz.challenge;
  closeQuiz();
  setTimeout(() => launchQuiz(c), 150);
}

/** Fermer le quiz */
function closeQuiz() {
  clearInterval(quizTimer);
  document.getElementById('quiz-overlay').classList.remove('show');
  activeQuiz = null;
  renderDashboard();
}

/** Attribuer des XP et mettre à jour Supabase */
async function awardXP(amount, countQuiz = false) {
  if (!USER || amount <= 0) return;

  USER.xp    = (USER.xp || 0) + amount;
  USER.level = Math.floor(USER.xp / 200) + 1;
  if (countQuiz) USER.quizzes_done = (USER.quizzes_done || 0) + 1;

  document.getElementById('tb-xp').textContent = USER.xp;

  try {
    await updateProfile(USER.id, {
      xp:           USER.xp,
      level:        USER.level,
      quizzes_done: USER.quizzes_done || 0
    });
  } catch (e) { /* silencieux */ }

  toast(`+${amount} XP ⚡`, 'ok');
}


/* ── 9. DUEL ─────────────────────────────────────── */

/** Rechercher des joueurs adversaires */
async function searchPlayers() {
  const q   = document.getElementById('duel-input').value.trim();
  const res = document.getElementById('duel-results');

  if (q.length < 2) { res.innerHTML = ''; return; }

  try {
    const players = await searchUsers(q);
    const found   = players.filter(p => p.id !== USER.id);

    if (!found.length) {
      res.innerHTML = '<p style="color:var(--text3);font-size:.8rem;padding:.4rem 0">Aucun élève trouvé. Invite tes amis !</p>';
      return;
    }
    res.innerHTML = found.map(p => `
      <div class="player-card">
        <div class="pcard-l">
          <div class="pav">${p.avatar}</div>
          <div>
            <div class="pname">${p.username}</div>
            <div class="pmeta">${p.classe} · ${p.country} · ${p.xp} XP</div>
          </div>
        </div>
        <button class="btn btn-gold btn-sm"
          onclick="startDuel('${p.id}','${p.username}','${p.avatar}','${p.xp}')">
          Défier ⚔️
        </button>
      </div>
    `).join('');
  } catch (e) {
    res.innerHTML = '<p style="color:var(--red);font-size:.8rem">Erreur de recherche.</p>';
  }
}

/** Démarrer un duel */
function startDuel(oppId, oppName, oppAv, oppXp) {
  // Cacher zone recherche, montrer arène
  document.getElementById('duel-search-zone').style.display = 'none';
  document.getElementById('duel-active-zone').style.display = 'block';

  // Afficher les joueurs
  document.getElementById('duel-arena-players').innerHTML = `
    <div class="duel-player">
      <div class="duel-av">${USER.avatar}</div>
      <div class="duel-pname">${USER.username}</div>
      <div class="duel-score" id="my-dscore">0</div>
    </div>
    <div class="duel-vs">VS</div>
    <div class="duel-player">
      <div class="duel-av">${oppAv}</div>
      <div class="duel-pname">${oppName}</div>
      <div class="duel-score" id="opp-dscore">0</div>
    </div>
  `;

  // Choisir un défi aléatoire
  const defis = getDefisForUser();
  const ch    = defis[Math.floor(Math.random() * defis.length)];
  const qs    = ch.questions;

  let myScore = 0;
  let duelQ   = 0;

  function renderDuelQuestion() {
    const zone = document.getElementById('duel-qzone');
    if (!zone) return;

    if (duelQ >= qs.length) {
      // Fin du duel — simuler le score adverse
      const oppScore = Math.floor(Math.random() * (qs.length + 1));
      document.getElementById('opp-dscore').textContent = oppScore;

      const won  = myScore > oppScore;
      const tied = myScore === oppScore;
      const xp   = won ? 60 : tied ? 30 : 10;

      awardXP(xp);

      if (won) {
        USER.duels_won = (USER.duels_won || 0) + 1;
        updateProfile(USER.id, { duels_won: USER.duels_won }).catch(() => {});
      } else if (!tied) {
        USER.duels_lost = (USER.duels_lost || 0) + 1;
        updateProfile(USER.id, { duels_lost: USER.duels_lost }).catch(() => {});
      }

      zone.innerHTML = `
        <div style="text-align:center;padding:1.1rem 0">
          <div style="font-size:2.4rem;margin-bottom:.6rem">${won ? '🏆' : tied ? '🤝' : '😅'}</div>
          <h3 style="font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:800;margin-bottom:.4rem">
            ${won ? 'Victoire !' : tied ? 'Égalité !' : 'Défaite...'}
          </h3>
          <p style="color:var(--text2);font-size:.82rem;margin-bottom:1.1rem">
            Toi : ${myScore} pts &nbsp;•&nbsp; ${oppName} : ${oppScore} pts
          </p>
          <button class="btn btn-primary btn-sm" onclick="resetDuel()">Nouveau duel</button>
        </div>
      `;
      return;
    }

    const q = qs[duelQ];
    zone.innerHTML = `
      <div style="font-size:.7rem;color:var(--text3);font-family:'JetBrains Mono',monospace;margin-bottom:.4rem">
        Q${duelQ + 1}/${qs.length}
      </div>
      <div style="font-size:.92rem;font-weight:600;margin-bottom:.9rem;line-height:1.5">${q.q}</div>
      <div style="display:flex;flex-direction:column;gap:.45rem">
        ${q.opts.map((opt, i) => `
          <div id="dopt${i}" onclick="answerDuel(${i}, ${q.ans}, '${oppName}')"
            style="padding:.65rem .85rem;border-radius:10px;border:1.5px solid var(--border);
              background:var(--bg2);cursor:pointer;font-size:.84rem;
              display:flex;align-items:center;gap:.6rem;transition:.15s"
            onmouseover="this.style.borderColor='var(--accent-b)'"
            onmouseout="this.style.borderColor='var(--border)'">
            <span style="width:24px;height:24px;border-radius:6px;background:var(--bg);
              display:inline-flex;align-items:center;justify-content:center;
              font-size:.68rem;font-weight:700;color:var(--text3)">
              ${'ABCD'[i]}
            </span>${opt}
          </div>
        `).join('')}
      </div>
    `;

    // Attacher la fonction de réponse
    window.__duelAnswer = function(i) {
      const correct = (i === q.ans);
      document.querySelectorAll('[id^="dopt"]').forEach(d => d.style.pointerEvents = 'none');
      if (correct) {
        myScore++;
        document.getElementById('my-dscore').textContent = myScore;
        document.getElementById('dopt' + i).style.borderColor = 'var(--green)';
      } else {
        document.getElementById('dopt' + i).style.borderColor = 'var(--red)';
        document.getElementById('dopt' + q.ans).style.borderColor = 'var(--green)';
      }
      duelQ++;
      setTimeout(renderDuelQuestion, 900);
    };
  }

  // Exposer la fonction globalement pour les onclick inline
  window.answerDuel = (i) => window.__duelAnswer(i);

  renderDuelQuestion();
}

/** Réinitialiser la zone duel */
function resetDuel() {
  document.getElementById('duel-search-zone').style.display = 'block';
  document.getElementById('duel-active-zone').style.display = 'none';
  document.getElementById('duel-input').value = '';
  document.getElementById('duel-results').innerHTML = '';
}


/* ── 10. CLASSEMENT ──────────────────────────────── */

async function showRank(scope, el) {
  document.querySelectorAll('.rtab').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');

  const table = document.getElementById('rank-table');
  table.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text3)">Chargement...</div>';

  try {
    let rows = await getLeaderboard(USER.classe, USER.country, scope);

    // Filtrer par région si besoin
    if (scope === 'regional') {
      const myRegion = getRegion(USER.country);
      rows = rows.filter(p => getRegion(p.country) === myRegion);
    }

    if (!rows.length || (rows.length === 1 && rows[0].id === USER.id)) {
      table.innerHTML = `
        <div class="rank-empty">
          <div class="icon">🌐</div>
          <h3>Classement vide pour l'instant</h3>
          <p>Tu es le premier dans ta classe ${scope === 'mondial' ? 'dans le monde' : scope === 'regional' ? 'dans ta région' : 'dans ton pays'} !<br>
          Partage EduBattle pour remplir le classement.</p>
        </div>`;
      return;
    }

    table.innerHTML = rows.map((p, i) => `
      <div class="rank-row ${p.id === USER.id ? 'me' : ''}">
        <div class="rpos ${i === 0 ? 'p1' : i === 1 ? 'p2' : i === 2 ? 'p3' : ''}">
          ${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
        </div>
        <div class="rav">${p.avatar}</div>
        <div class="rinfo">
          <div class="rname">${p.username}${p.id === USER.id ? ' (toi)' : ''}</div>
          <div class="rmeta">${p.classe} · ${p.country}</div>
        </div>
        <div class="rpts">${p.xp}<div class="rl">XP</div></div>
      </div>
    `).join('');

  } catch (e) {
    table.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--red);font-size:.83rem">Erreur de chargement. Vérifie ta connexion internet.</div>';
  }
}

/** Déterminer la région d'un pays */
function getRegion(country) {
  const regions = {
    'Afrique Ouest':    ['Bénin','Togo','Sénégal',"Côte d'Ivoire",'Mali','Burkina Faso','Niger','Guinée','Ghana','Nigeria'],
    'Afrique Centrale': ['Cameroun','Congo','RDC','Gabon','Madagascar','Rwanda'],
    'Maghreb':          ['Maroc','Algérie','Tunisie','Égypte'],
    'Europe':           ['France','Belgique','Suisse'],
    'Amériques':        ['Canada','USA'],
  };
  for (const [region, countries] of Object.entries(regions)) {
    if (countries.includes(country)) return region;
  }
  return 'Autre';
}


/* ── 11. PROFIL ──────────────────────────────────── */

async function renderProfile() {
  if (!USER) return;

  // Recharger les données depuis Supabase pour avoir les stats à jour
  try {
    const fresh = await getProfile(USER.id);
    if (fresh) USER = fresh;
  } catch (e) { /* utiliser les données locales */ }

  const xp    = USER.xp || 0;
  const level = Math.floor(xp / 200) + 1;

  document.getElementById('p-av').textContent    = USER.avatar;
  document.getElementById('p-name').textContent  = USER.username;
  document.getElementById('p-classe').textContent= '📚 ' + USER.classe;
  document.getElementById('p-pays').textContent  = '📍 ' + USER.country;
  document.getElementById('p-xp').textContent    = xp;
  document.getElementById('p-lvl').textContent   = level;
  document.getElementById('p-quiz').textContent  = USER.quizzes_done || 0;
  document.getElementById('p-dw').textContent    = USER.duels_won || 0;
  document.getElementById('p-streak').textContent= USER.max_streak || 0;

  // Rang mondial
  try {
    const lb  = await getLeaderboard(USER.classe, USER.country, 'mondial');
    const pos = lb.findIndex(x => x.id === USER.id) + 1;
    document.getElementById('p-rank').textContent = pos > 0 ? `#${pos}` : '#1';
  } catch (e) {
    document.getElementById('p-rank').textContent = '#?';
  }

  // Badges débloqués
  const badges = [];
  if (xp >= 200)                      badges.push('⭐ Niveau 2');
  if (xp >= 1000)                     badges.push('🔥 Niveau 6');
  if ((USER.quizzes_done || 0) >= 5)  badges.push('📝 5 Quiz');
  if ((USER.quizzes_done || 0) >= 20) badges.push('🎯 20 Quiz');
  if ((USER.duels_won || 0) >= 1)     badges.push('⚔️ Guerrier');
  if ((USER.duels_won || 0) >= 10)    badges.push('🏆 Champion');
  if ((USER.streak || 0) >= 3)        badges.push('🔥 En feu');
  if ((USER.max_streak || 0) >= 7)    badges.push('💎 Régulier');

  const badgesEl = document.getElementById('p-badges');
  badgesEl.innerHTML = badges.length
    ? badges.map(b => `<span class="badge-pill">${b}</span>`).join('')
    : '<span style="color:var(--text3);font-size:.77rem">Complète des défis pour débloquer des badges !</span>';
}


/* ── 12. UTILITAIRES ─────────────────────────────── */

/** Afficher / masquer un message d'erreur */
function showErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('show', !!msg);
}

/** Afficher un toast */
function toast(msg, type = 'info', duration = 3200) {
  const icons = { ok: '✅', err: '❌', info: 'ℹ️' };
  const el    = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

/** Animer un compteur de 0 à target */
function animateNumber(id, target) {
  const el = document.getElementById(id);
  if (!el || !target) return;
  let cur = 0;
  const step = Math.max(1, Math.ceil(target / 25));
  const t = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur;
    if (cur >= target) clearInterval(t);
  }, 40);
}

/** Fermeture quiz via touche Escape */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeQuiz();
});
