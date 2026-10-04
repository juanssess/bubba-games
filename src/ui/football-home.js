window.MCFootballHome = (function () {
  'use strict';
  var root, competition = 'all', view = 'today', automatic = true;
  function escape(t) {
    return String(t || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function crest(team) {
    var fallback = '<span class="fb-monogram" aria-hidden="true">' + escape(team.code) + '</span>';
    var url = MCFootball.image(team.logo);
    return '<span class="fb-crest">' + (url ? '<img src="' + escape(url) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + fallback + '</span>';
  }
  function card(m) {
    var home = MCTeams.get(m.home), away = MCTeams.get(m.away);
    var open = MCFootball.marketOpen(m), live = MCFootball.inPlay(m);
    var label = MCFootball.finished(m) ? 'Final' : MCFootball.cancelled(m) ? 'Suspendido' : live ? MCFootball.liveLabel(m) :
      !m.date ? 'Horario a confirmar' : open ? (MCFootball.day(m.date) === MCFootball.day() ? 'Hoy' :
        new Date(m.date).toLocaleDateString('es-AR', { timeZone: MCFootball.ZONE, day: '2-digit', month: '2-digit' })) : 'Iniciado';
    var time = m.date ? new Date(m.date).toLocaleTimeString('es-AR', {
      timeZone: MCFootball.ZONE, hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
    var score = m.gh !== null && m.ga !== null && (live || MCFootball.finished(m)) ? m.gh + ' - ' + m.ga : time;
    var o = MCFootball.odds(m);
    return '<article class="fb-match" aria-label="' + escape(home.name + ' contra ' + away.name) + '">' +
      '<div class="fb-league"><span>' + escape(m.league) + '</span><small>' + escape(m.country) + '</small></div>' +
      '<div class="fb-versus"><div class="fb-team">' + crest(home) + '<strong>' + escape(home.name) + '</strong></div>' +
        '<div class="fb-kickoff' + (live ? ' fb-inplay' : '') + '"' + (live ? ' title="Ultimo estado informado por la fuente; puede tener demora"' : '') + '><span>' + escape(label) + '</span><b>' + score + '</b></div>' +
        '<div class="fb-team">' + crest(away) + '<strong>' + escape(away.name) + '</strong></div></div>' +
      '<div class="fb-odds">' + [['home', '1', home.name], ['draw', 'X', 'Empate'], ['away', '2', away.name]].map(function (p) {
        return '<button type="button" data-fb-match="' + m.id + '" data-fb-pick="' + p[0] + '"' +
          (open ? '' : ' disabled') + ' title="' + escape(open ? p[2] + ' · Cuota virtual ' + o[p[0]].toFixed(2) : live ? 'Sin cuotas en vivo: apuestas disponibles antes del inicio' : 'Mercado cerrado') +
          '" aria-label="' + escape(p[2] + (open ? ', cuota virtual ' + o[p[0]].toFixed(2) : ', mercado cerrado')) + '">' +
          '<b>' + (open ? o[p[0]].toFixed(2) : '&#8212;') + '</b><span>' + p[1] + '</span></button>';
      }).join('') + '</div></article>';
  }
  function render() {
    if (!root) return;
    var state = MCFootball.status();
    if (automatic && state.ready && !state.loading) view = !state.matches.length && state.upcoming.length ? 'upcoming' : 'today';
    var list = (view === 'today' ? state.matches : state.upcoming).filter(function (m) {
      return competition === 'all' || m.leagueId === competition;
    });
    var old = root.querySelector('.fb-track'), left = old ? old.scrollLeft : 0;
    var focused = root.contains(document.activeElement) ? document.activeElement.id : '';
    root.innerHTML = '<div class="fb-heading"><div><h2 id="footballTitle">' +
      (view === 'today' ? 'F&#250;tbol de hoy' : 'Pr&#243;ximos partidos') + '</h2>' +
      '<span class="fb-date">' + new Date(MCFootball.day() + 'T12:00:00-03:00').toLocaleDateString('es-AR', {
        timeZone: MCFootball.ZONE, weekday: 'long', day: 'numeric', month: 'long' }) + ' &middot; Horarios de Argentina</span></div>' +
      '<div class="fb-actions"><button type="button" id="fbRefresh" class="btn btn-ghost"' + (state.loading ? ' disabled' : '') +
        '>' + (state.loading ? 'Actualizando...' : 'Actualizar') + '</button>' +
        '<button type="button" class="rail-arrow" data-fb-dir="-1" title="Partidos anteriores" aria-label="Partidos anteriores">&#8249;</button>' +
        '<button type="button" class="rail-arrow" data-fb-dir="1" title="Mas partidos" aria-label="Mas partidos">&#8250;</button></div></div>' +
      '<div class="fb-toolbar"><div class="fb-days" aria-label="Fecha de los partidos">' +
        '<button type="button" id="fbToday" data-fb-view="today" aria-pressed="' + (view === 'today') + '">Hoy</button>' +
        '<button type="button" id="fbUpcoming" data-fb-view="upcoming" aria-pressed="' + (view === 'upcoming') + '">Pr&#243;ximos</button></div>' +
        '<select id="fbCompetition" aria-label="Competicion"><option value="all">Todas las competiciones</option>' +
          MCFootball.LEAGUES.map(function (l) { return '<option value="' + l.id + '"' + (competition === l.id ? ' selected' : '') + '>' + escape(l.name) + '</option>'; }).join('') +
        '</select><span class="fb-count" role="status">' + list.length + ' partidos</span></div>' +
      (state.error || state.partial ? '<p class="fb-warning" role="status">' + escape(state.error || 'Algunas competiciones no pudieron actualizarse. Cobertura parcial.') + '</p>' : '') +
      '<div class="fb-track" tabindex="0" aria-label="Partidos de futbol" aria-busy="' + state.loading + '">' +
        (list.length ? list.map(card).join('') : '<div class="fb-empty" role="status">' +
          (state.loading ? 'Buscando partidos...' : state.error ? 'Los partidos no estan disponibles ahora.' :
            view === 'today' ? 'La fuente no tiene partidos de hoy para esta seleccion.' : 'No hay proximos partidos disponibles para esta seleccion.') + '</div>') + '</div>' +
      '<p class="fb-source">Cuotas virtuales orientativas &middot; Cobertura limitada &middot; Sin seguimiento minuto a minuto &middot; ' +
        '<a href="https://www.thesportsdb.com" target="_blank" rel="noopener noreferrer">TheSportsDB</a>' +
        (state.sharedFeed ? ' + <a href="https://www.football-data.org" target="_blank" rel="noopener noreferrer">football-data.org</a>' +
          ' &middot; Datos internacionales con demora &middot; Fuente internacional ' + new Date(state.feedUpdatedAt).toLocaleTimeString('es-AR', { timeZone: MCFootball.ZONE, hour: '2-digit', minute: '2-digit' }) : '') +
        (state.updatedAt ? ' &middot; Actualizado ' + new Date(state.updatedAt).toLocaleTimeString('es-AR', { timeZone: MCFootball.ZONE, hour: '2-digit', minute: '2-digit' }) : '') + '</p>';
    root.querySelector('.fb-track').scrollLeft = left;
    if (focused) { var control = document.getElementById(focused); if (control) control.focus({ preventScroll: true }); }
  }
  function update() {
    if (!document.hidden && MC.getCurrentView() === 'lobby') { render(); MCFootball.refresh(false); }
  }
  function init() {
    root = document.getElementById('footballHome');
    if (!root) return;
    MCFootball.onChange(render);
    root.onclick = function (e) {
      var match = e.target.closest('[data-fb-match]');
      if (match && !match.disabled) { MCSportsbook.selectFromHome(match.dataset.fbMatch, match.dataset.fbPick); return; }
      var date = e.target.closest('[data-fb-view]');
      if (date) { view = date.dataset.fbView; automatic = false; render(); return; }
      var arrow = e.target.closest('[data-fb-dir]');
      if (arrow) root.querySelector('.fb-track').scrollBy({ left: Number(arrow.dataset.fbDir) * 316,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      if (e.target.closest('#fbRefresh')) MCFootball.refresh(true);
    };
    root.onchange = function (e) { if (e.target.id === 'fbCompetition') { competition = e.target.value; render(); } };
    root.addEventListener('error', function (e) { if (e.target.tagName === 'IMG') e.target.hidden = true; }, true);
    MC.onEnter('lobby', update);
    document.addEventListener('visibilitychange', update);
    MC.rtp.onCambio(render);
    setInterval(update, 60000);
    render(); update();
  }
  return { init: init, render: render };
})();
