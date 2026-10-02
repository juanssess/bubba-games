/* Decorative temple motion, isolated from the reels, wallet and game clock. */
export function createMaverickAtmosphere(app, pixi, background) {
  const { Container, Sprite, Texture } = pixi;
  const layer = new Container();
  layer.label = 'maverick-atmosphere';
  layer.eventMode = 'none';
  layer.interactiveChildren = false;
  app.stage.addChild(layer);

  function texture(width, height, paint) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext('2d'));
    return Texture.from(canvas);
  }

  const fire = texture(64, 128, ctx => {
    const colors = ctx.createLinearGradient(0, 0, 0, 128);
    colors.addColorStop(0, '#ffc86800');
    colors.addColorStop(.2, '#ffd470dd');
    colors.addColorStop(.65, '#ffb332ee');
    colors.addColorStop(1, '#f56d1700');
    ctx.fillStyle = colors;
    ctx.beginPath();
    ctx.moveTo(32, 126);
    ctx.bezierCurveTo(-5, 100, 15, 60, 30, 22);
    ctx.bezierCurveTo(25, 55, 47, 50, 42, 4);
    ctx.bezierCurveTo(69, 73, 63, 110, 32, 126);
    ctx.fill();
    ctx.fillStyle = '#fff2bb';
    ctx.beginPath();
    ctx.moveTo(32, 120);
    ctx.bezierCurveTo(15, 103, 27, 85, 31, 66);
    ctx.bezierCurveTo(48, 91, 45, 112, 32, 120);
    ctx.fill();
  });
  const smoke = texture(80, 180, ctx => {
    const colors = ctx.createLinearGradient(0, 0, 0, 180);
    colors.addColorStop(0, '#b9c5bb00');
    colors.addColorStop(.4, '#b9c5bb55');
    colors.addColorStop(1, '#b9c5bb00');
    ctx.strokeStyle = colors;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(42, 178);
    ctx.bezierCurveTo(5, 135, 78, 111, 38, 80);
    ctx.bezierCurveTo(4, 52, 60, 32, 42, 0);
    ctx.stroke();
  });
  const water = texture(40, 160, ctx => {
    const colors = ctx.createLinearGradient(0, 0, 0, 160);
    colors.addColorStop(0, '#d4f6f000');
    colors.addColorStop(.25, '#d4f6f0aa');
    colors.addColorStop(.65, '#b8e7df88');
    colors.addColorStop(1, '#b8e7df00');
    ctx.strokeStyle = colors;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const x = 6 + i * 8;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x - 4, 52, x + 3, 92, x - 1, 158);
      ctx.stroke();
    }
  });

  const width = background.texture.width;
  const height = background.texture.height;
  const waterfalls = [[.446, .279, .012, .070], [.467, .290, .011, .083], [.501, .323, .014, .063]]
    .map(([x, y, w, h]) => {
      const sprite = new Sprite(water);
      sprite.anchor.set(.5, 0);
      sprite.width = w * width;
      sprite.height = h * height;
      sprite.x = x * width;
      layer.addChild(sprite);
      return { sprite, y: y * height, height: sprite.height };
    });
  // Anchors are in the temple image, so cover-cropping stays aligned on mobile.
  const torches = [[.160, .482], [.890, .494]].map(([x, y], index) => {
    const container = new Container();
    container.position.set(x * width, y * height);
    layer.addChild(container);
    const wisps = Array.from({ length: 3 }, (_, i) => {
      const sprite = new Sprite(smoke);
      sprite.anchor.set(.5, 1);
      sprite.width = 28 + i * 5;
      sprite.height = 76 + i * 12;
      container.addChild(sprite);
      return sprite;
    });
    const flame = new Sprite(fire);
    flame.anchor.set(.5, 1);
    flame.width = 19;
    flame.height = 34;
    container.addChild(flame);
    return { flame, wisps, phase: index * 2.4 };
  });

  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let time = 0;
  let elapsed = 0;
  let disposed = false;

  function disabled() {
    if (media.matches || document.body.classList.contains('sin-animaciones')) return true;
    try {
      return window.parent.document.body.classList.contains('sin-animaciones');
    } catch { return false; }
  }

  function paint() {
    layer.visible = !disabled();
    layer.position.copyFrom(background.position);
    layer.scale.copyFrom(background.scale);
    if (!layer.visible) return;
    waterfalls.forEach(({ sprite, y, height }, i) => {
      const t = time * 1.7 + i * 1.9;
      sprite.y = y + Math.sin(t) * 2;
      sprite.height = height + Math.sin(t + 1.2) * 3;
      sprite.alpha = .24 + Math.sin(t * 1.3) * .12;
    });
    torches.forEach(({ flame, wisps, phase }) => {
      const t = time + phase;
      flame.width = 19 + Math.sin(t * 4.2) * 1.4;
      flame.height = 34 + Math.sin(t * 6.7) * 3 + Math.sin(t * 11.1) * 1.3;
      flame.rotation = Math.sin(t * 3.6) * .07;
      flame.alpha = .58 + Math.sin(t * 8.3) * .10;
      wisps.forEach((sprite, i) => {
        const progress = ((t * .14 + i / 3) % 1 + 1) % 1;
        sprite.x = Math.sin(t * .6 + i * 2) * (5 + progress * 10);
        sprite.y = -19 - progress * 56;
        sprite.rotation = Math.sin(t * .4 + i) * .12;
        sprite.alpha = Math.sin(progress * Math.PI) * .23;
      });
    });
  }

  function tick(ticker) {
    if (document.hidden || disposed) return;
    elapsed += Math.min(ticker.deltaMS, 50);
    if (elapsed < 1000 / 30) return;
    if (!disabled()) time += elapsed / 1000;
    elapsed = 0;
    paint();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    app.ticker.remove(tick);
    window.removeEventListener('resize', paint);
    window.removeEventListener('pagehide', dispose);
    media.removeEventListener('change', paint);
    layer.destroy({ children: true });
    fire.destroy(true);
    smoke.destroy(true);
    water.destroy(true);
  }

  paint();
  app.ticker.add(tick);
  window.addEventListener('resize', paint);
  window.addEventListener('pagehide', dispose);
  media.addEventListener('change', paint);
  return { dispose };
}
