# 个人匿名提问箱

一个面向个人使用的极简匿名提问箱。访客无需注册即可提交问题；管理员通过受保护的后台处理问题，每条通过安全检查并落库的问题都会尝试发送 Telegram 即时通知。

界面采用低饱和暖灰色、细边框和紧凑排版，不依赖图片或外部字体；自动跟随系统浅色/深色模式。

## 功能

- 匿名提交 2–1000 个字符的中文、英文、日文和 Emoji 文本
- Cloudflare Turnstile 服务端 Siteverify 验证、蜜罐、内容评分与数据库限流
- 原始 IP 和 User-Agent 不落库，仅保存 `HMAC-SHA256` 指纹
- 每分钟 1 条、每小时 5 条、每天 15 条的来源限流
- 每次有效提交返回不可枚举的私密状态链接，无需账户即可稍后查看持久化回答
- 单管理员服务端 Session：HttpOnly、Secure（生产环境）、SameSite=Strict
- 后台搜索、状态筛选、分页、标记未读/已读/已回复/忽略/垃圾信息
- 回答独立持久化；已回答问题可生成 1:1、4:5、9:16 的高分辨率 PNG 分享卡片
- 分享卡片保存尺寸、主题、内容哈希与渲染器版本，不把 PNG 二进制写入 SQLite
- 单条删除、批量删除垃圾信息、封禁/解除来源
- Telegram 发送结果、`message_id` 和最近错误记录，支持后台手动重发
- SQLite WAL、Drizzle schema/migration、必要索引和启动自动迁移
- 健康检查、安全响应头、Docker 非 root 运行和持久化卷

## 技术栈

- Next.js 16.2（App Router）和 React 19
- TypeScript 严格模式
- SQLite、better-sqlite3、Drizzle ORM
- Tailwind CSS 4
- Zod 4、Vitest、Playwright、ESLint、Prettier
- Satori + Sharp 服务端 PNG 渲染，并显式加载项目内 Unicode 字体
- Cloudflare Turnstile、Telegram Bot API
- pnpm、Docker Compose

Next.js 16 要求 Node.js 20.9 或更高版本。推荐本地与 VPS 使用 Node.js 22 LTS。

## 目录结构

```text
.
├── .github/workflows/             # push / PR 质量门禁
├── drizzle/                       # 版本化 SQL migration 与元数据
├── public/
├── scripts/                       # 数据维护和 E2E 初始化命令
├── src/
│   ├── app/
│   │   ├── admin/                 # 管理后台及登录页
│   │   ├── status/                # 持有私密链接即可访问的提问状态页
│   │   └── api/                   # 提交、状态、认证、管理、健康检查 API
│   ├── components/                # 前台表单、Turnstile、后台交互组件
│   ├── db/                        # Drizzle schema、连接和 migration 执行器
│   ├── lib/                       # 认证、环境、哈希、限流、审核、Telegram
│   └── services/                  # 提交、回答、Session、卡片服务层
├── tests/
│   ├── unit/                      # 纯逻辑单元测试
│   ├── integration/               # SQLite、Session、服务集成测试
│   ├── api/                       # Route Handler 安全与行为测试
│   └── e2e/                       # Playwright 完整管理员工作流
├── Dockerfile
├── docker-compose.yml
├── drizzle.config.ts
└── .env.example
```

## 本地开发

```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

首次运行前必须编辑 `.env`。本地暂不配置 Turnstile 时，需要明确设置 `TURNSTILE_ENABLED=false`；不要在生产环境沿用此设置。默认示例数据库路径是 `/data/askbox.db`，普通本地开发可改成：

```dotenv
DATABASE_URL=file:./data/askbox.db
```

打开 `http://localhost:3000`，后台为 `http://localhost:3000/admin`。应用启动时也会幂等执行现有 migration，因此正常启动不会遗漏迁移。

## 私密提问状态

正常问题成功写入数据库后，提交接口会返回一次 `/status/<token>`，首页随即展示完整状态链接、复制按钮和查看入口。Token 由 `crypto.randomBytes(24)` 生成，具有 192 bit 随机性并使用固定长度 base64url 编码；它不包含问题 ID、IP 或其他业务数据。数据库只保存 Token 的 SHA-256 摘要，并通过唯一索引查询，不保存可直接访问页面的原始 Token。

