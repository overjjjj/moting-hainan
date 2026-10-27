# 第三方资料与资源说明

## Lucide 图标

`demo/dist/lucide.min.js` 为内置图标库，许可原文见 `demo/LUCIDE-LICENSE`。该许可只适用于对应第三方图标代码。

## 海南地图数据

`demo/dist/map-data.js`、`map-levels.js` 和 `demo/qa/hainan-source.json` 来源于阿里云 DataV 公开边界资源，转换规则、来源地址、日期和已获取响应校验值见 `demo/MAP-SOURCE.md`。保留来源并不等同于授予本工程其他内容的许可。

## Go 物联网参考工程

`reference/simplied-iot-monitoring-go-main/` 是原工作区已经保存的第三方源码快照，保留原目录和文档。当前副本没有上游 `.git` 元数据，也未发现可确认的作者/上游仓库地址，因此未推测或编造来源 URL。

原始下载 ZIP 保存的提交标识为 `8dfc51421617671b758f35f27bbec538c98722bc`，仅用于快照追溯，不能据此推定作者或来源地址。

该工程 README 声明 MIT，但保存的快照没有附带被链接的 LICENSE 文件。正式采用前应从项目原始提供者核对上游地址、版本及完整许可。不要将其当作本项目原创代码或已验收的正式后端。

`.env.example`、Kubernetes Secret 示例和部署 YAML 内有示例账号、占位密码及本地地址，属于参考配置；并未收录真实环境 `.env`、私钥或生产用户数据库。部署前需替换配置，不能直接把参考默认值作为生产凭据。

## 设计素材与历史原型

`design/` 和 `output/ui-regional/` 保留本项目讨论形成的设计图与截图。图中文字、设备数量、人员、读数是演示信息，具体功能应以当前业务规范为准。

本次整理未为自有代码新增开源许可证，也未执行对外网站发布。
