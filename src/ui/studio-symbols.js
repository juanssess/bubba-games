/* Original vector artwork shared by reels and paytables. No game mathematics. */
window.MCStudioSymbols = (function () {
  'use strict';
  var drawings = {
    '💎': ['Diamante', '<path d="M19 32 33 16h34l14 16-31 49Z" fill="#42c9df" stroke="#b2fcff" stroke-width="2"/><path d="m19 32 31 49-15-49 15-16 15 16-15 49 31-49Z" fill="#1986b5"/><path d="M19 32h62M33 16l2 16h30l2-16M50 16 35 32l15 49 15-49Z" fill="none" stroke="#9bf3ff" stroke-width="2"/><path d="m24 23 3-9 3 9 9 3-9 3-3 9-3-9-9-3Z" fill="white"/>'],
    '👑': ['Corona', '<path d="m16 28 18 16 16-26 16 26 18-16-9 43H25Z" fill="url(#gold)" stroke="#fff0ae" stroke-width="2"/><path d="M27 65h46v13H27Z" fill="url(#gold)" stroke="#fff0ae" stroke-width="2"/><path d="m50 43 7 10-7 9-7-9Z" fill="#d92f58"/><circle cx="16" cy="26" r="5" fill="#fff0ae"/><circle cx="50" cy="17" r="5" fill="#fff0ae"/><circle cx="84" cy="26" r="5" fill="#fff0ae"/>'],
    '⭐': ['Estrella', '<path d="m50 12 12 25 28 4-20 20 5 28-25-14-25 14 5-28-20-20 28-4Z" fill="url(#gold)" stroke="#fff0ae" stroke-width="2"/><path d="m50 12 1 42-26 35 5-28-20-20 28-4Z" fill="#fff6bd" opacity=".4"/><path d="m50 29 7 17 19 2-14 13 4 18-16-9-16 9 4-18-14-13 19-2Z" fill="none" stroke="#a97528"/>'],
    '🍒': ['Cereza', '<path d="M32 57Q60 42 55 16M68 58Q66 29 55 16" fill="none" stroke="#74ca64" stroke-width="5"/><path d="M55 19Q75 7 83 22 64 34 55 19" fill="#7dc663"/><circle cx="30" cy="65" r="19" fill="url(#ruby)" stroke="#ff8697" stroke-width="2"/><circle cx="69" cy="66" r="19" fill="url(#ruby)" stroke="#ff8697" stroke-width="2"/><path d="M19 61q1-8 9-9m30 10q1-8 9-9" stroke="#ffc0c6" stroke-width="4" stroke-linecap="round" fill="none"/>'],
    '🍋': ['Limón', '<path d="M18 63Q10 29 51 22q25-12 29 11 17 36-24 44-24 13-38-14Z" fill="url(#gold)" stroke="#ffef8b" stroke-width="2"/><path d="M51 22Q55 6 79 13 73 27 51 22" fill="#65b75b"/><path d="M25 51Q28 34 45 32" stroke="#fff7c0" stroke-width="5" fill="none" stroke-linecap="round"/>'],
    '🍀': ['Trébol', '<path d="M49 52q15 18 5 34" fill="none" stroke="#5fba61" stroke-width="6"/><path d="M49 49C6 56 6 17 30 23 18 0 60 3 49 49ZM51 49C44 6 83 6 77 30 100 18 97 60 51 49ZM49 51C56 94 17 94 23 70 0 82 3 40 49 51ZM51 51C94 44 94 83 70 77 82 100 40 97 51 51Z" transform="translate(7 3) scale(.85)" fill="url(#green)" stroke="#a3eb9b" stroke-width="2"/>'],
    '🍇': ['Uva', '<path d="M49 30 54 11M52 21q14-14 29-3-9 16-29 3" stroke="#91d17d" stroke-width="4" fill="#61b563"/><g fill="url(#violet)" stroke="#c8a2ff" stroke-width="1.5"><circle cx="35" cy="39" r="13"/><circle cx="61" cy="39" r="13"/><circle cx="27" cy="57" r="13"/><circle cx="51" cy="58" r="13"/><circle cx="73" cy="56" r="13"/><circle cx="40" cy="75" r="12"/><circle cx="62" cy="75" r="12"/><circle cx="51" cy="87" r="9"/></g>'],
    '🔔': ['Campana', '<circle cx="50" cy="18" r="7" fill="url(#gold)"/><circle cx="50" cy="76" r="10" fill="#cc8a22"/><path d="M20 70q11-9 11-29c0-28 38-28 38 0q0 20 11 29Z" fill="url(#gold)" stroke="#ffed9d" stroke-width="2"/><path d="M17 70h66v8H17Z" fill="url(#gold)" stroke="#ffed9d" stroke-width="2"/><path d="M41 32q-6 6-6 21" stroke="#fff6c9" stroke-width="5" fill="none" stroke-linecap="round"/>'],
    '7': ['Siete', '<path d="M21 17h62v14Q58 55 51 86H27q8-32 30-49H21Z" fill="url(#ruby)" stroke="#ffe3a0" stroke-width="4"/><path d="M29 24h42M37 76q7-21 20-34" fill="none" stroke="#ffb2bb" stroke-width="3"/>'],
    '💰': ['Bolsa de giros gratis', '<path d="m35 14 15 5 16-5-7 21H41Z" fill="url(#gold)" stroke="#ffe5a0" stroke-width="2"/><path d="M40 34Q7 64 23 83q27 12 54 0 16-19-18-49Z" fill="url(#gold)" stroke="#ffe5a0" stroke-width="2"/><path d="M37 35h26" stroke="#763d16" stroke-width="5"/><text x="50" y="73" text-anchor="middle" font-family="Georgia,serif" font-weight="bold" font-size="36" fill="#785016">B</text>'],
    '🐯': ['Tigre comodín', '<path d="M21 38Q9 8 34 19L50 14l16 5Q91 8 79 38v21Q75 80 50 88 25 80 21 59Z" fill="url(#gold)" stroke="#ffe5a0" stroke-width="2"/><path d="m24 26 14 15-15-6m53-9L62 41l15-6M43 17l7 21 7-21M24 48l17 8-16 4m51-12-17 8 16 4" stroke="#3b281b" stroke-width="5" stroke-linejoin="round" fill="none"/><path d="M34 61Q50 50 66 61v12L50 82 34 73Z" fill="#fff0d3"/><path d="m43 62 7 7 7-7Z" fill="#38251c"/><path d="M34 46h8m16 0h8" stroke="#172819" stroke-width="4"/><path d="M50 69v7" stroke="#38251c" stroke-width="2"/>']
  };
  var images = {};
  Object.keys(drawings).forEach(function (face) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>' +
      '<linearGradient id="gold" x2=".7" y2="1"><stop stop-color="#fff7c2"/><stop offset=".45" stop-color="#efc85f"/><stop offset="1" stop-color="#ad641c"/></linearGradient>' +
      '<radialGradient id="ruby" cx=".3" cy=".25" r=".8"><stop stop-color="#ff738e"/><stop offset=".5" stop-color="#e62b55"/><stop offset="1" stop-color="#860d35"/></radialGradient>' +
      '<linearGradient id="green" x2=".7" y2="1"><stop stop-color="#9cf28b"/><stop offset="1" stop-color="#177b4b"/></linearGradient>' +
      '<radialGradient id="violet" cx=".3" cy=".2" r=".8"><stop stop-color="#d3adff"/><stop offset=".45" stop-color="#9858d5"/><stop offset="1" stop-color="#502584"/></radialGradient>' +
      '</defs>' + drawings[face][1] + '</svg>';
    images[face] = '<img class="studio-symbol" src="data:image/svg+xml,' + encodeURIComponent(svg) + '" alt="' + drawings[face][0] + '" draggable="false">';
  });
  return { render: function (face) { return images[face] || face; } };
})();
