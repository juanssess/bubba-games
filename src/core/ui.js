/* ============================================================
   CORE / UI — avisos flotantes y ventana modal.
   Piezas de interfaz genéricas que cualquier módulo puede pedir.
   Sin dependencias.
   ============================================================ */
window.MC = window.MC || {};

(function (MC) {
  'use strict';

  var TOAST_MS = 2600;

  // type: 'info' | 'win' | 'lose'
  function toast(message, type) {
    var wrap = document.getElementById('toasts');
    if (!wrap) return;

    var el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.textContent = message;
    wrap.appendChild(el);

    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 300);
    }, TOAST_MS);
  }

  // actions: [{ label, kind: 'primary'|undefined, onClick }]
  // El modal siempre se cierra antes de ejecutar la acción, así un
  // onClick puede abrir otro modal encima sin pisarse.
  function modal(title, bodyHTML, actions) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;

    var act = document.getElementById('modalActions');
    act.innerHTML = '';
    (actions || [{ label: 'Cerrar' }]).forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'btn ' + (a.kind === 'primary' ? 'btn-accent' : 'btn-ghost');
      b.textContent = a.label;
      b.onclick = function () {
        closeModal();
        if (a.onClick) a.onClick();
      };
      act.appendChild(b);
    });

    document.getElementById('modal').classList.add('open');
  }

  function closeModal() {
    document.getElementById('modal').classList.remove('open');
  }

  MC.toast = toast;
  MC.modal = modal;
  MC.closeModal = closeModal;
})(window.MC);
