/** A selected build must still enforce QA and leave the current release intact. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const paths=['assets/illustrated/provider/index.js','games/slots/index.html'];
const before=paths.map(p=>readFileSync(p,'utf8'));
for(const selection of ['codexqaunpublishedgate','../draft']){
  const result=spawnSync(process.execPath,['tools/build-illustrated-provider.mjs','--games='+selection],{encoding:'utf8'});
  assert.notEqual(result.status,0,'An unknown or invalid selection cannot publish');
  for(const [i,path] of paths.entries())assert.equal(readFileSync(path,'utf8'),before[i],'The existing release stays intact');
}
console.log('PASS selected build: QA cannot be skipped by selecting a draft; failed builds preserve the current release.');
