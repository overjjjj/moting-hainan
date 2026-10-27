# 早期交互原型

本目录保留完整 Demo 形成前的业务模型、流程控制器和界面片段，供追溯需求与测试口径使用。后续产品开发以 `../demo/` 为当前实现，避免分别维护两套业务规则。

## 内容

- `workflow-model.js` 与 `user-backup-model.js`：早期租约、权限、统计、备份逻辑。
- `workflow-controller.js`、`*-controller.inc.js`、CSS 与 `workflow-shell.html`：原型组成部分。
- `previews/inverter-mini-preview.html`、`previews/inverter-admin-preview.html`：小程序与后台原始界面片段。
- `previews/inverter-rental-workflow.html`：已组装的流程原型片段。
- `sms-interface-contract.json`：短信接口预留约定。
- `*.test.cjs`：模型回归脚本；`check-*.cjs`：早期浏览器检查脚本。

## 重新组装流程原型

在仓库根目录运行：

```console
python prototype/build_workflow_preview.py
```

只使用 Python 标准库，输入与输出都位于当前仓库，输出覆盖 `prototype/previews/inverter-rental-workflow.html`。这些 HTML 是原先可视化容器使用的片段；直接查看现成页面可使用 `../output/workflow-preview-qa.html`，完整演示请启动 `../demo/server.cjs`。

`update_income_forms.py` 是已经应用过的一次性迁移脚本，保留用于理解历史修改，不能作为日常构建步骤重复执行。原型内用户、设备、租约与付款资料为演示数据。
