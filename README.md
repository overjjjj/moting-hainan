# 海南变频器租赁与监控平台

本仓库汇集小程序、监控中心、管理后台的可点击 Demo、业务模型、设计文档、早期原型和开发验证资料。当前主版本为 **Demo V1.2 / 设计说明书 V3.0**。

目前是浏览器本地演示，数据均为虚构样例；尚未接入真实微信、4G 设备、云服务器、支付或短信。`reference/` 是独立的第三方架构参考，不能视为已经接通的正式后端。

## 立即运行

安装 Node.js 18 或更高版本后，在仓库根目录运行：

```sh
node demo/server.cjs
```

访问 http://127.0.0.1:4173 。Windows 也可双击 `demo/Start-Demo.cmd`；不安装 Node 时可直接打开 `demo/dist/index.html` 体验核心页面。运行 Demo 无需安装 npm 依赖。

- [管理后台](http://127.0.0.1:4173/?view=admin)
- [监控中心](http://127.0.0.1:4173/?view=monitor)
- [手机端演示](http://127.0.0.1:4173/?view=mini)

## 工程导航

| 路径 | 内容与用途 |
| --- | --- |
| `demo/dist/` | 当前三端完整源码；本项目没有额外构建步骤，dist 内文件就是可维护源码 |
| `demo/tests/` | 当前业务、管理流程、三端联动、监控、地图测试 |
| `demo/qa/` | 地图重建脚本、省级原始 GeoJSON、开发检查工具 |
| `prototype/` | 早期流程原型、独立业务模型、短信接口草案和测试 |
| `prototype/previews/` | 已收录到仓库的小程序、管理后台、联动原型 HTML |
| `output/` | 方案 Word / PDF、设计图、早期页面预览和界面契约 |
| `design/` | 原始监控设计图、当前演示关键截图 |
| `reference/` | 原第三方 Go 物联网工程快照及其文档；用途和来源见该目录说明 |
| `tools/` | 测试环境解析、统一测试入口与交付校验工具 |
| 根目录 `*.py` / `capture_design_references.cjs` | 文档和设计资料生成、检查脚本 |

## 开发前先读

1. [开发接续说明](docs/DEVELOPMENT.md)：范围、模块、业务边界和下一阶段任务。
2. [完整设计说明书 V3.0](output/变频器租赁与电机监控平台完整设计说明书及方案策划_V3.0.docx)（[PDF](output/变频器租赁与电机监控平台完整设计说明书及方案策划_V3.0.pdf)）。
3. [Demo 使用与验收流程](demo/README.md)、[接口约定](demo/API.md)、[地图来源](demo/MAP-SOURCE.md)。
4. [资料优先级与整理范围](docs/INVENTORY.md)、[第三方资料说明](THIRD_PARTY_NOTICES.md)。

## 测试

纯模型测试不依赖浏览器：

```sh
npm run test:model
npm run test:prototype
```

完整测试需要开发依赖：

```sh
npm install
npx playwright install chromium
npm test
```

Windows 存在 Edge 时自动使用 Edge，可省略 Chromium 下载。可通过 `PLAYWRIGHT_MODULE` 指定 Playwright 模块，通过 `EDGE_PATH` 指定浏览器。运行环境支持当前用户目录内的 Codex 内置运行时作为本机后备；没有固定用户名路径。

整理副本已验证 **92 项检查通过**：24 项 Demo 模型、23 项早期原型模型、10 项管理员流程、12 项三端联动、10 项监控、13 项地图。

## 数据与发布

浏览器演示数据保存在当前网址的 localStorage，与正式本地用户数据库不同。不要提交真实客户资料、合同原件、收款流水、导出的用户备份、生产密钥或 `.env`。仓库的 `.gitignore` 已排除运行时、缓存、站点配置及常见敏感文件；真实数据应存放在仓库外。

本次仅整理 GitHub 开发仓库，不会自动部署网站。短信充值、按条扣费和发送仍仅预留接口。没有给自有工程设置新的开源许可；第三方组件的许可单独保留。
