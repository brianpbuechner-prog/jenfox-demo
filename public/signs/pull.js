// Which campaigns' signs each pickup route pulls (2 Nov 2026, Brian): Cottage Grove areas take DFL signs only;
// every other route (Hastings, Nininger, Denmark, FENCE, SOUTH) takes the DFL signs plus the local and school board ones.
// Loaded without defer by route.html and org.html so the route page banner and the print sheets both have it.
(function () {
  const DFL = ['Jen Fox', 'Peggy Flanagan', 'Judy Seeberger', 'Amy Klobuchar', 'Statewide DFL: Ellison, Simon, Filipovich'];
  const LOCAL = ['Angie Haus', 'Mitchel Kulage', 'School board: Mark Zuzek, Kinneman, Larson'];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  window.pullGroups = area => /^\s*Cottage Grove/i.test(area || '') ? [['DFL', DFL]] : [['DFL', DFL], ['Local', LOCAL]];
  window.pullListHtml = area => '<ul class="pull">' + window.pullGroups(area).flatMap(g => g[1]).map(n => `<li>${esc(n)}</li>`).join('') + '</ul>';
})();
