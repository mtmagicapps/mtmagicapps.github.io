(function () {
  'use strict';

  /* Renders a markdown file (headings, paragraphs, lists, bold, italic, code, links) into #doc-body.
     Source comes from data-src on #doc ({lang} is replaced by en/fr); default is privacy_{lang}.md. */
  var doc = document.getElementById('doc');
  var body = document.getElementById('doc-body');
  var SRC = doc.dataset.src || 'privacy_{lang}.md';
  var ERR = {
    en: doc.dataset.errEn || 'The privacy policy could not be loaded. Open the site over http(s) (not file://) or read ',
    fr: doc.dataset.errFr || 'Impossible de charger la politique de confidentialité. Ouvrez le site via http(s) (pas en file://) ou lisez '
  };
  var cache = {};

  function esc(t) {
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function inline(t) {
    return esc(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
  }

  function render(md) {
    var out = [], para = [], list = false;
    function flushPara() { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } }
    function closeList() { if (list) { out.push('</ul>'); list = false; } }
    md.replace(/\r\n?/g, '\n').split('\n').forEach(function (line) {
      var m;
      if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) {
        flushPara(); closeList();
        out.push('<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>');
      } else if ((m = /^\s*[-*]\s+(.*)$/.exec(line))) {
        flushPara();
        if (!list) { out.push('<ul>'); list = true; }
        out.push('<li>' + inline(m[1]) + '</li>');
      } else if (!line.trim()) {
        flushPara(); closeList();
      } else {
        closeList(); para.push(line.trim());
      }
    });
    flushPara(); closeList();
    return out.join('\n');
  }

  function show(html) {
    body.innerHTML = html;
    var h1 = body.querySelector('h1');
    if (h1) document.title = h1.textContent + ' – VAG Scope | mtmagicapps';
  }

  function current() {
    var lang = document.documentElement.lang === 'fr' ? 'fr' : 'en';
    return { lang: lang, file: SRC.replace('{lang}', lang) };
  }

  function load() {
    var c = current(), file = c.file;
    if (cache[file]) { show(cache[file]); return; }
    fetch(file)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (md) {
        cache[file] = render(md);
        if (current().file === file) show(cache[file]);
      })
      .catch(function () {
        body.innerHTML = '<p>' + ERR[c.lang] + '<a href="' + file + '">' + file + '</a>.</p>';
      });
  }

  document.querySelectorAll('.lang button').forEach(function (b) {
    b.addEventListener('click', load);
  });
  load();
})();
