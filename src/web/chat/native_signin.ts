// Google sign-in inside the com.kuhy.mahjong Android shell. Google refuses
// OAuth popups in a WebView, so the shell picks the account natively
// (AccountManager) and hands the page a Google ID token; the page turns it
// into a Firebase session with signInWithCredential. Protocol: the page posts
// 'signin' on the MahjongShell channel; the shell calls
// window.mjNativeToken(token | null). In a normal browser there is no channel
// and the popup is used.

export interface ShellWindow {
  MahjongShell?: { postMessage(m: string): void }
  mjNativeToken?: (token: string | null) => void
}

export interface SignInDeps<C> {
  popup: () => Promise<unknown>
  withCred: (cred: C) => Promise<unknown>
  credential: (idToken: string) => C
}

export class SignInCancelled extends Error {}

/** Asks the shell for a Google ID token; null when cancelled or timed out. */
export function requestNativeToken(w: ShellWindow, timeoutMs = 120_000): Promise<string | null> {
  const shell = w.MahjongShell
  if (!shell) return Promise.resolve(null)
  return new Promise((resolve) => {
    const timer = setTimeout(() => finish(null), timeoutMs)
    function finish(t: string | null): void {
      clearTimeout(timer)
      delete w.mjNativeToken
      resolve(t)
    }
    w.mjNativeToken = (t) => finish(typeof t === 'string' && t !== '' ? t : null)
    shell.postMessage('signin')
  })
}

/** Signs in through the shell when present (true), else via the popup (false). */
export async function nativeSignIn<C>(w: ShellWindow, d: SignInDeps<C>): Promise<boolean> {
  if (!w.MahjongShell) {
    await d.popup()
    return false
  }
  const t = await requestNativeToken(w)
  if (t === null) throw new SignInCancelled('no account picked')
  await d.withCred(d.credential(t))
  return true
}