状态页由持有链接者访问，不是公开回答列表。未回答时只显示收到状态和提交时间；管理员保存回答后，普通刷新即可读取 `answers` 表中的问题、回答和回复时间。如果管理员已生成分享卡片，状态页会复用同一套服务端 Renderer 预览并下载 PNG，不从图片反推回答，也不会创建另一份回答数据。

请把状态链接视为密码：链接不会进入 Telegram 管理通知，也无法通过问题 ID、来源指纹或后台外的搜索找回。蜜罐、封禁和静默丢弃请求收到的是无法命中数据库的普通外观链接，避免暴露过滤规则。升级前的旧问题保留原数据，但 `status_token_hash` 为 `NULL`，不会自动产生可访问链接。

`/status/*` 与 `/api/status/*` 始终返回 `Cache-Control: private, no-store`、`Referrer-Policy: no-referrer` 和 `X-Robots-Tag: noindex, nofollow, noarchive`；页面元数据也声明 `noindex` / `nofollow`。格式错误、过长、不存在以及已删除记录的 Token 对外统一显示“链接无效或已失效”。状态读取和 PNG 渲染分别使用轻量的来源限流；当前限流状态位于单个应用进程内，重启会重置，适合本项目默认的单容器部署。

## 分享卡片

1. 在管理后台点击问题操作区中的“回答与分享”。
2. 输入回答，选择 1:1、4:5 或 9:16。
3. 点击生成；回答先写入 SQLite，问题状态在同一事务中更新为“已回复”。
4. 服务端根据数据库中的 Question + Answer 排版，生成并下载 PNG。

卡片由独立 Renderer 在服务端直接排版和渲染，不依赖浏览器截图。三种尺寸分别为 1200×1200、1200×1500 和 1080×1920。每次导出会在 `cards` 表保存 Answer 关联、画面尺寸、主题、MIME、字节数、SHA-256 内容哈希、渲染器版本和分页元数据；PNG 本身不入库。生成接口仍要求有效的管理员 Session 和同源请求。

常用质量命令：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm test:e2e
pnpm build
pnpm format:check
```

## 环境变量

| 变量                             | 必需       | 说明                                                                          |
| -------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`                   | 是         | SQLite URL；Docker 固定为 `file:/data/askbox.db`                              |
| `ADMIN_PASSWORD`                 | 是         | 管理员密码；生产环境至少 12 字符，推荐密码管理器生成                          |
| `SESSION_SECRET`                 | 是         | Session HMAC 密钥，至少 32 字符                                               |
| `IP_HASH_SECRET`                 | 是         | 来源指纹 HMAC 密钥，至少 32 字符；更换后旧封禁与限流指纹失效                  |
| `TELEGRAM_BOT_TOKEN`             | 生产必需   | BotFather 返回的 Bot Token，仅服务端读取                                      |
| `TELEGRAM_CHAT_ID`               | 生产必需   | 接收通知的用户、群组或频道 ID                                                 |
| `ADMIN_PUBLIC_URL`               | 生产必需   | 外部可访问的后台 URL，例如 `https://ask.example.com/admin`                    |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 启用时必需 | Turnstile Site Key；会进入浏览器代码，不是秘密                                |
| `TURNSTILE_SECRET_KEY`           | 启用时必需 | Turnstile Secret Key，仅服务端读取                                            |
| `TURNSTILE_ENABLED`              | 是         | 默认 `true`；开发环境可明确设为 `false`                                       |
| `TRUST_CLOUDFLARE_PROXY`         | 否         | 只在源站仅接受 Cloudflare/可信代理请求时设为 `true`                           |
| `TRUST_PROXY`                    | 否         | 只在可信 Nginx/1Panel 会覆盖转发头时设为 `true`                               |
| `EXTERNAL_SERVICES_MODE`         | 是         | 正常保持 `live`；`mock` 仅用于本地自动化测试，生产启动会拒绝                  |
| `TZ`                             | 建议       | 使用 `Asia/Shanghai`；数据库保存 UTC 时间点，界面和 Telegram 按上海时区格式化 |

