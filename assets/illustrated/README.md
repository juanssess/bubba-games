# Arte ilustrado de Bubba

Arte original generado con la herramienta integrada ImageGen a partir de una dirección visual de casino cinematográfico. La captura del usuario se utilizó como referencia de ambiente y calidad, sin copiar la marca ni sus símbolos.

## Archivos finales

- `originals-atlas.png`: 16 ilustraciones, cuatro columnas por cuatro filas. Cereza, limón, campana, trébol de jade; estrella, diamante, corona, siete; uva, tigre, bolsa, esmeralda; mina, jet, fichas, as.
- `provider-atlas.png`: 30 ilustraciones, seis columnas por cinco filas. Los índices 0–10 pertenecen a Maverick, 11–21 a Se Busca y 22–29 a La Vendimia. Los identificadores matemáticos se conservan.
- `environments.png`: templo, pueblo western y bodega, en tres paneles iguales de izquierda a derecha.
- `tables-atlas.png`: ruleta decorativa, pelota de cuero y fichas roja/negra, en dos columnas por dos filas. La ruleta ilustrada se utiliza solo en la portada; la rueda jugable conserva sus 37 sectores reales.

Los atlas preservan transparencia. El cliente recorta el margen transparente una sola vez al cargar y utiliza las texturas resultantes durante las animaciones. Se conserva la misma ilustración en el tablero, la tabla de pagos y las portadas.

## Reconstrucción del proveedor

Desde la raíz del casino ejecutar `node tools/build-illustrated-provider.mjs`. Por defecto lee el proyecto hermano `Juegos Casinos` y sus dependencias instaladas. También acepta esa ruta como argumento.

La herramienta aplica únicamente una capa de presentación durante la compilación: reemplaza las tres fábricas de texturas y la escenografía. No escribe en el proyecto hermano ni modifica sus modelos matemáticos o su puente de billetera. Guarda la primera versión anterior del HTML en `backups/provider-before-illustrated.html` y conserva los archivos compilados antiguos para permitir su restauración.

**Para conservar estas ilustraciones en futuras compilaciones, usar esta herramienta.** El comando antiguo del proyecto hermano vuelve a publicar sus dibujos procedurales.

## Prompts finales (herramienta integrada, sin API/CLI)

### Mesas y deportes

Use case: stylized-concept. Four original premium casino and sports videogame sprites in a perfect 2-column by 2-row transparent square atlas. Every object centered at its cell center and occupying at most 65 percent of the cell in both dimensions, generous 17.5 percent alpha-transparent padding on each side, no overlapping cells. TOP LEFT: realistic luxurious European roulette wheel seen from above at very slight angle, polished dark walnut, brass spindle, ivory ball, red black pockets and a single green zero pocket, tiny numbers decorative not legible. TOP RIGHT: photorealistic classic black and ivory stitched leather soccer ball, rich leather grain, clearly visible pentagonal black panels and hexagonal cream panels, dramatic stadium rim light. BOTTOM LEFT: single red enamel casino chip with engraved gold tiger head in center, metal gold beveled rim and ivory edge inlays, straight front view. BOTTOM RIGHT: same single chip in black enamel with engraved gold tiger head, same front view and proportions. Premium detailed cinematic painterly realism, aged brass and rich materials, no emoji style, no cartoon, no flat vector. Objects isolated with alpha background. No words, no brand logos, no text labels. Substantial whitespace between the four objects; no object or shadow touches any cell edge.

### Símbolos propios: dirección inicial

Production sprite atlas for a casino videogame. Exactly 4 columns by 4 rows, 16 equal square cells, isolated objects on genuine alpha transparency. High-end dark fantasy casino art: painterly photorealistic 3D objects, intricate material texture, aged brass edges, sculpted shadows, warm cinematic key light, jewel highlights. Not emojis, not vector clipart, not rounded mobile icons. Subjects in reading order: realistic cherries; textured lemon; engraved antique brass bell; emerald jade clover; ornate gold star with ruby; blue faceted diamond in antique gold setting; royal gold crown; red enamel numeral 7; purple grapes; fierce gold tiger amulet; leather coin pouch; mint emerald cluster; iron mine with fuse; silver jet; red and black engraved poker chips; ornate ivory ace of spades. No brand logos.

