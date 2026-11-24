/* Progressive-enhancement filter for /vag-scope/models/ (works offline, zero dependencies). */
(function () {
  var q = document.getElementById('model-q');
  var pills = document.querySelectorAll('[data-brand-filter]');
  var rows = document.querySelectorAll('[data-model-row]');
  var empty = document.getElementById('model-empty');
  if (!q || !rows.length) return;
  var brand = 'all';
  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function apply() {
    var term = norm(q.value.trim());
    var shown = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var okBrand = brand === 'all' || r.dataset.brand === brand;
      var okTerm = !term || norm(r.dataset.search).indexOf(term) !== -1;
      var vis = okBrand && okTerm;
      r.hidden = !vis;
      if (vis) shown++;
    }
    if (empty) empty.hidden = shown > 0;
  }
  for (var j = 0; j < pills.length; j++) {
    pills[j].addEventListener('click', function () {
      brand = this.dataset.brandFilter || 'all';
      for (var k = 0; k < pills.length; k++) {
        pills[k].setAttribute('aria-pressed', pills[k] === this ? 'true' : 'false');
      }
      apply();
    });
  }
  q.addEventListener('input', apply);
})();
