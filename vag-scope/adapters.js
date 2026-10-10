/* Recommended adapters: edit this list to add or change an entry.
   `note` is shown in English, `noteFr` in French. Set `affiliate` to true for
   affiliate links: they get rel="sponsored" and a visible disclosure. */
var RECOMMENDED_ADAPTERS = [
  {
    name: 'vLinker MC-IOS',
    url: 'https://fr.aliexpress.com/item/1005008234720729.html',
    note: 'The adapter this app was tested with, over Bluetooth LE.',
    noteFr: "L'adaptateur avec lequel l'application a été testée, en Bluetooth LE.",
    affiliate: false
  }
];

(function () {
  'use strict';

  var UI = {
    en: { view: 'View adapter', affiliate: 'Affiliate link' },
    fr: { view: 'Voir l’adaptateur', affiliate: 'Lien affilié' }
  };

  var section = document.getElementById('adapters');
  var list = document.getElementById('adapter-list');
  if (!section || !list || !RECOMMENDED_ADAPTERS.length) return;

  function render() {
    var fr = document.documentElement.lang === 'fr';
    var ui = fr ? UI.fr : UI.en;
    list.textContent = '';
    RECOMMENDED_ADAPTERS.forEach(function (a) {
      var li = document.createElement('li');
      li.className = 'adapter';

      var h = document.createElement('h3');
      h.textContent = a.name;
      li.appendChild(h);

      var p = document.createElement('p');
      p.textContent = (fr && a.noteFr) || a.note;
      li.appendChild(p);

      var link = document.createElement('a');
      link.className = 'ghost';
      link.href = a.url;
      link.rel = a.affiliate ? 'sponsored noopener noreferrer' : 'noopener noreferrer';
      link.textContent = ui.view;
      li.appendChild(link);

      if (a.affiliate) {
        var tag = document.createElement('span');
        tag.className = 'adapter-tag';
        tag.textContent = ui.affiliate;
        li.appendChild(tag);
      }
      list.appendChild(li);
    });
  }

  render();
  section.hidden = false;
  /* site.js switches the language by setting <html lang> */
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
