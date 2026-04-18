# Posture Pet · 项目规划

> **一句话**：把 EvenPet 从"装饰宠物"改造成一个**只做一件事且做到极致**的产品——**体态守护宠物**：你的颈椎姿势决定宠物的情绪和健康。

---

## 为什么只做这一件事

- 眼镜天然戴在头上，是**全世界最合适**测颈椎姿势的传感器位置。
- 用到的 SDK 能力（IMU、佩戴检测）**目前没有别的 G2 应用在用**。
- 复用已有的画布宠物渲染器（4 只宠物 = 4 种性格/视觉）。
- 解决真实健康问题（手机脖 / tech-neck）+ 带情感钩子（你低头 → 宠物生病）。

---

## 非目标（保持专注）

- ❌ 语音助手 / AI 聊天
- ❌ 翻译、待办、笔记、天气
- ❌ 多用户 / 社交 / 云同步
- ❌ 核心循环没跑通之前**不加**新宠物

---

## 阶段规划

### Phase 0 — IMU 探针（当前阶段）

在投入产品逻辑之前，先搞清楚三个未知数：

1. `IMU_Report_Data.x/y/z` 的**物理含义**到底是加速度计 / 陀螺仪 / 欧拉角？
2. `ImuReportPace.P100..P1000` 对应的**真实采样率**是多少？
3. **延迟**和**静止噪声**是多少？姿势识别在工程上可行吗？

**交付物**：`/imu-debug.html` 独立调试页，显示 x/y/z 实时值、采样率、噪声、幅值、滚动曲线，并带一套姿势测试协议（中性 / 低头 30° / 低头 60° / 点头 / 摇头 / 走路）。

**退出标准**：
- 知道哪个轴响应抬低头，变化幅度多大
- 知道可达采样率（事件/秒）
- 知道静止噪声底噪 σ

**当前状态**：调试页已搭好（含自动上传 CSV 到 dev 机器）；真机联调卡在 Even App SDK 返回 `invalid`，排查中。

---

### Phase 1 — 姿势估计核心

基于 Phase 0 的结论，写一个小的姿态模块：

- **自适应基线**：佩戴前 ~10 秒记录为"中性"
- **仰俯角估计**：若是加速度计就用三角函数直接算，若是陀螺仪就用互补滤波
- **低通滤波**：抑制走路 / 点头抖动

---

### Phase 2 — 宠物状态机

把姿态映射到情绪：

| 状态 | 条件 |
|---|---|
| `healthy` | 中性 ±15° |
| `alert` | 15°–30° |
| `unwell` | >30° |
| `sick` | `unwell` 持续 > 2 分钟 |
| `asleep` | `isWearing === false` |

接进已有的 `PetRenderer`，作为动画/情绪 modifier。

---

### Phase 3 — 数据落盘 + 日报

- 每分钟一条样本写 `localStorage`：`{ ts, pitch, state, wearing }`
- 浏览器设置页显示：今日低头分钟数、最长连续好姿势、近 7 天柱状图

---

### Phase 4 — 打磨到"业界最好"

- **活动分类**：从 IMU 模式识别坐/走/吃
- **宠物脊柱实时镜像用户姿势**（招牌效果）
- 多日连续达标的**成长/解锁**系统
- 配套 web 端（用 `even-toolkit/web` 组件）

---

## 真机调试

操作流程、踩过的坑、完整 runbook 见 **[`DEVICE_DEBUGGING.md`](./DEVICE_DEBUGGING.md)**。

一句话版：`npm run dev` → `cloudflared tunnel --url http://localhost:5173` → 用隧道 URL `evenhub qr` 生成二维码 → Even App 开发者模式扫一扫。

---

## 剩余工作（按优先级）

### ✅ Phase 0 — IMU 探针（完成）

- [x] 调试页
- [x] Vite 多入口
- [x] 真机跑通（eventually via cloudflared）
- [x] x/y/z 语义：**加速度，单位 g**
- [x] P100 实际采样率：**≈ 10 Hz**

### ✅ Phase 1 — 姿势估计核心（完成）

- [x] `src/posture/estimator.ts` — 自适应基线 + EMA 平滑 + 偏角
- [x] `src/posture/state.ts` — 五态机器 + 2 分钟迟滞
- [x] 13 个单元测试
- [ ] **`p1-wire`**：接进主入口，订阅 IMU → 喂给 estimator → 输出 state

### Phase 2 — 宠物情绪（待开始）

- [ ] **`p2-pet-mood`**：`PetRenderer` 按 `PostureState` 切不同姿势/表情
  - healthy → 普通
  - alert → 微皱眉 / 警觉
  - unwell → 趴着 / 难受
  - sick → 躺平 / 闭眼
  - asleep → Zzz
- [ ] 用姿势协议 CSV 标定真实阈值（现用 15°/30° 是经验值）

### Phase 3 — 数据 & 日报

- [ ] 每分钟写一条 `{ ts, pitch, state, wearing }` 到 `localStorage`
- [ ] 浏览器设置页：今日低头分钟、最长连续好姿势、7 日柱状图

### Phase 4 — 打磨

- [ ] 活动分类（坐 / 走 / 吃）从 IMU 模式识别
- [ ] 宠物脊柱实时镜像用户倾角（招牌效果）
- [ ] 多日连胜 → 成长 / 解锁系统
- [ ] 配套 web 管理页（用 `even-toolkit/web` 组件）

---

## 技术要点

- **SDK**：`@evenrealities/even_hub_sdk`
- **关键 API**：
  - `imuControl(isOpen, pace)` → 触发 `sysEvent.imuData` 流
  - `onEvenHubEvent` → 接收 IMU 数据（x/y/z 三个 float）
  - `onDeviceStatusChanged` → 佩戴状态
  - `getDeviceInfo` → 主动查询设备状态
  - `createStartUpPageContainer` → 创建 HUD 容器（前置条件）
- **屏幕规格**：576×288 单色
- **输入**：点按 / 双击

---

## 状态追踪

进度由 SQL `todos` 表维护（session 级），Markdown 不重复列 TODO，避免信息分裂。
