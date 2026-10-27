# 地图资源

监控总览的地图路径由阿里云 DataV 的公开海南省区域数据转换而来，转换日期 2026-10-24。
来源：https://geo.datav.aliyun.com/areas_v3/bound/460000_full.json

`dist/map-data.js` 内置海南岛区域路径和南海诸岛附图路径。运行时无需联网加载地图。
地图中的亮点表示演示设备的市县聚合位置，不代表具体设备坐标；未入库区域不虚构运行数量。正式部署前应核对地图版本及展示要求。


## 本地地图下钻资源（2026-10-25）

新增的 `dist/map-levels.js` 提供 `globalThis.MapLevels`，供省 → 市县 → 已公开区级边界的地图下钻使用。它仅保存公开地图几何与层级关系，不含客户信息、设备坐标或设备区县归属。浏览器运行时不访问外部地图服务。

本次公开数据读取结果：

| 上级节点 | 公开子级来源 | 结果 |
| --- | --- | --- |
| 海口市 460100 | [DataV 海口子级](https://geo.datav.aliyun.com/areas_v3/bound/460100_full.json) | HTTP 200，秀英区 460105、龙华区 460106、琼山区 460107、美兰区 460108 |
| 三亚市 460200 | [DataV 三亚子级](https://geo.datav.aliyun.com/areas_v3/bound/460200_full.json) | HTTP 200，海棠区 460202、吉阳区 460203、天涯区 460204、崖州区 460205 |
| 儋州市 460400 | [DataV 儋州子级](https://geo.datav.aliyun.com/areas_v3/bound/460400_full.json) | HTTP 404；现有省源的 childrenNum 为 0，保留空 children |
| 琼海市 469002 | [DataV 琼海子级](https://geo.datav.aliyun.com/areas_v3/bound/469002_full.json) | HTTP 404；现有省源的 childrenNum 为 0，保留空 children |

空 children 的含义是“当前本地公开数据源未提供下级边界”，不应解释为没有实际行政下级。其余市县没有添加下级边界，未绘制或推断乡镇。三沙市继续使用现有南海诸岛附图，其投影独立，本次不加入可下钻节点。

数据结构包含 27 个节点：1 个海南省返回节点、现有省主图中的 18 个市县节点、海口与三亚的 8 个区级节点。所有对象键、code、非空 parent 和 children 元素均为字符串行政代码；level 分别为 province、city、district。每个节点包括 name、path、bounds=[x,y,width,height]、center=[x,y]、children 与来源字段。省节点 460000 使用 bounds=[0,0,900,540]、center=[450,270]、空 path；省级绘制继续复用原 map-data.js。

所有新增边界使用与原省主图一致的 900×540 展示坐标：

- s = 450 / (20.163530 − 18.143554)
- x = 450 + (经度 − 109.8312045) × s × 0.945
- y = 33 + (20.163530 − 纬度) × s
- 坐标保留两位小数；原有 18 个市县的 643 个点及其中心逐一校验，与 map-data.js 完全一致。
- 子级使用公开 GeoJSON 的 Polygon/MultiPolygon 几何。城市 bounds 包含子级更精细的海岸线范围，渲染可在此基础上额外留边距。多环路径建议使用 SVG fill-rule="evenodd"。
- 市县中心沿用原图；区级标签中心优先使用公开数据的 centroid，缺失时使用 center。中心仅用于地图标注，不代表设备位置。

已获取子级响应的 SHA-256：

- 海口：b6acd61c6633882dc0dcb31786e3ea96e59d5e9f94cd8da81f8ae7b5da3317e6
- 三亚：43582b50fa3943c9e3c1a9fc5ee99020db96c70c117d1741e6ec69c72b6e566d

重建脚本为 `qa/build-map-levels.py`。脚本读取本地省源与原省图，再从上述四个公开地址读取子级，只写入 map-levels.js，不上传数据、不修改业务模型。几何来源与本次获取日期也记录在 MapLevels.source 中。公开源的获取日期不代表行政边界更新日期；正式项目仍需核对合适的地图版本与展示要求。

