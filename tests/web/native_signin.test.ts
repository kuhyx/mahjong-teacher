import { describe, expect, it, vi } from 'vitest'
import { nativeSignIn, requestNativeToken, type ShellWindow } from '../../src/web/chat/native_signin.ts'

/** A fake Android shell: answers 'signin' by calling the page's callback. */
function shellWindow(answer: string | null): ShellWindow & { sent: string[] } {
  const w: ShellWindow & { sent: string[] } = {
    sent: [],
    MahjongShell: {
      postMessage(m: string) {
        w.sent.push(m)
        queueMicrotask(() => w.mjNativeToken?.(answer))
      },
    },
  }
  return w
}

describe('native sign-in (Android WebView shell)', () => {
  it('asks the shell and resolves with its Google ID token', async () => {
    const w = shellWindow('id-token-123')
    await expect(requestNativeToken(w, 1000)).resolves.toBe('id-token-123')
    expect(w.sent).toEqual(['signin'])
  })

  it('resolves null when the user cancels the chooser', async () => {
    await expect(requestNativeToken(shellWindow(null), 1000)).resolves.toBeNull()
  })

  it('signs in with the credential and never opens a popup', async () => {
    const popup = vi.fn()
    const withCred = vi.fn(() => Promise.resolve())
    const credential = vi.fn((t: string) => ({ t }))
    const used = await nativeSignIn(shellWindow('tok'), { popup, withCred, credential })
    expect(used).toBe(true)
    expect(credential).toHaveBeenCalledWith('tok')
    expect(withCred).toHaveBeenCalledWith({ t: 'tok' })
    expect(popup).not.toHaveBeenCalled()
  })

  it('falls back to the popup in a normal browser', async () => {
    const popup = vi.fn(() => Promise.resolve())
    const withCred = vi.fn()
    const used = await nativeSignIn({}, { popup, withCred, credential: (t) => t })
    expect(used).toBe(false)
    expect(popup).toHaveBeenCalledOnce()
    expect(withCred).not.toHaveBeenCalled()
  })
})
