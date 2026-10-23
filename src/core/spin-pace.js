/* One-time migration: saved Turbo predates the slower default. Afterwards an
   explicitly selected Turbo remains the player's choice across reloads. */
(function () {
  'use strict';
  try {
    if (localStorage.getItem('bubba.spin-pace.v1')) return;
    ['classic20','sebusca','vendimia','kiosco','feria','carnaval','cataratas','dunas','granpremio','glaciar','milonga','asado','hinchada'].forEach(function (id) {
      localStorage.setItem('turbo.' + id, '0');
    });
    localStorage.setItem('bubba.spin-pace.v1', '1');
  } catch (_) {}
})();