生成密钥示例：

```bash
openssl rand -base64 48
```

启动检查会拒绝短密钥、缺失的 Turnstile 配置和不完整的 Telegram 配置，不会静默关闭安全能力。

## 创建 Telegram Bot

1. 在 Telegram 中打开 `@BotFather`，发送 `/newbot`。
2. 按提示设置名称和以 `bot` 结尾的用户名。
3. 将返回的 Token 写入 `TELEGRAM_BOT_TOKEN`。不要把 Token 提交到 Git 或发到日志。
4. 先从目标账号主动给新 Bot 发一条消息。如果通知发到群组，先将 Bot 加入群并在群内发送消息。
5. 在浏览器或终端请求 `https://api.telegram.org/bot<你的Token>/getUpdates`，从返回 JSON 的 `message.chat.id` 读取 Chat ID。群组 ID 通常是负数。
6. 写入 `TELEGRAM_CHAT_ID`，并将 `ADMIN_PUBLIC_URL` 设置为 HTTPS 后台地址。

项目不使用 webhook，也不支持从 Telegram 直接回复。问题会先写入 SQLite，再调用 `sendMessage`；网络故障不会回滚问题，后台会显示错误并允许重试。

## Cloudflare Turnstile

1. 进入 Cloudflare 控制台的 Turnstile，创建 Widget。
2. 添加实际域名；本地调试可按 Cloudflare 文档使用测试密钥或暂时显式关闭。
3. 将 Site Key 写入 `NEXT_PUBLIC_TURNSTILE_SITE_KEY`，Secret Key 写入 `TURNSTILE_SECRET_KEY`。
4. 设置 `TURNSTILE_ENABLED=true`。
5. Docker 构建时 Site Key 会作为非秘密 build argument 写入前端包；更换 Site Key 后需要重新构建镜像。

浏览器 Token 只作为一次性凭证提交。后端会调用 Cloudflare Siteverify，超时、配置缺失或验证失败都会拒绝正常问题提交。

## Docker 部署（Ubuntu 24）

安装 Docker Engine 与 Compose 插件后：

```bash
cp .env.example .env
# 编辑 .env，填入所有生产配置
mkdir -p data
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 askbox
```

服务默认仅绑定 `127.0.0.1:3001`，应通过 Nginx、1Panel 或 Cloudflare 前置访问。可通过 `ASKBOX_HOST_PORT` 修改宿主机端口。容器以 UID 1001 非 root 用户运行，带最小 init 进程，根文件系统只读，`./data` 挂载到 `/data`。Next.js 缓存与 `/tmp` 使用受限 tmpfs；Compose 为停止过程保留 20 秒优雅退出时间。更新镜像不会删除数据库：

```bash
docker compose build --pull
docker compose up -d
```

健康检查为 `GET /api/health`，成功返回 `200` 和 SQLite 状态。容器启动时会在监听服务前自动执行尚未应用的 Drizzle migration；migration 文件同时打包在镜像内。

如果宿主机上手动创建的 `data` 权限导致 `SQLITE_READONLY`，执行：

```bash
sudo chown -R 1001:1001 data
```

### 定期数据维护

`pnpm maintenance` 是可重复执行、适合 cron 的短任务，默认：

- 删除已经过期的 `admin_sessions`；
- 删除 30 天前的 `admin_login_attempts`；
- 完成后执行被动 WAL checkpoint。

它不会在访客提交或管理员登录的请求链路中运行，也不会自动删除问题、回答、卡片元数据或封禁记录。先预览待清理数量：

```bash
pnpm maintenance -- --dry-run
docker compose run --rm --no-deps maintenance node scripts/maintenance.mjs --dry-run
```

Docker 正式执行：

```bash
docker compose run --rm --no-deps maintenance
```

Ubuntu cron 每天 03:15 执行示例（将目录替换为实际路径）：

```cron
15 3 * * * cd /opt/personal-anonymous-askbox && /usr/bin/docker compose run --rm --no-deps maintenance >> /var/log/askbox-maintenance.log 2>&1
```

可用 `--login-attempt-days=60` 修改登录记录保留天数，最小为 1 天。

