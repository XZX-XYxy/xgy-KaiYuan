# ThingsBoard 接入说明

## 已实现

- `GET /api/integrations/thingsboard/status`：检查本地 ThingsBoard 是否可连接。
- `POST /api/integrations/thingsboard/alarm`：接收 ThingsBoard 规则链或 Webhook 推送的告警事件。
- 资产组校验：只允许已登记的 `asset_id`。
- 原始事件保留：即使缺少 `event_id`，事件仍进入待人工核实队列。
- 发生时间与接收时间分开保存。
- 外部事件进入 `PENDING_REVIEW`，不会自动关闭告警或修改工单。

## 本地 ThingsBoard

```powershell
docker compose up -d thingsboard
```

默认管理地址：`http://localhost:9090`

## 规则链建议

1. 设备通过 MQTT 发布 `temperature`、`vibration`、`current` 等遥测。
2. 规则链执行阈值和持续时间判断。
3. 创建告警后，通过 REST API 调用本项目的接入接口。
4. 本系统生成候选组并进入人工评审。
5. AI 只能读取候选组和授权上下文，不能回调 ThingsBoard 控制设备。

## 演示

后端启动后运行：

```powershell
.\.venv\Scripts\python.exe examples\thingsboard_webhook_demo.py
```

该脚本模拟一条 ThingsBoard 规则链告警推送。
