/* Casino presentation pace. Preserve the provider's palette and every math
   setting; only the active renderer's timing is changed. */
import type { Palette, Timing } from '@casino/math';
import { setActiveTheme as setBaseTheme } from 'bubba-theme-base';
export { PALETTE, TIMING } from 'bubba-theme-base';
export type { Palette, Timing } from '@casino/math';

export function setActiveTheme(palette: Palette, timing: Timing): void {
  setBaseTheme(palette, {
    ...timing,
    firstReelStop: 1400,
    reelStagger: 380,
    // Keep the symbols moving freely; expectation comes from the final stop.
    spinSpeed: timing.spinSpeed * 0.85,
    anticipationExtra: 1800,
    anticipationSpeed: Math.max(280, timing.anticipationSpeed * 0.5),
    freeSpinGap: Math.max(380, timing.freeSpinGap),
  });
}
