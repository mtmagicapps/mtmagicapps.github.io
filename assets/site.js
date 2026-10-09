(function () {
  'use strict';

  var EMAIL = 'sarl.ds.ecom@gmail.com';

  var T = {
    fr: {
      skip: 'Aller au contenu',
      nav_software: 'Logiciels', nav_principles: 'Principes', nav_contact: 'Contact',
      nav_privacy: 'Confidentialité', nav_home: 'Accueil',
      t_vs: 'VAG Scope – diagnostic OBD pour VW, Audi, Seat et Škoda | mtmagicapps',
      t_priv: 'Politique de confidentialité – VAG Scope | mtmagicapps',
      vs_h: 'Le diagnostic constructeur, dans votre poche.',
      vs_p: 'VAG Scope lit les mesures, les codes défaut et le kilométrage de votre VW, Audi, Seat ou Škoda avec un adaptateur ELM327 Bluetooth. Aucun compte, aucun réseau.',
      vs_priv_h: 'Vos données restent chez vous.',
      vs_priv_p: 'VAG Scope n’a pas de permission internet, pas de compte, pas de publicité et pas d’analyse d’usage. Lisez la politique de confidentialité complète.',
      vs_priv_link: 'Politique de confidentialité',
      vs_back: 'Tous les logiciels', more_vs: 'Page de VAG Scope',
      priv_back: '← Retour à VAG Scope', priv_loading: 'Chargement…',
      priv_err: 'Impossible de charger la politique de confidentialité. Écrivez-nous à ' + EMAIL + '.',
      hero_h: 'Des petites applis, faites avec soin.',
      hero_p: 'mtmagicapps est un éditeur de logiciels indépendant. Notre première appli, VAG Scope, transforme votre téléphone en outil de diagnostic pour les Volkswagen, Audi, Seat et Škoda.',
      play_small: 'Disponible sur', hero_more: 'Découvrir VAG Scope',
      sw_h: 'VAG Scope',
      sw_tag: 'Un vrai diagnostic VW, Audi, Seat et Škoda, avec un petit adaptateur Bluetooth et votre téléphone.',
      f1_t: 'Mesures en direct', f1_d: 'Jusqu’à neuf blocs de mesures à la fois, avec min et max, un graphique sur 60 secondes et export CSV.',
      f2_t: 'Tableaux de bord', f2_d: 'Épinglez les valeurs qui vous intéressent, sur le téléphone ou sur l’écran de la voiture via Android Auto.',
      f3_t: 'Codes défaut', f3_d: 'Tous les calculateurs, avec statut, données de contexte et textes clairs. Effacement seulement après sauvegarde et votre confirmation.',
      f4_t: 'Procédures guidées', f4_d: 'Des tests pas à pas écrits par la communauté : mesurer, comparer, conclure, puis partager le rapport.',
      cap_dash: 'Des tableaux de bord à votre main', cap_faults: 'Codes défaut avec données de contexte', cap_proc: 'Procédures avec rapport à partager',
      auto_h: 'Aussi sur l’écran de la voiture', auto_p: 'Affichez jusqu’à quatre valeurs en direct via Android Auto, chacune avec son min et son max.',
      compat: 'Fonctionne avec un adaptateur ELM327 Bluetooth sur les voitures en TP 2.0 (environ 2004–2010) ou en UDS (environ 2012 et après). Android 5.0+, français et anglais. Testée sur une Audi RS6 C6 ; les voitures UDS récentes sont prises en charge mais encore en cours de vérification, vos retours sont les bienvenus.',
      mi_h: 'Comparez le compteur à la mémoire de la voiture.',
      mi_p1: 'VAG Scope lit la distance enregistrée dans chaque calculateur qui en garde une, la compare au tableau de bord et montre son raisonnement : quels calculateurs concordent, lesquels non, et la marge retenue.',
      mi_p2: 'Pratique avant d’acheter une occasion. Le résultat est un indice, jamais une garantie, et l’appli ne dira pas qu’une voiture est « authentique ».',
      pr_h: 'Notre manière de faire',
      pr1_t: 'Elle lit, elle ne réécrit pas.', pr1_d: 'La seule exception est l’effacement des codes défaut, et seulement après une sauvegarde, un contrôle de la batterie et votre confirmation explicite.',
      pr2_t: 'Privée par conception.', pr2_d: 'Pas de compte, pas d’analyse d’usage, pas de permission réseau. Ce que dit votre voiture reste sur votre téléphone.',
      pr3_t: 'Elle montre son raisonnement.', pr3_d: 'Chaque conclusion s’accompagne de ses preuves, pour que vous décidiez jusqu’où lui faire confiance.',
      soon_t: 'D’autres applis arrivent.', soon_d: 'Une idée, ou une voiture qui ne voulait pas vous parler ? Écrivez-nous ci-dessous.',
      ct_h: 'Dites bonjour.',
      ct_p: 'Questions, bugs, résultats de votre voiture : écrivez-nous. Le formulaire ouvre votre messagerie avec le message prêt à envoyer.',
      ct_copy: 'Copier', ct_copied: 'Copié',
      ct_name: 'Votre nom', ct_email: 'Votre e-mail, pour vous répondre', ct_msg: 'Message',
      ct_send: 'Ouvrir dans ma messagerie',
      err_name: 'Indiquez votre nom.', err_email: 'Indiquez une adresse e-mail valide.', err_msg: 'Écrivez votre message.',
      ok: 'Votre messagerie devrait s’ouvrir. Sinon, écrivez directement à ' + EMAIL + '.',
      mail_subject: 'Message depuis le site mtmagicapps',
      legal0: 'Édité par DS ECOM, SASU (société par actions simplifiée unipersonnelle) de droit français, SIREN 884 924 333. Site hébergé par GitHub, Inc.',
      legal1: 'VAG Scope est un produit indépendant. Il n’est ni affilié, ni approuvé, ni parrainé par Volkswagen AG, Audi AG, SEAT, S.A. ou ŠKODA AUTO a.s. Toutes les marques appartiennent à leurs propriétaires respectifs et ne servent qu’à désigner les véhicules compatibles.',
      legal2: 'Google Play est une marque de Google LLC. VAG Scope est une aide au diagnostic et ne remplace pas un contrôle par un professionnel. Ne l’utilisez jamais en conduisant. Les résultats du contrôle du kilométrage sont indicatifs.',
      legal3: 'Ce site n’utilise ni cookies, ni outil d’analyse, ni requêtes vers des services tiers.',
      alt_home: 'Écran d’accueil de VAG Scope avec un véhicule de démonstration connecté et les outils de diagnostic',
      alt_live: 'Écran de mesures en direct de VAG Scope avec des blocs de mesures du moteur',
      alt_dash: 'Tableau de bord avec une tuile de tension de batterie',
      alt_faults: 'Détail d’un code défaut avec les valeurs de contexte',
      alt_proc: 'Résultat d’une procédure guidée marqué conforme',
      alt_auto: 'VAG Scope sur un écran Android Auto avec régime moteur, température du liquide de refroidissement et vitesse',
      alt_m1: 'Résultat du contrôle du kilométrage avec le compteur et un résumé',
      alt_m2: 'Graphique du contrôle du kilométrage comparant les relevés de chaque calculateur'
    }
  };

  var root = document.documentElement;
  var nodes = document.querySelectorAll('[data-i18n]');
  var altNodes = document.querySelectorAll('[data-i18n-alt]');
  var en = {}, enAlt = {};
  nodes.forEach(function (n) { en[n.dataset.i18n] = n.innerHTML; });
  altNodes.forEach(function (n) { enAlt[n.dataset.i18nAlt] = n.getAttribute('alt'); });
  var EN_UI = {
    more_vs: 'VAG Scope page', vs_priv_link: 'Privacy policy',
    err_name: 'Please enter your name.', err_email: 'Please enter a valid email address.', err_msg: 'Please write your message.',
    ok: 'Your mail app should open. If not, write to ' + EMAIL + ' directly.',
    ct_copied: 'Copied', ct_copy: 'Copy', mail_subject: 'Message from the mtmagicapps website'
  };
  var lang = 'en';
  var titleKeyed = !!document.querySelector('title[data-i18n]');

  function s(key) { return (lang === 'fr' && T.fr[key]) || EN_UI[key] || en[key] || ''; }

  function setLang(next, persist) {
    lang = next === 'fr' ? 'fr' : 'en';
    root.lang = lang;
    nodes.forEach(function (n) {
      var k = n.dataset.i18n;
      n.innerHTML = lang === 'fr' && T.fr[k] ? T.fr[k] : en[k];
    });
    altNodes.forEach(function (n) {
      var k = n.dataset.i18nAlt;
      n.setAttribute('alt', lang === 'fr' && T.fr[k] ? T.fr[k] : enAlt[k]);
    });
    if (!titleKeyed) document.title = lang === 'fr' ? 'mtmagicapps – des petites applis, faites avec soin' : 'mtmagicapps – small apps, made with care';
    document.querySelectorAll('.lang button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    });
    var note = document.getElementById('form-note');
    if (note) { note.textContent = ''; note.className = 'form-note'; }
    if (persist) { try { localStorage.setItem('lang', lang); } catch (e) {} }
  }

  document.querySelectorAll('.lang button').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.dataset.lang, true); });
  });

  var saved = null;
  try { saved = localStorage.getItem('lang'); } catch (e) {}
  var pref = saved || ((navigator.language || '').slice(0, 2) === 'fr' ? 'fr' : 'en');
  if (pref === 'fr') setLang('fr', false);

  /* copy address */
  var copyBtn = document.getElementById('copy-btn');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var done = function () {
      copyBtn.textContent = s('ct_copied');
      setTimeout(function () { copyBtn.textContent = s('ct_copy'); }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(EMAIL).then(done, function () {});
    } else {
      var r = document.createRange();
      r.selectNodeContents(document.getElementById('mail-link'));
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    }
  });

  /* contact form: no backend, hands the message to the visitor's mail app */
  var form = document.getElementById('contact-form');
  var note = document.getElementById('form-note');
  var rules = [
    ['f-name', function (v) { return v.trim().length > 0; }, 'err_name'],
    ['f-email', function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }, 'err_email'],
    ['f-msg', function (v) { return v.trim().length > 0; }, 'err_msg']
  ];

  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = null;
    rules.forEach(function (r) {
      var el = document.getElementById(r[0]);
      var ok = r[1](el.value);
      el.setAttribute('aria-invalid', String(!ok));
      if (!ok && !bad) bad = r;
    });
    if (bad) {
      note.className = 'form-note err';
      note.textContent = s(bad[2]);
      document.getElementById(bad[0]).focus();
      return;
    }
    var body = document.getElementById('f-msg').value.trim() + '\n\n—\n' +
      document.getElementById('f-name').value.trim() + '\n' + document.getElementById('f-email').value.trim();
    note.className = 'form-note';
    note.textContent = s('ok');
    window.location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(s('mail_subject')) + '&body=' + encodeURIComponent(body);
  });
  if (form) form.addEventListener('input', function (e) {
    if (e.target.getAttribute('aria-invalid') === 'true') e.target.setAttribute('aria-invalid', 'false');
  });
})();
