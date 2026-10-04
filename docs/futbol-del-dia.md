# Futbol Del Dia

El inicio consulta partidos de Liga Argentina, Premier League, La Liga,
Serie A, Bundesliga, Ligue 1, Champions League y Copa Libertadores.
Las tarjetas muestran equipos, escudos o iniciales, horarios de Buenos Aires,
estado informado por la fuente y botones 1/X/2 para el cupon virtual existente.

## Datos Y Cobertura

Fuente: [TheSportsDB V1](https://www.thesportsdb.com/docs_api_guide), clave
publica de pruebas `123`, ya utilizada para Argentina. No contiene secretos.

- `eventsday.php`: consultas por liga y por dos fechas UTC que cubren el dia
  de Argentina. Los timestamps sin zona se interpretan como UTC.
- `eventsnextleague.php`: proximos encuentros de las ligas ausentes del lote
  diario; tambien se consulta cuando no hay partidos de hoy.
- `lookupevent.php`: comprobacion del resultado de los cupones pendientes.

La cobertura gratuita es limitada, no una cartelera completa ni un servicio
de marcadores minuto a minuto. El proveedor documenta limites de eventos y
30 solicitudes por minuto. El inicio hace entre 16 y 24 consultas, con tres
trabajadores y cache de diez minutos. Los resultados usan su propia cache y
un maximo de ocho consultas por actualizacion. Si se excede la cuota o falla
una liga, la pantalla informa cobertura parcial. No se inventan partidos,
marcadores ni horarios para llenar tarjetas vacias.

La cache no se presenta como la fecha actual despues de medianoche.
Una consulta iniciada el dia anterior tampoco puede publicar su lote como
si fuera de hoy. La liga argentina reutiliza la conversion UTC y descarta
horarios y marcadores ausentes; su cache anterior se reemplaza por una version nueva.
Cuando no hay partidos hoy, se ofrece la vista Proximos. Los escudos remotos
deben usar HTTPS; si no cargan, se muestran iniciales.

## Cuotas Y Cupones

Las cuotas NO son precios de una casa de apuestas. Para Argentina se reutiliza
el modelo de temporada cuando sus datos estan disponibles. Para las otras
ligas, y mientras no este disponible la historia argentina, se usa un modelo
generico de demostracion Poisson/Dixon-Coles con medias 1.35 y 1.10. No usa
estadisticas de los clubes internacionales ni afirma un retorno medido para
ellos. Conserva el margen nominal existente y el factor del panel de la casa.
La etiqueta de retorno medido del catalogo se acota explicitamente a Argentina.

Solo se permiten selecciones antes del horario de inicio y con estado de
prepartido. Se vuelve a comprobar al confirmar. Los mercados de partidos
iniciados, finales, suspendidos o sin hora confirmada permanecen cerrados.
Las selecciones guardan liga, fuente, hora y la cuota elegida.

Un marcador parcial no liquida un cupon. La liquidacion espera un estado final
y ambos goles validos del proveedor. Una cancelacion o abandono confirmado
anula el cupon completo y devuelve la apuesta virtual; un aplazamiento queda
pendiente. No se cambian los cupones argentinos anteriores. Los resultados
internacionales consultados tambien aparecen en la pestana Resultados.

## Verificacion

```text
node tools/test-football.mjs
node tools/test-football-data.mjs
node tools/test-football-ui.mjs <ruta-absoluta-a-playwright/index.mjs> [URL-local]
```

La segunda prueba requiere el servidor local activo. Usa respuestas controladas
del proveedor, sin apostar sobre partidos reales ni modificar perfiles del
usuario. Cubre horarios UTC/Argentina, filtros, mercados cerrados, pagos unicos,
cancelaciones, fuentes vacias y caidas parciales, en 1366, 390 y 320 pixeles.
Las capturas se guardan en `tmp/requests-football-*.png`.

## Segunda Fuente Gratuita

La integracion con [football-data.org](https://www.football-data.org/coverage)
agrega las 12 competiciones gratuitas. Se mantienen Argentina y Libertadores
con TheSportsDB: en total hay 14 competiciones configuradas, no todos los
partidos del mundo. El plan gratuito puede retrasar horarios y resultados.

La pagina NO consulta football-data.org con una clave privada. Una tarea de
GitHub Actions descarga datos cada 30 minutos y publica solo el JSON en la
rama independiente `football-data`, sin tocar el codigo de `master`. Los
visitantes consultan ese archivo publico. GitHub puede demorar o suspender
tareas programadas por inactividad; no es una garantia de tiempo real.

Activacion pendiente hasta tener cuenta, secreto y workflow publicado:

1. Crear una cuenta gratuita en https://www.football-data.org/client/register.
2. En el repositorio, Settings > Secrets and variables > Actions > New
   repository secret, guardar la clave como `FOOTBALL_DATA_TOKEN`.
3. Subir estos cambios a la rama predeterminada del repositorio.
4. En Actions, ejecutar `Actualizar futbol internacional` con Run workflow.
5. Verificar que la rama `football-data` contenga `data/football-data.json`.

Nunca guardar la clave en HTML, JavaScript, JSON publico, commits ni capturas.
No hace falta Firebase Functions, un plan pago nuevo ni un proxy abierto.
GitHub Actions esta sujeto a las cuotas de la cuenta; las ramas protegidas
deben permitir la escritura de la rama de datos por la tarea.

Cada actualizacion hace dos consultas de fechas (ultima semana y proxima
semana) y hasta seis comprobaciones de encuentros antiguos no resueltos,
espaciadas siete segundos. Conserva 90 dias de historial para los cupones.
Un error HTTP, falta de clave o respuesta incompleta conserva el archivo
anterior, nunca publica un vacio como si fuera una actualizacion correcta.
Los cupones sin un resultado disponible siguen pendientes, incluso si ya
quedaron fuera del historial. No se fabrican resultados para liquidarlos.

Para las ligas cubiertas por un archivo reciente se usa esa fuente en vez
de mezclar dos identidades del mismo encuentro. Si el archivo falta o tiene
mas de dos horas, se vuelve a TheSportsDB; sus ligas exclusivas quedan sin
partidos nuevos. Se deshabilitan mercados provenientes de una cache vencida.
Los identificadores llevan prefijos `fd-` y `fd-team-` para evitar colisiones.
Los resultados de cupones anteriores de TheSportsDB siguen verificandose en
su proveedor original. Los mercados son de 90 minutos: un resultado con
prorroga o penales solo liquida si incluye `regularTime`; de otro modo queda
pendiente. El inicio acredita ambas fuentes cuando el archivo esta activo.
