/* Original scores for the two story games. Uses the common volume and mute. */
(function (global) {
  'use strict';
  if (!global.MCSoundtracks) return;
  var minor = [0, 2, 3, 5, 7, 8, 10];
  global.MCSoundtracks.scores.zonamuerta = {
    name: 'La última noche', bpm: 82, root: 38, lead: 'pad', backing: 'strings', rhythm: 'cinema',
    melody: [0,-1,-1,-1,7,-1,-1,-1,1,-1,-1,0,-1,-1,-1,-1,0,-1,-1,3,-1,-1,7,-1,8,-1,-1,7,-1,3,-1,-1],
    scale: minor, minor: true, chords: [0,8,5,7], meter: 16
  };
  global.MCSoundtracks.scores.lafamilia = {
    name: 'Un asunto de familia', bpm: 94, root: 45, lead: 'piano', backing: 'vibes', rhythm: 'swing',
    melody: [0,-1,7,10,-1,7,3,-1,2,-1,5,7,-1,3,2,-1,0,-1,3,7,-1,10,12,-1,10,-1,7,5,-1,3,2,-1],
    scale: minor, minor: true, chords: [0,5,2,7], meter: 16
  };
})(window);
