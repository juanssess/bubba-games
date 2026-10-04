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
node tools/test-football-ui.mjs <ruta-absoluta-a-playwright/index.mjs> [URL-local]
```

La segunda prueba requiere el servidor local activo. Usa respuestas controladas
del proveedor, sin apostar sobre partidos reales ni modificar perfiles del
usuario. Cubre horarios UTC/Argentina, filtros, mercados cerrados, pagos unicos,
cancelaciones, fuentes vacias y caidas parciales, en 1366, 390 y 320 pixeles.
Las capturas se guardan en `tmp/requests-football-*.png`.
