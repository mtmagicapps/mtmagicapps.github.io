/* Recommended adapters: edit this list to add or change an entry.
   `note` is shown in English, `noteFr` in French. `sellers` lists where to buy
   it, one button each. Set `affiliate` to true on a seller for affiliate links:
   they get rel="sponsored" and a visible disclosure. */
var RECOMMENDED_ADAPTERS = [
  {
    name: 'vLinker MC+',
    sellers: [
      { name: 'AliExpress', url: 'https://fr.aliexpress.com/item/1005008234720729.html', affiliate: false },
      { name: 'Amazon', url: 'https://link.amazon/B0asIddnq', affiliate: true }
    ],
    note: 'The adapter this app was built with',
    noteFr: "L'adaptateur avec lequel l'application a été conçue"
  },
  {
    name: 'vGate iCar Pro 2S',
    sellers: [
      { name: 'AliExpress', url: 'https://a.aliexpress.com/_EGpxdH0', affiliate: false },
      { name: 'Amazon', url: 'https://amzn.to/4hJX0WM', affiliate: true }
    ],
    note: 'The affordable alternative',
    noteFr: "L'alternative abordable"
  },
];

(function () {
  'use strict';

  var UI = {
    en: { view: 'View on ', affiliate: 'Affiliate link' },
    fr: { view: 'Voir sur ', affiliate: 'Lien affilié' }
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

      var sellers = document.createElement('div');
      sellers.className = 'adapter-sellers';
      (a.sellers || []).forEach(function (seller) {
        var link = document.createElement('a');
        link.className = 'ghost';
        link.href = seller.url;
        link.rel = seller.affiliate ? 'sponsored noopener noreferrer' : 'noopener noreferrer';
        link.textContent = ui.view + seller.name;
        sellers.appendChild(link);

        if (seller.affiliate) {
          var tag = document.createElement('span');
          tag.className = 'adapter-tag';
          tag.textContent = ui.affiliate;
          sellers.appendChild(tag);
        }
      });
      if (sellers.children.length) li.appendChild(sellers);
      list.appendChild(li);
    });
  }

  render();
  section.hidden = false;
  /* site.js switches the language by setting <html lang> */
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
