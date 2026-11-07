// The pairing code's countdown on Settings › Phone and price checker.

/** Whole seconds left before `expiresAt` (0 once it has passed). */
export function secondsLeft(expiresAt: number, now: number = Date.now()): number {
    return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

/** 9:05 for 545 seconds. */
export function countdown(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
