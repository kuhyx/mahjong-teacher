import { homedir } from 'node:os'
import { join } from 'node:path'
import { startBridge } from './server.ts'

// Entry for the `mahjong-bridge` systemd --user unit and ./run.sh.
const root = join(import.meta.dirname, '../..')
const cfg = {
  port: Number(process.env['MJ_PORT'] ?? '8797'),
  dataDir: process.env['MJ_DATA'] ?? join(homedir(), 'data/mahjong-teacher'),
  distDir: process.env['MJ_DIST'] ?? join(root, 'dist'),
  claudeBin: process.env['CLAUDE_BIN'] ?? join(homedir(), '.local/bin/claude'),
  publicHosts: (process.env['MJ_PUBLIC_HOSTS'] ?? 'mahjong.kuhy.duckdns.org').split(',').filter(Boolean),
}
await startBridge(cfg)
process.stdout.write(`bridge on http://127.0.0.1:${String(cfg.port)}/ data=${cfg.dataDir}\n`)
