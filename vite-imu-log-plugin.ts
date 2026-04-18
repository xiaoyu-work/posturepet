import type { Plugin } from 'vite'
import { spawn } from 'node:child_process'
import { networkInterfaces } from 'node:os'
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface IncomingSample {
  t: number
  x: number
  y: number
  z: number
}

interface LogPayload {
  session?: string
  pace?: number
  note?: string
  samples: IncomingSample[]
}

function getLanUrls(port: number): string[] {
  const urls: string[] = []
  const ifaces = networkInterfaces()
  for (const list of Object.values(ifaces)) {
    if (!list) continue
    for (const info of list) {
      if (info.family === 'IPv4' && !info.internal) {
        urls.push(`http://${info.address}:${port}`)
      }
    }
  }
  return urls
}

/**
 * Dev server extensions for the IMU spike:
 *  - Prints LAN URLs so the user can type them into the Even App webview.
 *  - Exposes POST /api/imu-log to receive sample batches from the phone
 *    and append them to ./imu-logs/<session>.csv on the dev machine.
 */
export function imuLogPlugin(): Plugin {
  const LOG_DIR = resolve(process.cwd(), 'imu-logs')

  return {
    name: 'evenpet-imu-log',
    apply: 'serve',

    configureServer(server) {
      mkdirSync(LOG_DIR, { recursive: true })

      server.middlewares.use('/api/imu-log', (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          })
          res.end()
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('use POST')
          return
        }

        let raw = ''
        req.on('data', (chunk) => {
          raw += chunk
        })
        req.on('end', () => {
          try {
            const body = JSON.parse(raw) as LogPayload
            const session = (body.session || 'session').replace(/[^a-zA-Z0-9_.-]/g, '_')
            const file = resolve(LOG_DIR, `${session}.csv`)
            const header = `# pace=P${body.pace ?? '?'} note=${body.note ?? ''} samples=${body.samples.length}\n`
            const lines: string[] = []
            for (const s of body.samples) {
              lines.push(`${s.t},${s.x},${s.y},${s.z}`)
            }

            // First write creates the file with a header row; subsequent writes append.
            try {
              appendFileSync(file, header + lines.join('\n') + '\n')
            } catch {
              writeFileSync(file, 't_ms,x,y,z\n' + header + lines.join('\n') + '\n')
            }

            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            })
            res.end(JSON.stringify({ ok: true, saved: body.samples.length, file }))
            // eslint-disable-next-line no-console
            console.log(`[imu-log] ${body.samples.length} samples → ${file}`)
          } catch (e) {
            res.writeHead(400, { 'Access-Control-Allow-Origin': '*' })
            res.end(`bad payload: ${String(e)}`)
          }
        })
      })

      const printBanner = (): void => {
        const addr = server.httpServer?.address()
        const actualPort =
          typeof addr === 'object' && addr ? addr.port : (server.config.server.port as number | undefined) ?? 5173
        const urls = getLanUrls(actualPort)
        // eslint-disable-next-line no-console
        console.log('\n' + '='.repeat(60))
        console.log('  EvenPet IMU spike — 真机访问地址')
        console.log('='.repeat(60))
        if (urls.length === 0) {
          console.log('  未检测到局域网 IP。请确认 Wi-Fi 已连接。')
        } else {
          for (const u of urls) {
            console.log(`  宠物:   ${u}/`)
            console.log(`  调试:   ${u}/imu-debug.html`)
          }
        }
        console.log('='.repeat(60))
        console.log('  操作步骤：')
        console.log('    1. 手机和电脑连同一个 Wi-Fi')
        console.log('    2. 打开手机上的 Even Realities App')
        console.log('    3. 用 App 里的「扫一扫」扫描下方二维码')
        console.log('    4. 戴上眼镜，进入 IMU 调试页后点「开启 IMU」')
        console.log(`    5. 做完测试后去电脑的 ${LOG_DIR}/ 找 CSV`)
        console.log('='.repeat(60) + '\n')

        // Fire up `evenhub qr` to print a scannable QR code for the first LAN URL.
        // 先打印到终端；再用 -e 弹出大图（macOS 预览/图片查看器），手机相机更容易扫。
        if (urls.length > 0) {
          const debugUrl = `${urls[0]}/imu-debug.html`
          const inline = spawn('npx', ['--no-install', 'evenhub', 'qr', '-u', debugUrl], {
            stdio: ['ignore', 'inherit', 'inherit'],
            env: process.env,
          })
          inline.on('error', (err) => {
            // eslint-disable-next-line no-console
            console.log(`(终端二维码生成失败：${err.message})`)
          })
          inline.on('exit', () => {
            const big = spawn(
              'npx',
              ['--no-install', 'evenhub', 'qr', '-u', debugUrl, '-e', '-s', '10'],
              { stdio: ['ignore', 'inherit', 'inherit'], env: process.env },
            )
            big.on('error', () => {/* 忽略：大图是锦上添花 */})
            // eslint-disable-next-line no-console
            console.log(`\n  已弹出大图二维码，对着手机相机扫即可。\n  URL: ${debugUrl}\n`)
          })
        }
      }
      if (server.httpServer?.listening) printBanner()
      else server.httpServer?.once('listening', printBanner)
    },
  }
}

// Quiet the unused import for spawn when this file isn't consumed as a server starter.
void spawn
