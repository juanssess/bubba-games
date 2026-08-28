/* ============================================================
   CORE / ROUTER — decide qué se muestra en pantalla.

   La idea central del proyecto: el router NO conoce juegos,
   conoce MOTORES. Cada entrada del catálogo declara con cuál se
   juega (engine: 'slots') y le pasa su configuración al abrirse.
   Por eso 121 tragamonedas distintas comparten un solo motor y
   sumar cien títulos más no toca una línea de código de juego.

   Un id puede ser:
     - una vista del portal: 'lobby', 'catalog'
     - el id de un juego del catálogo: 'crash', 'g1042', ...

   Depende de: ui (para el aviso de salida bloqueada).
   ============================================================ */
window.MC = window.MC || {};

(function (MC) {
  'use strict';

  var games = {};        // catálogo completo, lo carga catalog.js
  var engines = {};      // motor por nombre
  var hooks = { enter: {}, leave: {} };
  var guards = {};       // un motor puede bloquear la salida si hay ronda en curso

  var currentEngine = 'lobby';
  var currentGame = null;

  function registerGames(map) { games = map; }
  function registerEngine(name, api) { engines[name] = api; }
  function guard(engineName, fn) { guards[engineName] = fn; }
  function getGame(id) { return games[id] || null; }

  function onEnter(engineName, fn) { hooks.enter[engineName] = fn; }
  function onLeave(engineName, fn) { hooks.leave[engineName] = fn; }

  function getCurrentView() { return currentEngine; }
  function getCurrentGame() { return currentGame; }

  function showView(id) {
    var meta = games[id] || null;
    var engine = meta ? meta.engine : id;

    var target = document.getElementById('view-' + engine);
    if (!target) return;

    var changing = engine !== currentEngine || (meta && id !== currentGame);
    if (changing && guards[currentEngine] && guards[currentEngine]()) {
      MC.toast('Terminá la ronda antes de salir.', 'lose');
      return;
    }
    if (hooks.leave[currentEngine]) hooks.leave[currentEngine]();

    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    target.classList.add('active');

    // El escenario sólo se abre para juegos; 'lobby' y 'catalog' son del portal.
    document.getElementById('stage').classList.toggle('open', !!meta);

    currentGame = meta ? id : null;
    currentEngine = engine;

    if (meta) {
      document.getElementById('stageTitle').textContent = meta.name;
      document.getElementById('stageTag').textContent = meta.tag || '';
      if (engines[engine] && engines[engine].load) engines[engine].load(meta);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (hooks.enter[engine]) hooks.enter[engine]();
  }

  MC.showView = showView;
  MC.registerGames = registerGames;
  MC.registerEngine = registerEngine;
  MC.getGame = getGame;
  MC.guard = guard;
  MC.onEnter = onEnter;
  MC.onLeave = onLeave;
  MC.getCurrentView = getCurrentView;
  MC.getCurrentGame = getCurrentGame;
})(window.MC);