## Nginx / 1Panel 反向代理

最小 Nginx 示例：

```nginx
server {
    listen 443 ssl http2;
    server_name ask.example.com;

    client_max_body_size 32k;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

仅在客户端无法绕过该代理直连 Node.js 时设置 `TRUST_PROXY=true`。1Panel 中同样需要保留 Host，并覆盖而不是透传客户端自带的真实 IP 头。建议只在防火墙开放 80/443，不对公网开放 3001。

使用 Cloudflare 橙云代理时，应用优先读取 `CF-Connecting-IP`，但只有在以下条件同时成立时才应设置 `TRUST_CLOUDFLARE_PROXY=true`：

- 源站 80/443 只允许 Cloudflare 官方 IP 段，或 Nginx 使用 Cloudflare `real_ip` 模块校验来源；
- 无法通过源站 IP 绕过 Cloudflare；
- 代理会删除/覆盖来自非 Cloudflare 请求的 `CF-Connecting-IP`。

否则攻击者可伪造头绕过按来源限流和封禁。若仅使用本机 Nginx 而不用 Cloudflare，应关闭该项并启用 `TRUST_PROXY`。两个选项均关闭时，生产环境会使用统一的 `unknown` 指纹；这是安全降级，但会让所有访客共享限流，因此生产环境必须正确配置可信代理链。

Cloudflare SSL/TLS 模式应使用 Full (strict)，源站也应配置有效证书。不要使用 Flexible。

## 数据库与 migration

Schema 位于 `src/db/schema.ts`，SQL migration 位于 `drizzle/`。修改 schema 后：

```bash
pnpm db:generate
pnpm db:migrate
pnpm test
```

审阅新生成的 SQL 后，将 schema 与 migration 一起提交。不要修改已经在生产应用过的 migration；应生成新的 migration。SQLite 开启 WAL、外键和 5 秒 busy timeout。

`0001_puzzling_dreaming_celestial.sql` 只新增 `answers` 与 `cards`，不会重写 `questions`。`0002_private_status_links.sql` 为问题增加可空的 Token 摘要字段和唯一索引，同样不会改写旧问题。对应的人工回滚 SQL 位于 `drizzle/rollback/0002_private_status_links.sql`；回滚前必须停止应用并完成数据库备份。旧问题会原样保留，直到管理员首次保存回答才创建 Answer。Question 删除时，关联 Answer 和 Card 元数据通过 SQLite 外键级联删除。

## CI 质量门禁

`.github/workflows/ci.yml` 在每次 push 和 Pull Request 上执行三个隔离 Job：

1. frozen lockfile 安装、Prettier 检查、ESLint、TypeScript、Unit、Integration、API、覆盖率门禁和 production build；
2. 单 worker Chromium E2E，覆盖匿名提交 → 私密状态链接 → SQLite → 管理员登录 → 查看 → 回答 → PNG → 状态页刷新与下载；
3. 使用独立 Compose 项目和命名卷构建生产镜像，验证自动 migration、只读根文件系统、健康检查、维护命令与重启恢复。

Vitest 覆盖率门禁针对安全和服务核心模块，阈值为语句/行 80%、函数 80%、分支 70%。E2E 将 Telegram 与 Turnstile 切换为显式 mock，生产环境若设置 `EXTERNAL_SERVICES_MODE=mock` 会在启动阶段直接失败。工作流只做质量验证，不会自动连接或部署到生产 VPS。

## 备份与恢复

最简单可靠的停机备份：

```bash
mkdir -p backups
docker compose stop askbox
cp data/askbox.db backups/askbox.db
docker compose start askbox
```

停机后 WAL 会正常关闭；若 `askbox.db-wal` 仍存在，应将 `askbox.db`、`askbox.db-wal`、`askbox.db-shm` 作为同一组一起备份，不要只复制主文件。建议将备份加密并同步到另一台机器，定期实际演练恢复。

恢复前先保留当前数据：

```bash
docker compose stop askbox
mv data/askbox.db data/askbox.db.before-restore
rm -f data/askbox.db-wal data/askbox.db-shm
cp backups/askbox.db data/askbox.db
sudo chown 1001:1001 data/askbox.db
docker compose start askbox
```

确认健康检查与后台数据正常后再清理旧副本。

## 修改管理员密码

1. 修改 `.env` 中的 `ADMIN_PASSWORD`。
2. 执行 `docker compose up -d --force-recreate`。

Session 哈希同时绑定管理员密码，修改密码后旧 Session 会自动失效。若怀疑 Session 密钥泄漏，同时轮换 `SESSION_SECRET`。不要通过前端、数据库或 Git 保存密码。

## 安全设计摘要

- 所有管理 API 都在服务端查验随机 Session Token 对应的数据库记录。
- 登录和所有写操作校验同源 `Origin`；Cookie 使用 Strict SameSite。
- 密码先转换为固定长度 SHA-256 摘要再进行时序安全比较。
- 登录失败按来源进行 SQLite 计数，15 分钟最多 5 次。
- 所有输入均通过 Zod 验证；数据库操作使用 Drizzle 参数化查询。
- 回答与问题状态在同一事务中持久化；分享卡片只读取已保存回答，导出结果禁止共享缓存。
- 私密状态链接使用 192 bit 随机 Token，数据库只存 SHA-256 摘要，状态页禁止索引、Referrer 和共享缓存。
- 生产环境禁止外部服务 mock；Turnstile 和 Telegram 的自动化测试不会访问真实服务。
- 问题正文只由 React 作为纯文本渲染，不使用 `dangerouslySetInnerHTML`。
- Content-Security-Policy 仅放行本站与 Turnstile 必需来源，同时设置防嵌套、MIME、防权限滥用响应头。
- 日志只记录简短错误，不记录原始 IP、管理员密码、Bot Token 或 Turnstile Secret。
- 蜜罐、封禁和明显自动广告返回普通成功结果，避免向机器人泄露判定规则。

## 常见问题

**启动时报“环境变量配置错误”**

检查密钥长度；启用 Turnstile 时两个 Key 都必须填写；生产环境的三个 Telegram 变量必须同时填写。

**所有访客都很快触发限流**

应用没有获得可信真实 IP，所有请求落到 `unknown`。检查代理链并按上一节只启用正确的信任选项。

**Telegram 显示未发送**

检查 Token、Chat ID、Bot 是否有目标会话权限及 VPS 能否访问 `api.telegram.org`。后台会显示截断后的最近错误，可直接点击“重发通知”。

**Turnstile 一直失败**

确认 Widget 域名、Site Key、Secret Key 匹配；检查浏览器是否拦截 `challenges.cloudflare.com`；更换 Site Key 后重建 Docker 镜像。

**数据库只读或容器反复重启**

检查 `data` 所有者是否为 UID 1001、磁盘是否已满，以及日志中是否有 migration 失败。不要同时让两个容器写同一个 SQLite 文件。

**改了管理员密码仍无法登录**

强制重建容器以加载新环境变量，确认密码没有多余引号或空格。连续失败 5 次后等待 15 分钟。

## 当前限制

- 单管理员、单实例部署；SQLite 不适合多个容器共享写入。
- 限流使用持久化问题记录；被静默丢弃的自动化请求不会写审计日志。
- 搜索使用 SQLite `LIKE`，适合个人规模，不提供全文分词。
- Telegram 仅通知和重试，不实现 webhook 或 Telegram 内回复。
- Share Card 当前提供单一纸张主题；主题结构已独立，后续可扩展而无需修改渲染接口。
- 长文本分页的数据字段和 Renderer 接口已经预留，但当前 UI 仍限制回答为 600 字且一次导出单页。
- `cards` 保存导出元数据而非 PNG；下载链接是当次响应生成的浏览器内存 URL，不提供历史图片文件仓库。
- 项目无法代替上游防火墙/WAF；Cloudflare 与真实 IP 的可信边界必须由部署者配置。

## License

项目源代码采用 [MIT License](LICENSE)，Copyright (c) 2026 Mio。

`public/fonts/share-card` 中的第三方字体仍分别遵循该目录内对应的许可证。MIT License 不授予对项目名称、域名或品牌标识的商标使用权。部署者仍需自行遵守所在地的隐私、内容与数据保留要求。
