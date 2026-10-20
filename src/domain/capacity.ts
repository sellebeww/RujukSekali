/** Max slots that may be held per service per day. shortcut: at least one hold is allowed on a day with capacity. */
export function allowedHeld(total: number, ratio: number) {
  return total === 0 ? 0 : Math.max(1, Math.floor(total * ratio));
}
