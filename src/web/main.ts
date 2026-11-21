import type { MatchLength } from '../engine/match.ts'
import { Audio } from './audio.ts'
import { Game } from './game.ts'
import { mountMarking } from './mark/mount.ts'
import { setIndexLabels } from './render/tile.ts'
import { tableSvg } from './render/table.ts'
import { actOptions } from '../engine/round.ts'
import { actionBar, endScreen, roundResult } from './ui.ts'
import './style.css'

// Boot: URL params pick the mode. `?agent=1` = muted autodrive bot (agent and
// E2E runs); `?seed=N&len=east|hanchan` skips the menu.

const params = new URLSearchParams(location.search)
const agent = params.get('agent') === '1'
const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('no #app')
const audio = new Audio(!agent && localStorage.getItem('mj.sound') === 'on')

app.innerHTML = `<main id="stage"><div id="table-wrap"></div><div id="actions"></div><div id="overlay"></div></main>
<nav id="tools">
  <button id="t-mark" aria-label="Freeze and mark" data-entity="button:mark" data-label="freeze-frame marking button">✎</button>
  <button id="t-sound" aria-label="Sound on or off" data-entity="button:sound" data-label="sound toggle">${audio.on ? '♪' : '♪̸'}</button>
  <button id="t-index" aria-label="Corner index labels on or off" data-entity="button:index" data-label="tile index label toggle">5p</button>
</nav>`

let game: Game | null = null
const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`no #${id}`)
  return el
}

function render(): void {
  if (!game) return
  const g = game
  const playable = g.prompt()?.kind === 'act' ? actOptions(g.round).discards : []
  const riichiChoices = g.riichiMode ? actOptions(g.round).riichi : null
  $('table-wrap').innerHTML = tableSvg(g.match, { playable, riichiChoices })
  $('actions').innerHTML = actionBar(g)
  const overlay = $('overlay')
  overlay.innerHTML = g.screen === 'round_end' ? roundResult(g) : g.screen === 'end' ? endScreen(g) : ''
  document.body.dataset['screen'] = g.screen
}

function startGame(length: MatchLength, seed: number): void {
  const delay = Number(params.get('delay') ?? (agent ? '0' : '450'))
  game = new Game({ seed, length, delay, autodrive: agent || params.get('autodrive') === '1' })
  game.onChange = render
  game.onDiscard = () => audio.clack()
  render()
  game.start()
  audio.startMusic()
}

function menu(): void {
  document.body.dataset['screen'] = 'menu'
  $('overlay').innerHTML = `<div class="panel menu">
    <button class="mode" data-mode="east" data-entity="button:east" data-label="East-only game (tonpuusen)" aria-label="East-only game">東</button>
    <button class="mode" data-mode="hanchan" data-entity="button:hanchan" data-label="full game, East and South rounds (hanchan)" aria-label="Full game, East and South">東南</button></div>`
}

document.addEventListener('click', (ev) => {
  const t = ev.target as Element
  const mode = t.closest<HTMLElement>('[data-mode]')?.dataset['mode']
  if (mode) {
    startGame(mode === 'east' ? 'east' : 'hanchan', Number(params.get('seed') ?? String(Date.now() % 100000)))
    return
  }
  if (!game || document.body.classList.contains('marking')) return
  const act = t.closest<HTMLElement>('[data-act]')?.dataset['act']
  if (act) return onAct(game, act)
  const kind = t.closest<SVGGElement>('g.playable')?.dataset['kind']
  if (kind !== undefined) game.humanAct({ type: 'discard', tile: Number(kind), riichi: game.riichiMode })
})

function onAct(g: Game, act: string): void {
  const [name, a, b] = act.split(':')
  const n = Number(a)
  switch (name) {
    case 'tsumo': return g.humanAct({ type: 'tsumo' })
    case 'riichi': g.riichiMode = !g.riichiMode; return render()
    case 'ankan': return g.humanAct({ type: 'ankan', tile: n })
    case 'shouminkan': return g.humanAct({ type: 'shouminkan', tile: n })
    case 'ron': case 'pon': case 'minkan': case 'pass': return g.humanClaim({ type: name })
    case 'chi': return g.humanClaim({ type: 'chi', tiles: [n, Number(b)] })
    case 'next': return g.advance()
    case 'again': location.reload(); return
  }
}

$('t-sound').addEventListener('click', () => {
  audio.toggle()
  localStorage.setItem('mj.sound', audio.on ? 'on' : 'off')
  $('t-sound').textContent = audio.on ? '♪' : '♪̸'
})
let indexOn = true
$('t-index').addEventListener('click', () => {
  indexOn = !indexOn
  setIndexLabels(indexOn)
  $('t-index').style.opacity = indexOn ? '1' : '0.4'
  render()
})

mountMarking({ getGame: () => game, rerender: render })
const len = params.get('len')
if (len === 'east' || len === 'hanchan') startGame(len, Number(params.get('seed') ?? '1'))
else menu()

declare global {
  interface Window { __mj: { game: () => Game | null; audioOn: () => boolean } }
}
window.__mj = { game: () => game, audioOn: () => audio.on }
