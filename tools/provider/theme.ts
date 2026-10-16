/* Casino presentation pace. Preserve the provider's palette and every math
   setting; only the active renderer's timing is changed. */
import type { Palette, Timing } from '@casino/math';
import { setActiveTheme as setBaseTheme } from 'bubba-theme-base';
export { PALETTE, TIMING } from 'bubba-theme-base';
export type { Palette, Timing } from '@casino/math';

export function setActiveTheme(palette: Palette, timing: Timing): void {
  setBaseTheme(palette, {
    ...timing,
    firstReelStop: Math.max(1300, timing.firstReelStop),
    reelStagger: Math.max(340, timing.reelStagger),
    spinSpeed: timing.spinSpeed * 0.58,
    anticipationSpeed: timing.anticipationSpeed * 0.75,
    freeSpinGap: Math.max(650, timing.freeSpinGap),
  });
}