### Símbolos propios: edición final

Edit this production sprite atlas for exact game integration. Preserve all 16 objects, their original realistic art style and exact reading order. Crucial change: make EVERY individual object substantially smaller, at most 65% of its cell width AND height, and center it exactly within its own cell. The canvas is a perfectly regular 4-column by 4-row grid of equal SQUARE cells. Every cell has at least 17.5% empty transparent padding on every side. No object, flame, glow, shadow, leaf, airplane wing, coin or card may touch the cell edge or enter a neighbor's cell. Large transparent gutters between all objects. Cell centers are perfectly evenly spaced in both axes. Preserve alpha transparency, no visible grid, no extra objects or labels. We need perfectly regular rectangular extraction, no clipping and no neighboring pixels. Make the objects noticeably smaller than in the reference.

### Proveedor: dirección inicial

Production casino game sprite atlas, six columns by five rows of equal square cells. Premium cinematic hand-painted realism, physically textured worn materials, dramatic warm rim light, detailed game concept art. No emoji style, no vector clipart, no simple cartoon. Original artwork. Reading order: Aztec gold sun stone, turquoise pyramid, feathered serpent, jaguar amulet, jade mask, obsidian skull; carved stone ranks A K Q J 10, western WILD poster; dynamite, leather cowboy hat and bandana, longhorn skull, engraved revolver, sheriff badge, aged ivory A card; aged K Q J 10 cards, pruning shears, oak wine barrel; wine glass, wine bottle, harvest basket, Malbec grapes, vine leaf, golden grape. Transparent padding around each individual sprite.

### Proveedor: edición final

Edit this production sprite atlas for exact game integration. Preserve all 30 objects, their original art style, materials, and exact order. Crucial change: make EVERY individual object substantially smaller, at most 65% of its square cell width AND height, and center it exactly within its own cell. The canvas is a perfectly regular 6-column by 5-row grid of equal SQUARE cells. Every cell has at least 17.5% empty transparent padding on every side. No object, glow, flame, horn, leaf, shadow or card can touch its cell edge or enter a neighbor's cell. There must be large empty transparent horizontal and vertical gutters between ALL objects. All 30 cells have identical dimensions and equally spaced centers. Preserve transparent background. No visible grid, no new objects, no labels. Keep the letters and all symbols identical. Think of uniformly spaced isolated inventory icons, much more whitespace than original. The goal is clean rectangular extraction without any neighboring icon pixels.

### Escenarios

Use case: stylized-concept. A production game environment atlas with THREE equally sized vertical panels side by side, no borders, no text, total panoramic 3:1 composition. Each panel is a standalone square casino game backdrop. LEFT PANEL: ancient overgrown jade-and-gold Mesoamerican temple at twilight, carved stone pillars at edges, tiny fire braziers, mist, gold light, jungle silhouettes. MIDDLE PANEL: atmospheric abandoned western main street at sunset, huge smoky amber setting sun, weathered wooden saloon edges, dusty turquoise dusk shadows, cinematic painterly realism. RIGHT PANEL: luxurious historic Mendoza vineyard wine cellar at golden sunset, oak barrels at edges, vine leaves framing upper corners, distant purple Andes through central arch, wine burgundy shadows and amber lamps. Premium richly textured concept painting, restrained warm light, dark luminous colors. Each panel's central 65 percent kept dark, low-detail and unobstructed so a reel board can sit on top. No slot UI, no symbols, no game title, no text, no people, no watermarks, no cartoon, no emojis. High production value coherent art direction.
