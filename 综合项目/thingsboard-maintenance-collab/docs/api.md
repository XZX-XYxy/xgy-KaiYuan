# API 约定

## 已规划接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/health` | 服务健康检查 |
| GET | `/api/dashboard/summary` | 首页指标 |
| GET | `/api/assets` | 资产列表 |
| GET | `/api/alarms` | 告警列表 |
| GET | `/api/alarm-groups` | 告警候选组 |
| POST | `/api/alarm-groups/{id}/review` | 人工评审与回退 |
| GET | `/api/work-orders` | 工单列表 |
| POST | `/api/work-orders` | 创建工单 |
| POST | `/api/work-orders/{id}/transition` | 工单状态流转 |
| POST | `/api/ai/analyze` | 只读 AI 证据分析 |
| GET | `/api/knowledge/search` | RAG 知识检索 |
| GET | `/api/knowledge/graph` | 知识图谱数据 |
| GET | `/api/integrations/thingsboard/status` | ThingsBoard 连接状态 |
| POST | `/api/integrations/thingsboard/alarm` | 接收 ThingsBoard 告警事件 |

所有写操作都必须记录操作者、时间、原因和关联事件。
