import type { Game } from '../game.ts'

export interface MarkHost {
  getGame: () => Game | null
  rerender: () => void
}

export function mountMarking(host: MarkHost): void {
  void host
}
