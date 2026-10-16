/* The casino supplies the orchestration; the original stays as a standalone
   fallback. This adapter receives the real render events, never guesses from
   DOM changes or settlement amounts. */
import { SlotAudio as BaseAudio } from 'bubba-audio-base';

type CasinoSound = { unlock(): void; providerMuted(value: boolean): void; event(name: string, value?: number): void };
function casino(): CasinoSound | undefined {
  try {
    return (window.parent as unknown as {MC?: {sound?: CasinoSound}}).MC?.sound;
  } catch { return undefined; }
}
function send(name: string, value?: number): boolean {
  const sound = casino();
  if (!sound) return false;
  sound.event(name, value);
  return true;
}
if (casino()) (window as unknown as {MCThemedAudio: boolean}).MCThemedAudio = true;
export class SlotAudio extends BaseAudio {
  override unlock() { const sound = casino(); if (sound) { sound.providerMuted(this.muted); sound.unlock(); } else super.unlock(); }
  override setMuted(value: boolean) { super.setMuted(value); casino()?.providerMuted(value); }
  override click() { if (!send('click')) super.click(); }
  override spinStart() { if (!send('spin')) super.spinStart(); }
  override spinEnd() { if (!send('motionEnd')) super.spinEnd(); }
  override reelStop() { if (!send('reelStop')) super.reelStop(); }
  override scatterHit(count: number) { if (!send('scatter', count)) super.scatterHit(count); }
  override anticipationStart() { if (!send('tension')) super.anticipationStart(); }
  override anticipationEnd() { if (!send('tensionEnd')) super.anticipationEnd(); }
  override countTicks(ms: number) { if (!send('count', ms)) super.countTicks(ms); }
  override win(x: number) { if (!send('win', x)) super.win(x); }
  // MCCinema owns the full intro fanfare; avoid playing two over one another.
  override freeSpins() { if (!send('bonusAward')) super.freeSpins(); }
  override drum() { if (!send('drum')) super.drum(); }
  override climbUp(tier: number) { if (!send('climb', tier)) super.climbUp(tier); }
  override climbStop() { if (!send('reelStop')) super.climbStop(); }
  override climbTop() { if (!send('jackpot')) super.climbTop(); }
  override bigWin(tier: number) { if (!send('jackpot', tier)) super.bigWin(tier); }
}
export const audio = new SlotAudio();
