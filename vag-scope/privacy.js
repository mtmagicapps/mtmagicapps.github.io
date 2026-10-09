(function () {
  'use strict';

  /* Renders privacy_en.md / privacy_fr.md (headings, paragraphs, lists, bold, italic, code, links). */
  var body = document.getElementById('doc-body');
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

  function load() {
    var lang = document.documentElement.lang === 'fr' ? 'fr' : 'en';
    if (cache[lang]) { show(cache[lang]); return; }
    fetch('privacy_' + lang + '.md')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (md) {
        cache[lang] = render(md);
        if (document.documentElement.lang === lang || (lang === 'en' && document.documentElement.lang !== 'fr')) show(cache[lang]);
      })
      .catch(function () {
        var fr = lang === 'fr', f = 'privacy_' + lang + '.md';
        body.innerHTML = '<p>' + (fr ? 'Impossible de charger la politique de confidentialité. Ouvrez le site via http(s) (pas en file://) ou lisez ' : 'The privacy policy could not be loaded. Open the site over http(s) (not file://) or read ') + '<a href="' + f + '">' + f + '</a>.</p>';
      });
  }

  document.querySelectorAll('.lang button').forEach(function (b) {
    b.addEventListener('click', load);
  });
  load();
})();
