# 设计资料与文档重建

本目录的 `monitor-original.png` 和 `monitor-initial.png` 保存早期海南监控大屏构图参考。区域与设备详情四张设计图在 `../output/ui-regional/`；后台、小程序和架构插图在 `../output/design-spec-assets/`。图中的示例数值、温度、转速等未确认测点不代表实际设备具备这些能力。

当前需求基线为 `../output/变频器租赁与电机监控平台完整设计说明书及方案策划_V3.0.docx`，同目录 PDF 可直接阅读。当前可运行界面以 `../demo/` 为准，包含文档出稿后完成的地图下钻等增量，详见 `../demo/README.md`。

## 可选文档工具

在仓库根目录运行：

```console
python -m pip install -r requirements.txt
python build_design_spec.py
```

`build_design_spec.py` 会重新生成 V3.0 DOCX、架构图和章节索引；确认需要重建后再执行，因为会覆盖相应文件。`build_complete_plan.py` 生成 V2.0，`build_plan_doc.py` 生成一期方案，二者保留供追溯，默认不运行。

所有图片引用已改成仓库相对路径，不依赖原机器的工作目录。架构图需要中文字体：Windows 自动查找微软雅黑，Linux 查找 Noto Sans CJK，macOS 查找苹方；也可通过环境变量 `DESIGN_CJK_FONT` 指定 TTF、TTC 或 OTF 字体路径。DOCX 的中文排版使用微软雅黑，若转换机器未安装该字体，需要安装适当字体或检查替代字体后的分页。字体文件不随仓库分发。

使用 Word 或 LibreOffice 将 DOCX 导出 PDF 后，可运行以下只读检查，参数省略时读取仓库已收录的 V3.0 PDF：

```console
python inspect_design_spec_final.py
python inspect_design_spec.py path/to/document.pdf
```

PDF 检查输出每页文字与边界摘要，不能替代人工查看分页、表格和插图。仓库不包含 LibreOffice 安装包与逐页渲染缓存。

`refine_design_spec.py` 与 `polish_design_spec.py` 是已执行过的历史源代码迁移脚本，仅保留来源，不属于重建流程，勿再次批量执行。
