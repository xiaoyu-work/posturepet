# 真机调试手册 — G2 眼镜 IMU 联调

G2 眼镜本身**没有浏览器、没有 JS 引擎**。你的 web 代码跑在手机 Even Realities App 的 WebView 里，通过 SDK 桥经蓝牙驱动眼镜。

## 每次开发的标准流程

开 3 个终端，**都保持开着**。

### 终端 A — 启动 dev server

```bash
cd /Users/jay/workspace/evenpet
npm run dev
```

Vite 启动在 `http://localhost:5173`。

### 终端 B — 启动 Cloudflare 隧道

```bash
cloudflared tunnel --url http://localhost:5173
```

会打印：
```
Your quick Tunnel has been created!
https://xxx-yyy-zzz.trycloudflare.com
```

> **为什么要隧道？** iPhone 开热点时，电脑拿到的是 `192.0.0.2/32` 点对点地址，手机自己走蜂窝出网，访问不到这个 IP。普通 Wi-Fi 网络下可以跳过这步，直接让手机访问电脑 LAN IP。

### 终端 C — 为隧道 URL 生成二维码

```bash
# 小图（普通扫）
npx --no-install evenhub qr -u https://xxx-yyy-zzz.trycloudflare.com/imu-debug.html

# 大图（扫不到时用）
npx --no-install evenhub qr -u https://xxx-yyy-zzz.trycloudflare.com/imu-debug.html -e -s 10
```

把 `xxx-yyy-zzz.trycloudflare.com` 换成终端 B 打印的实际域名。

## 用 Even App 扫码

1. 打开手机 **Even Realities App**
2. 进入**开发者模式** / **Developer**（"我的"/"设置"底部）
3. 点里面的**扫一扫**
4. 扫终端里的二维码

> ⚠️ **必须用开发者模式的扫一扫**。用手机相机、Safari、微信扫会跳到系统浏览器，**SDK 桥不会被注入**，`getDeviceInfo` 返回 null，所有设备 API 全失败。

## 验证

WebView 加载后，`/imu-debug.html` 的事件日志里应出现：

```
桥接已连接
getDeviceInfo 返回：{ "model": ..., "status": { "connectType": ..., "batteryLevel": ... } }
设备状态：佩戴=true 电量=... 连接=...
```

点**开启 IMU**后数据开始流；CSV 自动上传到电脑的 `./imu-logs/<session>.csv`。

## 一次性配置（已完成）

- `brew install cloudflared`（macOS 装一次）
- `vite.config.ts` 里 `server.allowedHosts: true`（否则 Vite 拦外部域名）
- `vite-imu-log-plugin.ts`：启动时打印 LAN URL + 本地二维码；`/api/imu-log` 接收手机上传的样本写到 `./imu-logs/`

## 踩过的坑（遇到直接对照）

| 症状 | 原因 | 解法 |
|---|---|---|
| 扫完网页空白 / 超时 | Wi-Fi 客户端隔离或 iPhone 热点 /32 点对点地址 | 用 cloudflared 隧道 |
| 页面加载后 `Blocked request. This host is not allowed.` | Vite 默认只允许 localhost | `vite.config.ts` → `server.allowedHosts: true` |
| 页面加载后 `getDeviceInfo` 返回 null，所有 SDK 调用失败 | 用了普通浏览器/相机扫码 | 用 Even App 开发者模式扫一扫 |
| `createStartUpPageContainer` 返回 1 (invalid) | 容器参数不合规（尺寸太小等） | 参考 `src/app/g2-ui.ts` 里已验证能工作的配置 |
| 二维码扫完手机一直转圈 | localhost.run/loca.lt 有首屏拦截页，Even WebView 过不去 | 换 cloudflared |
| 换 Wi-Fi / 关过 dev server 后二维码失效 | 隧道 URL / LAN IP 变了 | 重新跑终端 B + C |

## IMU 数据规格（Phase 0 实测）

- **x, y, z = 加速度，单位 g**（静止 |v| ≈ 1）
- **P100 实际 ≈ 10 Hz**（P200–P1000 未测，推测按 ×N 递增）
- 静止 σ ≈ 0.2，低头 30° 使 z 从 1 变到 ~0.87 —— 信号 > 噪声 5 倍，姿势识别可行
- 数据里**没有时间戳**，由 JS 侧用 `performance.now()` 打
- **无陀螺仪、无欧拉角**，只有加速度三轴
