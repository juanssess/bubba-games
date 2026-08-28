/* ============================================================
   CORE / FORMATO — cómo se escriben números y tiempos en pantalla.
   Sin dependencias.
   ============================================================ */
window.MC = window.MC || {};

(function (MC) {
  'use strict';

  // 12345 → "12.345" (separador de miles a la española)
  function fmt(n) {
    var sign = n < 0 ? '-' : '';
    return sign + Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // 2.4567 → "2.45x" (siempre truncado hacia abajo: nunca prometer de más)
  function fmtMult(x) {
    return (Math.floor(x * 100) / 100).toFixed(2) + 'x';
  }

  // Milisegundos → "3 h 20 min"
  function humanTime(ms) {
    var totalMin = Math.ceil(ms / 60000);
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    return h > 0 ? h + ' h ' + m + ' min' : m + ' min';
  }

  MC.fmt = fmt;
  MC.fmtMult = fmtMult;
  MC.humanTime = humanTime;
})(window.MC);
