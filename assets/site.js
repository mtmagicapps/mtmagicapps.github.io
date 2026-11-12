(function () {
  'use strict';

  /* the address is never written in the page or in plain text here, to keep it away from scrapers; it is only
     assembled when a visitor sends the contact form */
  function address() { return atob('bW9jLmxpYW1nQG1vY2Uuc2QubHJhcw==').split('').reverse().join(''); }

  /* Pages are translated at build time (tools/build.mjs writes the French copies under /fr/).
     Only the messages this script shows itself are here. */
  var lang = document.documentElement.lang === 'fr' ? 'fr' : 'en';
  var UI = {
    en: {
      err_name: 'Please enter your name.', err_email: 'Please enter a valid email address.', err_msg: 'Please write your message.',
      ok: 'Your mail app should open with the message ready to send.',
      mail_subject: 'Message from the mtmagicapps website'
    },
    fr: {
      err_name: 'Indiquez votre nom.', err_email: 'Indiquez une adresse e-mail valide.', err_msg: 'Écrivez votre message.',
      ok: 'Votre messagerie devrait s’ouvrir avec le message prêt à envoyer.',
      mail_subject: 'Message depuis le site mtmagicapps'
    }
  };
  function s(key) { return UI[lang][key]; }

  /* a click on EN/FR is remembered; the inline script in <head> applies it on the next visit */
  document.querySelectorAll('.lang a[data-lang]').forEach(function (a) {
    a.addEventListener('click', function () { try { localStorage.setItem('lang', a.dataset.lang); } catch (e) {} });
  });

  /* car screen carousel (Android Auto / Apple CarPlay) */
  var track = document.getElementById('car-track');
  if (track) {
    var tabs = document.querySelectorAll('.car-tabs button');
    var mark = function (i) {
      tabs.forEach(function (b, k) { b.setAttribute('aria-selected', String(k === i)); });
    };
    tabs.forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +b.dataset.slide;
        track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
        mark(i);
      });
    });
    var ticking = false;
    track.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        mark(Math.round(track.scrollLeft / track.clientWidth));
        ticking = false;
      });
    });
    track.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var i = Math.round(track.scrollLeft / track.clientWidth) + (e.key === 'ArrowRight' ? 1 : -1);
      i = Math.max(0, Math.min(tabs.length - 1, i));
      track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
      e.preventDefault();
    });
  }

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
    window.location.href = 'mailto:' + address() + '?subject=' + encodeURIComponent(s('mail_subject')) + '&body=' + encodeURIComponent(body);
  });
  if (form) form.addEventListener('input', function (e) {
    if (e.target.getAttribute('aria-invalid') === 'true') e.target.setAttribute('aria-invalid', 'false');
  });
})();
