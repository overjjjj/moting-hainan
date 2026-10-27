# 区域设备界面接口草案

这份草案只对应区域设备 UI，不代表厂商接口已经确定。字段名称、单位、分页能力和故障码含义要在厂商接口验证后落地。

## 页面进入

`GET /api/regions/tree`

返回省、市县、乡镇、村庄的展示树。每个节点提供 `id`、`name`、`level`、`deviceCount`、`faultCount`、`children`。云端缺失的区域进入明确的“未分类”，不能按地址猜测。

`GET /api/regions/{regionId}/summary`

返回当前区域统计：`total`、`running`、`stopped`、`fault`、`offline`、`dataFreshness`、`updatedAt`。统计口径固定为区域条件，不受关键词搜索影响。

## 设备列表

`GET /api/devices?regionId=...&status=all&query=...&page=1&pageSize=6&sort=id`

卡片只需要：

- `id`：本地稳定 ID，以及可选的 `vendorDeviceId`
- `name`
- `status`：运行、停止、故障；通信状态单独返回
- `owner`
- `location`
- `town`、`village`
- `dataFreshness`、`updatedAt`

响应包含 `items`、`page`、`pageSize`、`total`、`hasNext`。筛选结果为 0 时仍返回当前区域统计，不能把区域总数改成 0。

页面行为：切换区域、状态或关键词时回到第 1 页；保持设备编号顺序；报警不会改变列表排序。服务器连接状态、采集批次不完整和数据过期要单独表达，不能合并成“离线电机”。

## 设备详情

`GET /api/devices/{deviceId}`

返回设备资料、当前状态、通信状态、数据新鲜度、测点与单位、测量时间、接收时间、厂商故障码和当前活动报警。缺失参数为空或 `null`，前端显示“未提供”或破折号，不显示 0 代替未知值。

`GET /api/devices/{deviceId}/telemetry?metric=temperature&from=...&to=...&interval=...`

返回按测点和时间范围查询的历史数据。每个点包含 `measuredAt`、`receivedAt`、`value`、`unit`、`quality`。断线期间不补画为 0；无法补采的区间要明确标记为空档。

## 报警提示

`GET /api/alarms?status=active,unacknowledged&limit=4`

报警记录必须区分设备故障、通信状态和确认状态。至少包括 `alarmId`、`deviceId`、`faultCode`、`title`、`firstSeenAt`、`lastSeenAt`、`acknowledgedAt`、`recoveredAt`、`severity`。持续故障只保留一个活动实例；确认不代表恢复。

区域设备页只显示全域未确认数量和一条轻量提示。没有报警时不保留空的报警窗口；新报警通过提示条或导航数量出现，点击后进入报警记录页。

## 需要厂商确认的接口问题

1. 是否有稳定设备 ID、故障事件 ID、测量时间和恢复事件。
2. 电流、电压是否三相，温度对应哪个测点，单位是否固定。
3. 能否按设备批量获取，支持分页、推送、补采和历史时间范围是多少。
4. 所属人、乡镇、村庄、位置字段是否稳定，缺失时如何表示。
5. “停止”“故障”“离线”在厂商系统中的定义是否独立。
6. 令牌有效期、限流、错误码、调用费用和本地保存授权。

## 实施顺序

先用固定 JSON 完成页面状态和交互测试，再接区域树与设备列表；然后接设备详情和历史数据；最后接报警事件、确认和恢复。每一步都保留演示数据开关，直到厂商字段映射验收通过。
