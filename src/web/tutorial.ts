import { TutorialPlayer } from '../tutorial/player.ts'
import { SCENES, tutorialMatch } from '../tutorial/scenes.ts'
import { demoSvg, spotlight } from './render/demo.ts'
import { tableSvg } from './render/table.ts'

// 🎓 tutorial: plays the scenes over a fixed engine-dealt table. Tap anywhere
// (or Space / → / Enter) = next step; ✕ or Esc closes. The game underneath is
// paused and `body.tutorial` keeps taps from reaching it (main.ts).

export interface TutorialHost {
  pause: (on: boolean) => void
}

export function mountTutorial(host: TutorialHost): { open: () => void } {
  let el: HTMLElement | null = null
  let player: TutorialPlayer | null = null
  const table = tableSvg(tutorialMatch(), { playable: [], riichiChoices: null })

  function close(): void {
    el?.remove()
    el = player = null
    document.body.classList.remove('tutorial')
    host.pause(false)
  }

  function draw(): void {
    const c = player?.current()
    if (!el || !c) return close()
    el.dataset['scene'] = c.scene.id
    el.dataset['step'] = String(c.step)
    const demo = el.querySelector('.tut-demo')
    if (demo) demo.innerHTML = demoSvg(c.demo)
    const dots = el.querySelector('.tut-dots')
    if (dots) dots.innerHTML = Array.from({ length: c.total }, (_, i) => `<i class="${i === c.index ? 'on' : i < c.index ? 'past' : ''}"></i>`).join('')
    spotlight(el, c.demo)
  }

  function next(): void {
    if (player?.next()) draw()
    else close()
  }

  function open(): void {
    if (el) return
    host.pause(true)
    document.body.classList.add('tutorial')
    player = new TutorialPlayer(SCENES)
    el = document.createElement('div')
    el.id = 'tutorial'
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-label', 'Tutorial: tap for the next step')
    el.innerHTML = `<div class="tut-table">${table}</div><div class="tut-demo"></div><div class="tut-dots" aria-hidden="true"></div>` +
      '<button id="tut-close" aria-label="Close the tutorial">✕</button>'
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      if ((e.target as Element).closest('#tut-close')) close()
      else next()
    })
    document.body.appendChild(el)
    draw()
  }

  window.addEventListener('keydown', (e) => {
    if (!el) return
    if (e.key === 'Escape') close()
    else if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault()
      next()
    }
  })
  return { open }
}
