/* ============================================================
   UI / CUENTA — perfil, entrar y cambiar de usuario.

   Todo pasa por MC.auth, así que el día que el login sea con
   Google de verdad esta pantalla no cambia: los botones ya están
   y lo único distinto va a ser que hagan algo.

   Depende de: auth, state, ui, format, levels.
   ============================================================ */
window.MCCuenta = (function () {
  'use strict';

  var avatarElegido = null;

  var GOOGLE_SVG =
    '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">' +
    '<path fill="#4285F4" d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v4h6a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.2-4.7 3.2-8z"/>' +
    '<path fill="#34A853" d="M12 23c2.9 0 5.4-1 7.2-2.7l-3.5-2.7a6.6 6.6 0 0 1-9.9-3.5H2.2v2.8A11 11 0 0 0 12 23z"/>' +
    '<path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.2a11 11 0 0 0 0 9.8l3.6-2.8z"/>' +
    '<path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.1 1.6l3.1-3.1A11 11 0 0 0 2.2 7.1l3.6 2.8A6.6 6.6 0 0 1 12 5.4z"/>' +
    '</svg>';


  var APPLE_SVG =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">' +
    '<path d="M16.4 12.8c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.6.9s-1.9-.9-3.1-.8c-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 3 2.3 1.2 0 1.6-.7 3.1-.7s1.9.7 3.1.7c1.3 0 2.1-1.1 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7 0 0-2.5-1-2.7-3.5zM14 5.8c.7-.8 1.1-1.9 1-3-1 0-2.2.6-2.9 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.5 2.9-1.3z"/>' +
    '</svg>';

  /* ---------------- helpers de dibujo ---------------- */
  function grillaAvatares(actual) {
    avatarElegido = actual || MC.auth.AVATARS[0];
    return '<div class="av-grid" id="avGrid">' +
      MC.auth.AVATARS.map(function (a) {
        return '<button class="av' + (a === avatarElegido ? ' on' : '') +
               '" data-av="' + a + '">' + a + '</button>';
      }).join('') +
      '</div>';
  }

  // Los botones del modal se crean después del innerHTML, así que hay
  // que engancharlos a mano cada vez que se abre.
  function engancharAvatares() {
    var grid = document.getElementById('avGrid');
    if (!grid) return;
    grid.onclick = function (e) {
      var b = e.target.closest('.av');
      if (!b) return;
      avatarElegido = b.dataset.av;
      grid.querySelectorAll('.av').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      MC.sound.click();
    };
  }

  function botonProveedor(id, icono, texto) {
    var listo = MC.auth.soporta(id);
    return '<button class="prov-btn" data-prov="' + id + '"' + (listo ? '' : ' disabled') + '>' +
      '<span class="prov-ico">' + icono + '</span>' +
      '<span class="prov-txt">' + texto + '</span>' +
      (listo ? '' : '<span class="prov-soon">pronto</span>') +
      '</button>';
  }

  function engancharProveedores() {
    document.querySelectorAll('.prov-btn').forEach(function (b) {
      b.onclick = function () {
        if (b.disabled) return;
        MC.auth.entrarCon(b.dataset.prov);
      };
    });
  }

  /* ---------------- crear / editar perfil ---------------- */
  function abrirRegistro() {
    MC.sound.click();
    var u = MC.auth.current();
    var esNuevo = !u || u.guest;
    var nombreActual = (u && !u.guest) ? u.name.replace(/"/g, '&quot;') : '';

    var body =
      '<div class="auth-provs">' +
        botonProveedor('google', GOOGLE_SVG, 'Continuar con Google') +
        botonProveedor('apple', APPLE_SVG, 'Continuar con Apple') +
      '</div>' +
      '<div class="auth-sep"><span>o creá tu perfil acá</span></div>' +
      '<label class="auth-label">Tu nombre</label>' +
      '<input type="text" id="regName" class="filter-input auth-input" maxlength="18" ' +
        'placeholder="Como querés que te llamen" value="' + nombreActual + '">' +
      '<label class="auth-label">Elegí tu ficha</label>' +
      grillaAvatares(u ? u.avatar : null) +
      '<p class="auth-legal">El perfil se guarda en este navegador. Las fichas son ' +
      'virtuales: no se compran ni se cobran.</p>';

    // El modal cierra ANTES de correr onClick, así que el valor del input
    // se lee acá adentro, mientras el campo todavía existe.
    var leerYConfirmar = function () {
      var campo = document.getElementById('regName');
      confirmar(campo ? campo.value : '', esNuevo);
    };

    MC.modal(esNuevo ? 'Crear cuenta' : 'Editar perfil', body, [
      { label: 'Cancelar' },
      { label: esNuevo ? 'Crear cuenta' : 'Guardar', kind: 'primary', onClick: leerYConfirmar }
    ]);

    engancharAvatares();
    engancharProveedores();

    var input = document.getElementById('regName');
    if (input) {
      input.focus();
      input.select();
      input.onkeydown = function (e) {
        if (e.key === 'Enter') { MC.closeModal(); leerYConfirmar(); }
      };
    }
  }

  function confirmar(nombre, esNuevo) {
    nombre = (nombre || '').trim();
    if (!nombre) {
      MC.toast('Poné un nombre para tu perfil', 'lose');
      return;
    }
    if (esNuevo) MC.auth.registrar(nombre, avatarElegido);
    else MC.auth.renombrar(nombre, avatarElegido);
    MC.sound.win();
    MC.toast('¡Hola, ' + nombre + '!', 'win');
    pintarTopbar();
  }

  /* ---------------- panel de cuenta ---------------- */
  function fila(k, v, color) {
    return '<div class="acc-row"><span>' + k + '</span>' +
      '<strong' + (color ? ' style="color:' + color + '"' : '') + '>' + v + '</strong></div>';
  }

  function abrirCuenta() {
    MC.sound.click();
    var u = MC.auth.current();
    var s = MC.state.stats;
    var t = MCLevels.current();
    var netColor = s.net >= 0 ? 'var(--green)' : 'var(--red)';
    var otros = MC.auth.all().filter(function (x) { return x.uid !== u.uid; });

    var body =
      '<div class="acc-head">' +
        '<span class="acc-av">' +
          (u.photo
            ? '<img src="' + u.photo + '" alt="" referrerpolicy="no-referrer">'
            : u.avatar) +
        '</span>' +
        '<div class="acc-id">' +
          '<strong>' + u.name + '</strong>' +
          '<span>' + t.ico + ' ' + t.name +
            (u.guest ? ' · sin registrar' : '') +
            (u.provider === 'google' ? ' · Google' : '') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="acc-grid">' +
        fila('Saldo', MC.fmt(MC.getBalance()) + ' fichas', 'var(--gold)') +
        fila('Rondas jugadas', MC.fmt(s.plays)) +
        fila('Total apostado', MC.fmt(s.wagered)) +
        fila('Mejor golpe', '+' + MC.fmt(s.best), 'var(--green)') +
        fila('Balance neto', (s.net >= 0 ? '+' : '') + MC.fmt(s.net), netColor) +
      '</div>' +
      (otros.length
        ? '<label class="auth-label">Cambiar de perfil</label>' +
          '<div class="acc-users">' +
            otros.map(function (x) {
              return '<button class="acc-user" data-uid="' + x.uid + '">' +
                '<span>' + x.avatar + '</span>' + x.name + '</button>';
            }).join('') +
          '</div>'
        : '') +
      '<p class="auth-legal">Las fichas son virtuales y se guardan sólo en este navegador. ' +
      'No hay dinero real involucrado.</p>';

    var acciones = [{ label: 'Cerrar', kind: 'primary' }];
    if (u.guest) {
      acciones.unshift({ label: 'Crear cuenta', onClick: abrirRegistro });
    } else {
      // El nombre de una cuenta de Google lo manda Google, no se edita acá.
      if (u.provider === 'local') acciones.unshift({ label: 'Editar', onClick: abrirRegistro });
      acciones.unshift({ label: 'Salir', onClick: MC.auth.salir });
    }

    MC.modal('Tu cuenta', body, acciones);

    document.querySelectorAll('.acc-user').forEach(function (b) {
      b.onclick = function () { MC.auth.usar(b.dataset.uid); };
    });
  }

  /* ---------------- topbar ---------------- */
  function pintarTopbar() {
    var u = MC.auth.current();
    if (!u) return;
    var av = document.getElementById('userAvatar');
    var nm = document.getElementById('userName');
    var reg = document.getElementById('registerBtn');

    // Con cuenta de Google se muestra su foto; con perfil local, la ficha.
    if (av) {
      if (u.photo) av.innerHTML = '<img src="' + u.photo + '" alt="" referrerpolicy="no-referrer">';
      else av.textContent = u.avatar;
    }
    if (nm) nm.textContent = u.guest ? 'Invitado' : u.name;
    // Al invitado se le ofrece registrarse; al que ya tiene perfil no se
    // le muestra un botón que ya no le sirve.
    if (reg) reg.style.display = u.guest ? '' : 'none';
  }

  function init() {
    var box = document.getElementById('userBox');
    if (box) box.onclick = abrirCuenta;
    var reg = document.getElementById('registerBtn');
    if (reg) reg.onclick = abrirRegistro;

    MC.auth.onChange(pintarTopbar);
    pintarTopbar();
  }

  return {
    init: init,
    abrirCuenta: abrirCuenta,
    abrirRegistro: abrirRegistro,
    pintarTopbar: pintarTopbar
  };
})();
