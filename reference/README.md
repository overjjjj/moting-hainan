# 参考工程

`simplied-iot-monitoring-go-main/` 是此前工作区已有的 Go 物联网源码快照，供后续研究设备接入、消息队列、WebSocket、部署与运维。它不属于当前三端 Demo 的运行依赖，尚未接通租赁、授权、本地用户主数据或真实 4G 设备。

原项目 README 声明 MIT，快照中未附带 LICENSE，且没有上游 Git 元数据。请保留这项来源待核对记录；不要为它补造作者或许可证。见根目录 [第三方说明](../THIRD_PARTY_NOTICES.md)。

`preview.mjs` 只在本机预览该参考项目的静态页面：

```sh
node reference/preview.mjs
```

默认 http://127.0.0.1:4186 。正式后端的选型、依赖锁定、协议与安全联调尚未完成。
