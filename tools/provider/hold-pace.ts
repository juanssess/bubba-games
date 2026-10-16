/* The same factor drives the empty-cell animation and the waits that precede
   landing. Keep collection, settlement and the skip mechanism in the provider. */
import { playHoldStep as baseHoldStep } from 'bubba-hold-base';
import type { SpinStep } from '@casino/protocol';
import type { PlayContext } from './context.ts';

export function playHoldStep(ctx: PlayContext, step: SpinStep, bet: number, prior: number): Promise<void> {
  return baseHoldStep({...ctx, tf: () => ctx.tf() * 1.3}, step, bet, prior);
}
