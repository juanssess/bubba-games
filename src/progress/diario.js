/* ============================================================
   PROGRESO / DIARIO — el movimiento de cada jugador, día por día.

   El panel de agente necesita contestar "cuánto se apostó HOY".
   Hasta ahora no se podía: `stats` guarda totales de toda la vida,
   sin dimensión temporal, y `history` guarda las últimas 14 rondas
   —es una vitrina para el lobby, no un registro.

   Así que acá se lleva un renglón por día y por jugador:

       diario['2026-09-07'] = { r: rondas, a: apostado, d: devuelto }

   El neto no se guarda: sale de a − d. Guardar un número que se
   puede calcular es una forma barata de que algún día no coincida.

   ---------------------------------------------------------------
   LO QUE ESTO NO PUEDE HACER
   ---------------------------------------------------------------
   Empieza a contar desde que se instala. Las rondas de antes no
   están y no hay forma de recuperarlas: nadie las anotó. El panel
   lo dice en pantalla en vez de mostrar ceros que parezcan datos.

   ---------------------------------------------------------------
   POR QUÉ 90 DÍAS
   ---------------------------------------------------------------
   Cada día ocupa unos 40 bytes. Noventa días son ~4 KB por perfil,
   que en localStorage no molesta a nadie. Sin tope, un casino que
   se usa dos años se lleva el espacio de a poco y sin avisar.

   Las claves son fecha LOCAL, no UTC: el jugador que mira "hoy"
   quiere su hoy, no el de Greenwich.

   Depende de: state. Lo llama wallet en el cierre de ronda.
   ============================================================ */
window.MCDiario = (function () {
  'use strict';

  var DIAS = 90;

  /** 'YYYY-MM-DD' en hora local. */
  function clave(ts) {
    var d = ts ? new Date(ts) : new Date();
    var m = d.getMonth() + 1, x = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (x < 10 ? '0' : '') + x;
  }

  function libro(st) {
    if (!st.diario || typeof st.diario !== 'object') st.diario = {};
    return st.diario;
  }

  /** Tira los días viejos. Se llama al escribir, que es cuando crece. */
  function podar(d) {
    var claves = Object.keys(d);
    if (claves.length <= DIAS) return;
    claves.sort();
    claves.slice(0, claves.length - DIAS).forEach(function (k) { delete d[k]; });
  }

  /**
   * Suma una ronda al día de hoy del perfil activo.
   * La llama la billetera, que es por donde pasan todas las rondas.
   */
  function registrar(apostado, devuelto) {
    if (!(apostado > 0)) return;
    var d = libro(MC.state);
    var k = clave();
    var dia = d[k] || (d[k] = { r: 0, a: 0, d: 0 });
    dia.r += 1;
    dia.a += apostado;
    dia.d += devuelto || 0;
    podar(d);
  }

  /**
   * Suma el período [desde, hasta] de UN estado cualquiera, sea del
   * perfil activo o de otro. Las fechas son claves 'YYYY-MM-DD'; sin
   * ellas, suma todo lo que haya.
   *
   * Devuelve también la serie por día, que es lo que dibuja el gráfico.
   */
  function rango(st, desde, hasta) {
    var d = (st && st.diario) || {};
    var out = { rondas: 0, apostado: 0, devuelto: 0, neto: 0, dias: [], activo: false };

    Object.keys(d).sort().forEach(function (k) {
      if (desde && k < desde) return;
      if (hasta && k > hasta) return;
      var x = d[k];
      out.rondas += x.r || 0;
      out.apostado += x.a || 0;
      out.devuelto += x.d || 0;
      out.dias.push({ dia: k, r: x.r || 0, a: x.a || 0, d: x.d || 0 });
    });

    // Neto DEL CASINO: lo apostado menos lo devuelto. Positivo = ganó la
    // casa. Es la cuenta que mira un agente, al revés de la del jugador.
    out.neto = out.apostado - out.devuelto;
    out.activo = out.rondas > 0;
    return out;
  }

  /** El primer día con movimiento de este estado, o null. */
  function desdeCuando(st) {
    var k = Object.keys((st && st.diario) || {});
    if (!k.length) return null;
    k.sort();
    return k[0];
  }

  return { registrar: registrar, rango: rango, clave: clave, desdeCuando: desdeCuando, DIAS: DIAS };
})();
