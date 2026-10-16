/**
 * Compila el proveedor (Juegos Casinos) para el casino.
 *
 *   node tools/build-illustrated-provider.mjs [ruta-a-Juegos-Casinos] [--sin-qa]
 *
 * Desde la Fase 2 el arte pintado de cada juego viaja en su propio paquete y
 * el cliente lo carga solo; los ajustes visuales que antes se parcheaban acá
 * (rodillos, caída, carteles) son del cliente. Lo único que agrega el casino:
 *
 *  1. El portero: sin QA aprobado y vigente, ningún juego entra.
 *  2. Las hojas de MCCinema en el index.
 *  3. Su presentación (tools/provider/presentation.ts) en lugar de la del
 *     juego suelto: un módulo con contrato, no parches de texto.
 *  4. El arte de cada juego para el lobby, en assets/illustrated/provider/.
 *
 * No escribe en el proyecto del proveedor ni toca su matemática.
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, copyFileSync, existsSync, cpSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const casino = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const providerArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const provider = resolve(providerArg || resolve(casino, '../Juegos Casinos'));

// Sin QA aprobado y vigente, ningún juego del proveedor entra al casino.
// --sin-qa es solo para pruebas locales: no publicar ese build.
if (process.argv.includes('--sin-qa')) {
  console.warn('\n--sin-qa: se compila SIN verificar el QA del proveedor. No publicar este build.\n');
} else {
  try {
    execFileSync(process.execPath, [resolve(provider, 'tools/qa-check.ts')], { stdio: 'inherit', cwd: provider });
  } catch {
    process.exit(1);
  }
}

// El arte de los juegos, para el lobby (portadas, banners, MCCinema): lo
// exporta el proveedor con un índice que lee illustrated-art.js.
execFileSync(process.execPath, [resolve(provider, 'tools/art-export.ts'), resolve(casino, 'assets/illustrated/provider')], { stdio: 'inherit', cwd: provider });

const { build, transformWithOxc } = await import(pathToFileURL(resolve(provider, 'node_modules/vite/dist/node/index.js')).href);
const target = resolve(casino, 'games/slots');
const output = resolve(casino, 'tmp/illustrated-provider');
if (!output.startsWith(casino + '/') && !output.startsWith(casino + '\\')) throw new Error('Build output must stay in the workspace.');

let replaced = false;
let audioReplaced = false;
let themeReplaced = false;
let holdPaceReplaced = false;
await build({
  configFile: false,
  root: resolve(provider, 'apps/client'),
  base: './',
  cacheDir: resolve(casino, 'tmp/illustrated-cache'),
  build: { outDir: output, emptyOutDir: true },
  plugins: [{
    name: 'bubba-presentation',
    enforce: 'pre',
    resolveId(id) {
      if (id === 'bubba-audio-base') return '\0bubba-audio-base';
      if (id === 'bubba-theme-base') return '\0bubba-theme-base';
      if (id === 'bubba-hold-base') return resolve(provider, 'apps/client/src/play/step-hold.ts') + '?bubba-original';
    },
    load(id) {
      if (id === '\0bubba-audio-base') return readFileSync(resolve(provider, 'apps/client/src/render/audio.ts'), 'utf8');
      if (id === '\0bubba-theme-base') return readFileSync(resolve(provider, 'apps/client/src/render/theme.ts'), 'utf8');
      if (id.endsWith('?bubba-original')) return readFileSync(id.slice(0, -'?bubba-original'.length), 'utf8');
    },
    transformIndexHtml(html) {
      return { html, tags: [
        { tag: 'script', attrs: { src: '../../src/core/spin-pace.js?v=2' }, injectTo: 'head-prepend' },
        { tag: 'script', attrs: { src: '../../src/core/soundtracks.js?v=2' }, injectTo: 'head-prepend' },
        { tag: 'script', attrs: { src: '../../src/core/audio.js?v=83' }, injectTo: 'head-prepend' },
        { tag: 'script', attrs: { src: '../../src/core/provider-audio.js?v=2' }, injectTo: 'head-prepend' },
        { tag: 'link', attrs: { rel: 'stylesheet', href: '../../src/styles/games/cinema.css?v=5' }, injectTo: 'head' },
        { tag: 'script', attrs: { src: '../../src/ui/cinema.js?v=7' }, injectTo: 'head-prepend' },
        // El índice del arte de los juegos: MCCinema lo usa también dentro del juego.
        { tag: 'script', attrs: { src: '../../assets/illustrated/provider/index.js?v=2' }, injectTo: 'head-prepend' },
      ] };
    },
    transform(source, id) {
      if (id === '\0bubba-theme-base') return transformWithOxc(source, 'bubba-theme-base.ts', {sourcemap:false});
      if (id.replaceAll('\\', '/').endsWith('/apps/client/src/render/theme.ts')) {
        themeReplaced = true;
        return readFileSync(resolve(casino, 'tools/provider/theme.ts'), 'utf8');
      }
      if (id.replaceAll('\\', '/').endsWith('/apps/client/src/play/step-hold.ts')) {
        holdPaceReplaced = true;
        return readFileSync(resolve(casino, 'tools/provider/hold-pace.ts'), 'utf8');
      }
      if (id === '\0bubba-audio-base') {
        // Vite transpiles ordinary .ts files; the virtual original needs it explicitly.
        return transformWithOxc(source, 'bubba-audio-base.ts', {sourcemap:false});
      }
      if (id.replaceAll('\\', '/').endsWith('/apps/client/src/render/audio.ts')) {
        audioReplaced = true;
        return readFileSync(resolve(casino, 'tools/provider/audio.ts'), 'utf8');
      }
      if (!id.replaceAll('\\', '/').endsWith('/apps/client/src/presentation.ts')) return null;
      replaced = true;
      const casinoSrc = resolve(casino, 'src').replaceAll('\\', '/');
      return readFileSync(resolve(casino, 'tools/provider/presentation.ts'), 'utf8').replaceAll('__CASINO_SRC__', casinoSrc);
    },
  }],
});
if (!replaced) throw new Error('No se reemplazó apps/client/src/presentation.ts: el proveedor cambió de forma. No se publicó nada.');
if (!audioReplaced) throw new Error('No se conectó el audio del proveedor. No se publicó nada.');
if (!themeReplaced || !holdPaceReplaced) throw new Error('No se aplicó el ritmo de giro del casino. No se publicó nada.');

const backup = resolve(casino, 'backups/provider-before-illustrated.html');
mkdirSync(dirname(backup), { recursive: true });
if (!existsSync(backup)) copyFileSync(resolve(target, 'index.html'), backup);
// Se conservan los archivos con hash viejos, para poder volver al index anterior.
cpSync(output, target, { recursive: true });
console.log('Proveedor listo en games/slots.');
