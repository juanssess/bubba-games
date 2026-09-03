/* ============================================================
   PROGRESO / BONO DE BIENVENIDA

   Una sola vez por cuenta. Dos partes, como en los casinos de
   verdad:

     1. El bono: fichas al instante, sin condiciones.
     2. El requisito de apuesta: si además apostás 20 veces el
        bono, se libera un premio extra.

   La diferencia con un casino de dinero real es importante y va
   a la vista: acá las fichas del bono son TUYAS desde el primer
   segundo. No quedan "bloqueadas" ni hay letra chica que te
   impida usarlas. El requisito sólo abre un premio adicional; no
   te retiene nada.

   Esa es justamente la trampa clásica de los bonos reales — te
   acreditan algo que todavía no podés tocar — y no tenía sentido
   copiarla en un casino de práctica.

   Depende de: state, wallet, format, ui.
   ============================================================ */
window.MCBienvenida = (function () {
  'use strict';

  var BONO = 10000;
  var MULTIPLO = 20;                    // requisito: 20× el bono
  var PREMIO_EXTRA = 25000;
  var META = BONO * MULTIPLO;

  /* ---------------- estado ---------------- */
  function datos() {
    if (!MC.state.bienvenida) {
      MC.state.bienvenida = { reclamado: false, apostado: 0, extraCobrado: false };
    }
    return MC.state.bienvenida;
  }

  function disponible() { return !datos().reclamado; }

  function progreso() {
    var d = datos();
    return Math.min(1, d.apostado / META);
  }

  function extraListo() {
    var d = datos();
    return d.reclamado && !d.extraCobrado && d.apostado >= META;
  }

  /** Algo pendiente que merezca un punto rojo en el menú. */
  function hayAlgo() { return disponible() || extraListo(); }

  /* ---------------- acciones ---------------- */
  function reclamar() {
    var d = datos();
    if (d.reclamado) return;
    d.reclamado = true;
    MC.addBalance(BONO);
    MC.sound.jackpot();
    MC.modal('¡Bienvenido a Bubba!',
      '<p>Te acreditamos <strong style="color:var(--gold)">' + MC.fmt(BONO) +
      ' fichas</strong>. Son tuyas desde ya: podés usarlas en lo que quieras.</p>' +
      '<p>Y si apostás ' + MULTIPLO + '× el bono (' + MC.fmt(META) + ' fichas en total), ' +
      'se te libera un extra de <strong>' + MC.fmt(PREMIO_EXTRA) + ' fichas</strong>.</p>',
      [{ label: 'A jugar', kind: 'primary' }]);
    MC.save();
  }

  function cobrarExtra() {
    if (!extraListo()) return;
    datos().extraCobrado = true;
    MC.addBalance(PREMIO_EXTRA);
    MC.sound.jackpot();
    MC.toast('¡Completaste el requisito! +' + MC.fmt(PREMIO_EXTRA) + ' fichas', 'win');
    MC.save();
  }

  /**
   * Suma lo apostado. Lo llama la billetera en el cierre de ronda, que es
   * el único lugar por el que pasan todas las apuestas del casino.
   */
  function registrar(apostado) {
    var d = datos();
    if (!d.reclamado || d.extraCobrado) return;
    d.apostado += apostado;
  }

  /* ---------------- tarjeta ---------------- */
  function tarjeta() {
    var d = datos();

    if (!d.reclamado) {
      return '<div class="bv-card bv-oferta">' +
        '<span class="bv-kicker">Bono de bienvenida</span>' +
        '<strong class="bv-monto">' + MC.fmt(BONO) + '</strong>' +
        '<span class="bv-unit">fichas, una sola vez</span>' +
        '<p class="bv-desc">Tuyas al instante y sin condiciones. Si además ' +
        'apostás ' + MULTIPLO + '× el bono, se libera un extra de ' +
        MC.fmt(PREMIO_EXTRA) + '.</p>' +
        '<div class="bv-detalle">' +
          detalle('Bono', MC.fmt(BONO) + ' fichas') +
          detalle('Requisito del extra', MULTIPLO + '× (' + MC.fmt(META) + ')') +
          detalle('Vencimiento', 'No vence') +
        '</div>' +
        '<button class="btn btn-gold btn-block" id="bvClaim">Reclamar el bono</button>' +
        '</div>';
    }

    if (d.extraCobrado) {
      return '<div class="bv-card bv-hecho">' +
        '<span class="bv-kicker">Bono de bienvenida</span>' +
        '<strong class="bv-listo">✓ Completado</strong>' +
        '<p class="bv-desc">Cobraste el bono y el extra. De acá en más las ' +
        'fichas salen del bono recargable, las misiones y el Club VIP.</p>' +
        '</div>';
    }

    var p = Math.round(progreso() * 100);
    var listo = extraListo();
    return '<div class="bv-card' + (listo ? ' bv-oferta' : '') + '">' +
      '<span class="bv-kicker">Extra de bienvenida</span>' +
      '<strong class="bv-monto">' + MC.fmt(PREMIO_EXTRA) + '</strong>' +
      '<span class="bv-unit">fichas al completar el requisito</span>' +
      '<div class="bv-bar"><div class="bv-fill" style="width:' + p + '%"></div></div>' +
      '<div class="bv-prog">' +
        '<span>' + MC.fmt(Math.min(d.apostado, META)) + ' / ' + MC.fmt(META) + ' apostado</span>' +
        '<strong>' + p + '%</strong>' +
      '</div>' +
      (listo
        ? '<button class="btn btn-gold btn-block" id="bvExtra">Cobrar ' + MC.fmt(PREMIO_EXTRA) + ' fichas</button>'
        : '<p class="bv-desc">Seguí jugando: cuenta todo lo que apuestes, ganes o pierdas.</p>') +
      '</div>';
  }

  function detalle(k, v) {
    return '<div class="bv-row"><span>' + k + '</span><strong>' + v + '</strong></div>';
  }

  /** Engancha los botones de la tarjeta. La llama quien la haya dibujado. */
  function enganchar(alCambiar) {
    var c = document.getElementById('bvClaim');
    if (c) c.onclick = function () { reclamar(); if (alCambiar) alCambiar(); };
    var e = document.getElementById('bvExtra');
    if (e) e.onclick = function () { cobrarExtra(); if (alCambiar) alCambiar(); };
  }

  return {
    tarjeta: tarjeta, enganchar: enganchar,
    registrar: registrar, disponible: disponible,
    extraListo: extraListo, hayAlgo: hayAlgo,
    BONO: BONO
  };
})();
