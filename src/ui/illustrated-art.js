/* Illustrated sprite sheets. Presentation only; symbol IDs and paytables stay in the engines. */
(function () {
  'use strict';
  var nativeUrl = 'assets/illustrated/originals-atlas.png';
  var providerUrl = 'assets/illustrated/provider-atlas.png';
  var nativeImage = new Image();
  var providerImage = new Image();
  var tableImage = new Image();
  var nativeSprites = [];
  // Trim transparent sprite padding once at load; retain the original atlas on disk.
  // `generic` es el id de un juego del proveedor con arte propio (ver MCProviderArt).
  function prepare(image, cols, rows, provider, table, generic) {
    var sheet = document.createElement('canvas');
    sheet.width = image.naturalWidth; sheet.height = image.naturalHeight;
    var context = sheet.getContext('2d');context.drawImage(image,0,0);
    var bands = table || generic ? Array.from({length:rows+1},function(_,k){return k;}) : provider ? [0,253,455,690,897,1145] : [0,314,627,920,1254];
    var css = '';
    for (var i=0;i<cols*rows;i++) {
      var x=Math.round(i%cols*sheet.width/cols), row=Math.floor(i/cols);
      var y=Math.round(bands[row]*sheet.height/bands[rows]);
      var w=Math.round(sheet.width/cols), h=Math.round((bands[row+1]-bands[row])*sheet.height/bands[rows]);
      var pixels=context.getImageData(x,y,w,h).data, left=w,top=h,right=0,bottom=0;
      for(var py=0;py<h;py++) for(var px=0;px<w;px++) {
        if(pixels[(py*w+px)*4+3]>80) { left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py); }
      }
      if(right<left) continue;
      var canvas=document.createElement('canvas'); canvas.width=256;canvas.height=256;
      var sw=right-left+1,sh=bottom-top+1,scale=224/Math.max(sw,sh);
      canvas.getContext('2d').drawImage(image,x+left,y+top,sw,sh,(256-sw*scale)/2,(256-sh*scale)/2,sw*scale,sh*scale);
      if(!provider&&!table&&!generic) nativeSprites[i]=canvas;
      css += '.illustrated-symbol.art-'+(generic?'g-'+generic+'-':table?'t':provider?'p':'n')+i+'{background-image:url("'+canvas.toDataURL('image/png')+'");background-size:100% 100%;background-position:center;}';
    }
    var style=document.createElement('style'); style.textContent=css;document.head.appendChild(style);
  }
  nativeImage.onload=function(){prepare(nativeImage,4,4,false);};
  providerImage.onload=function(){prepare(providerImage,6,5,true);};
  tableImage.onload=function(){prepare(tableImage,2,2,false,true);};
  nativeImage.src = nativeUrl;
  providerImage.src = providerUrl;
  tableImage.src = 'assets/illustrated/tables-atlas.png';
  /* Los juegos del proveedor con arte propio: lo exporta su compilación a
     assets/illustrated/provider/ junto con un índice (MCProviderArt). Así un
     juego nuevo aparece en el lobby con su arte sin tocar este archivo. */
  var PROVIDER_DIR = 'assets/illustrated/provider/';
  var providerArt = window.MCProviderArt || {};
  Object.keys(providerArt).forEach(function (id) {
    var a = providerArt[id], img = new Image();
    img.onload = function () { prepare(img, a.cols, a.rows, false, false, id); };
    img.src = PROVIDER_DIR + a.symbols;
  });
  /** El id del juego del proveedor detrás de una entrada del catálogo (?game=…). */
  function providerIdOf(game) {
    var m = game && game.frameUrl && /[?&]game=([a-z0-9]+)/.exec(game.frameUrl);
    return m && providerArt[m[1]] ? m[1] : null;
  }
  var names = ['Cereza','Limón','Campana','Trébol de jade','Estrella','Diamante','Corona','Siete',
    'Uva','Tigre comodín','Bolsa de monedas','Esmeralda','Mina','Jet','Fichas','As'];
  var faces = ['🍒','🍋','🔔','🍀','⭐','💎','👑','7','🍇','🐯','💰','emerald','💣','🚀','🎴','🃏'];
  var lookup = {};
  faces.forEach(function (face, i) { lookup[face] = i; });
  function escape(s) { return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function sprite(index, provider, label) {
    if(typeof provider==='string' && providerArt[provider]) return '<span class="illustrated-symbol illustrated-generic art-g-'+provider+'-'+index+'" role="img" aria-label="'+escape(label)+'"></span>';
    if(provider==='table') return '<span class="illustrated-symbol illustrated-table art-t'+index+'" role="img" aria-label="'+escape(label)+'" style="--art-x:'+(index%2*100)+'%;--art-y:'+(Math.floor(index/2)*100)+'%"></span>';
    var cols = provider ? 6 : 4, rows = provider ? 5 : 4;
    return '<span class="illustrated-symbol art-' + (provider?'p':'n') + index + (provider ? ' illustrated-provider' : '') + '" role="img" aria-label="' + escape(label || names[index] || 'Símbolo') + '" style="--art-x:' + (index % cols * 100 / (cols - 1)) + '%;--art-y:' + (Math.floor(index / cols) * 100 / (rows - 1)) + '%"></span>';
  }
  function render(face) {
    if (lookup[face] !== undefined) return sprite(lookup[face]);
    return escape(face);
  }
  function draw(ctx, face, x, y, size) {
    var index = lookup[face];
    if(nativeSprites[index]) { ctx.drawImage(nativeSprites[index],x-size/2,y-size/2,size,size);return true; }
    if (index === undefined || !nativeImage.complete || !nativeImage.naturalWidth) return false;
    var cw = nativeImage.naturalWidth / 4, ch = nativeImage.naturalHeight / 4;
    ctx.drawImage(nativeImage, index % 4 * cw, Math.floor(index / 4) * ch, cw, ch, x-size/2, y-size/2, size, size);
    return true;
  }
  var covers = {
    crash:[13,false,'jet'], mines:[11,false,'vault'], slots777:[7,false,'classic'], slots5:[9,false,'temple'],
    maverick:[3,true,'temple'], sebusca:[13,true,'western'], vendimia:[24,true,'wine'],
    plantilla:[14,false,'classic'], roulette:[0,'table','table'], blackjack:[15,false,'table'], sports:[1,'table','sports']
  };
  function cover(game) {
    var c = covers[game.id];
    var pid = !c && providerIdOf(game);
    if (pid) {
      // Portada armada con el arte del juego: su escena de fondo y su emblema.
      var a = providerArt[pid];
      return '<div class="illustrated-cover cover-provider" style="background-image:linear-gradient(#10141844,#07100fcc),url(' + PROVIDER_DIR + a.scene + ')">' +
        '<span class="cover-studio">' + escape(game.studio) + '</span>' + sprite(a.cover, pid, game.name) +
        '<strong class="cover-title">' + escape(game.name) + '</strong></div>';
    }
    if (!c) return '';
    var art = sprite(c[0],c[1],game.name);
    return '<div class="illustrated-cover cover-' + c[2] + '"><span class="cover-studio">' + escape(game.studio) + '</span>' + art + '<strong class="cover-title">' + escape(game.name) + '</strong></div>';
  }
  function icon(game) {
    var c=game && covers[game.id];
    var pid = !c && providerIdOf(game);
    if (pid) return sprite(providerArt[pid].cover, pid, game.name);
    if(!c) return '';
    return sprite(c[0],c[1],game.name);
  }
  window.MCStudioSymbols = { render:render };
  window.MCIllustrated = { render:render, draw:draw, cover:cover, icon:icon };
})();
