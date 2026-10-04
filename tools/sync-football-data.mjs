import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const COMPETITIONS = ['PL', 'PD', 'SA', 'BL1', 'FL1', 'CL', 'PPL', 'DED', 'ELC', 'BSA', 'WC', 'EC'];
const COMPETITION_IDS = [2021, 2014, 2019, 2002, 2015, 2001, 2017, 2003, 2016, 2013, 2000, 2018];
function compact(row) {
  if (!Number.isInteger(row.id) || !row.competition || !COMPETITIONS.includes(row.competition.code) ||
      !row.homeTeam?.name || !row.awayTeam?.name || !Number.isFinite(Date.parse(row.utcDate))) return null;
  const team = t => ({ id: t.id, name: t.name, shortName: t.shortName, tla: t.tla, crest: t.crest });
  return { id: row.id, utcDate: row.utcDate, status: row.status, matchday: row.matchday,
    minute: Number.isInteger(row.minute) && row.minute >= 0 && row.minute <= 120 ? row.minute : null,
    injuryTime: Number.isInteger(row.injuryTime) && row.injuryTime >= 0 && row.injuryTime <= 30 ? row.injuryTime : null,
    competition: { code: row.competition.code }, homeTeam: team(row.homeTeam), awayTeam: team(row.awayTeam),
    score: row.score, checkedAt: new Date().toISOString() };
}
export async function sync({ token, previous = {}, fetcher = fetch, now = new Date(), pause = ms => new Promise(r => setTimeout(r, ms)) }) {
  if (!token || !token.trim()) throw new Error('Falta el secreto FOOTBALL_DATA_TOKEN. No se publica un feed vacio.');
  const date = days => new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10);
  const request = async path => {
    const response = await fetcher('https://api.football-data.org/v4/' + path, {
      headers: { 'X-Auth-Token': token }, signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error('football-data.org devolvio HTTP ' + response.status);
    return response.json();
  };
  const rows = [];
  // Two small date windows, comfortably below the provider's 10 calls/minute limit.
  for (const [from, to] of [[-7, 1], [1, 8]]) {
    const data = await request('matches?competitions=' + COMPETITION_IDS.join(',') + '&dateFrom=' + date(from) + '&dateTo=' + date(to));
    if (!Array.isArray(data.matches) || !data.resultSet || data.resultSet.count !== data.matches.length)
      throw new Error('Respuesta incompleta: se conserva el feed anterior.');
    rows.push(...data.matches);
    await pause(7000);
  }
  const history = new Map((previous.matches || []).filter(r => Date.parse(r.utcDate) >= now.getTime() - 90 * 86400000).map(r => [r.id, r]));
  rows.forEach(row => { const match = compact(row); if (match) history.set(match.id, match); });
  // Recheck older unresolved fixtures, including postponed games that left the rolling window.
  const unresolved = [...history.values()].filter(r => Date.parse(r.utcDate) < Date.parse(date(-7)) &&
    !['FINISHED', 'CANCELLED', 'AWARDED'].includes(r.status))
    .sort((a, b) => Date.parse(a.checkedAt || 0) - Date.parse(b.checkedAt || 0)).slice(0, 6);
  for (const row of unresolved) {
    const updated = compact(await request('matches/' + row.id));
    if (!updated || updated.id !== row.id) throw new Error('Resultado invalido: no se reemplaza el feed.');
    history.set(row.id, updated);
    await pause(7000);
  }
  return { version: 1, generatedAt: now.toISOString(), competitions: COMPETITIONS,
    matches: [...history.values()].sort((a, b) => Date.parse(a.utcDate) - Date.parse(b.utcDate)) };
}
async function main() {
  let previous = {};
  try { previous = JSON.parse(await readFile('data/football-data.json', 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  const snapshot = await sync({ token: process.env.FOOTBALL_DATA_TOKEN, previous });
  await mkdir('data', { recursive: true });
  await writeFile('data/football-data.json.tmp', JSON.stringify(snapshot) + '\n');
  await rename('data/football-data.json.tmp', 'data/football-data.json');
  console.log('Actualizados ' + snapshot.matches.length + ' partidos; no se publica la clave.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
