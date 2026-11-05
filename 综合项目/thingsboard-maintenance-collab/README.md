# ThingsBoard 设备遥测与检修协同

面向工业设备运维场景的本地 MVP。系统以 ThingsBoard 作为遥测与告警事实来源，
在平台和检修工单之间增加协同层，形成：

```text
遥测采集 -> 规则告警 -> 事件归并 -> 人工复核 -> 检修工单
        -> 维修完成 -> 恢复确认 -> 审计反馈
```

AI 仅作为只读检修辅助层，用于重复候选提示、新事件提示、证据解释和资料检索。
AI 不关闭告警、不修改工单、不控制设备，也不替代上锁挂牌和人工审批。

## 当前状态

仓库包含可运行的后端、前端、测试、示例以及完整课程提交材料。
本地演示主链已经可运行，调研报告、设计方案、流程图、报价单和汇报页面均已归入 `docs/`。

界面截图位于 `docs/screens/`。

当前演示数据：

- 120 条遥测事件。
- 10 个告警候选组。
- 18 条重复候选。
- 6 张检修工单。
- 42 条公开知识记录。

## 项目结构

```text
thingsboard-maintenance-collab/
├── README.md
├── LICENSE
├── .gitignore
├── .env.example
├── requirements.txt
├── docker-compose.yml
├── src/
│   ├── thingsboard_maintenance/    # FastAPI 后端与 AI 协同逻辑
│   └── web/                        # React/Vite 前端
├── docs/
│   ├── README.md
│   ├── business-discovery.md
│   ├── industry-and-competitors.{md,docx,pdf}
│   ├── ai-design.{md,docx,pdf}
│   ├── design.md
│   ├── api.md
│   ├── thingsboard-integration.md
│   ├── flowcharts/                 # 无 AI / 有 AI 流程图
│   ├── quote/                      # 报价单
│   ├── knowledge-graph/            # 知识图谱说明与截图
│   ├── screens/                    # 产品界面截图
│   └── presentation/               # 汇报 HTML 与必要图片资源
├── tests/
└── examples/
```

## 主要功能

- ThingsBoard 本地运行、设备接入与 MQTT 遥测模拟。
- 遥测发生时间、平台接收时间、补传时间和时区偏移分离。
- 设备外号、铭牌号、规范资产号和资产组映射。
- 按设备和事件 ID 建立可回退告警候选组。
- 检修工单创建、分派、接单、维修记录和状态流转。
- 维修完成与恢复产出分别确认。
- LangGraph 编排的只读 AI 辅助流程。
- RAG 知识库与至少 40 条公开资料。
- 轻量知识图谱与带引用问答。
- 操作审计、测试和演示数据。

## 本地启动

### 1. 创建环境

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. 配置环境变量

```powershell
Copy-Item .env.example .env
```

在 `.env` 中填写百炼 API Key、模型名称和本地数据库地址。`.env` 不得提交到 Git。

### 3. 启动 ThingsBoard

```powershell
docker compose up -d thingsboard
```

ThingsBoard 管理界面默认地址：`http://localhost:9090`

即使 ThingsBoard 容器尚未启动，也可以使用内置演示数据和模拟告警接口运行完整界面。

### 4. 启动后端

```powershell
uvicorn thingsboard_maintenance.main:app --app-dir src --reload --port 8000
```

健康检查：`http://localhost:8000/api/health`

### 5. 启动前端

```powershell
Set-Location src\web
pnpm install
pnpm dev
```

前端默认地址：`http://localhost:5173`

## 测试

```powershell
pytest
```

## 示例

```powershell
python examples\demo.py
```

## 文档

- [文档总索引](docs/README.md)
- [业务需求发现报告](docs/business-discovery.md)
- [行业现状与竞品调研](docs/industry-and-competitors.md)
- [AI 增强版设计方案](docs/ai-design.md)
- [系统设计](docs/design.md)
- [API 约定](docs/api.md)
- [ThingsBoard 接入说明](docs/thingsboard-integration.md)
- 流程图：`docs/flowcharts/`
- 报价单：`docs/quote/报价单.md`
- 知识图谱：`docs/knowledge-graph/`
- 界面截图：`docs/screens/`
- 汇报页面：`docs/presentation/index.html`

## 测试状态

```text
11 passed
```

前端已通过 TypeScript 检查和 Vite 生产构建。

## 安全边界

- AI 服务没有 ThingsBoard 和工单系统的业务写权限。
- AI 不得生成或执行设备控制动作。
- 缺少事件 ID 的记录保留为候选，不自动删除。
- 归并结果必须能够回退到原始事件。
- 资产组之外的遥测必须拒绝访问。

## 许可证

本项目使用 MIT License，详见 [LICENSE](LICENSE)。
