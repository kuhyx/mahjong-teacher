import { mkdtempSync } from 'node:fs'
import type { Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, type Browser, type Page } from 'playwright-core'
import { startBridge, type BridgeConfig } from '../services/bridge/server.ts'

// Shared harness: a temp-data bridge with the stub claude, serving dist/, and a
// muted headless Chromium (the system one; no browser download).

export const ROOT = join(import.meta.dirname, '..')
export const SHOTS = process.env['MJ_SHOTS'] ?? join(ROOT, 'shots')

export interface Harness {
  cfg: BridgeConfig
  server: Server
  browser: Browser
  page: Page
  base: string
  close: () => Promise<void>
}

export async function harness(viewport = { width: 1280, height: 800 }, touch = false): Promise<Harness> {
  const cfg: BridgeConfig = {
    port: 0, dataDir: mkdtempSync(join(tmpdir(), 'mj-e2e-')), distDir: join(ROOT, 'dist'),
    claudeBin: join(ROOT, 'tests/stub/claude'), env: { STUB_CLAUDE_LOG: join(tmpdir(), 'mj-e2e-claude.jsonl') },
  }
  const server = await startBridge(cfg)
  const browser = await chromium.launch({
    executablePath: process.env['CHROMIUM'] ?? '/usr/bin/chromium',
    args: ['--mute-audio', '--no-first-run', '--disable-extensions', '--headless=new'],
  })
  const page = await browser.newPage({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => process.stderr.write(`pageerror: ${e.message}\n`))
  const base = `http://127.0.0.1:${String(cfg.port)}`
  return {
    cfg, server, browser, page, base,
    close: async () => {
      await browser.close()
      server.close()
    },
  }
}
