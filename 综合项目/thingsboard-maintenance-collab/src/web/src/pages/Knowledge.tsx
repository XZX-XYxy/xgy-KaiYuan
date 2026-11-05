import {
  ArrowUpRight,
  BookOpen,
  Bot,
  ExternalLink,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { KnowledgeGraph3D } from "../components/KnowledgeGraph3D";
import { EmptyState, LoadingBlock } from "../components/Ui";
import type { AiResult, KnowledgeDoc, KnowledgeGraph } from "../types";

const suggestedQuestions = [
  "重复告警与振动新事件应该如何区分？",
  "缺少事件 ID 的告警应该如何处理？",
  "传感器漂移能否直接判定设备故障？",
  "维修完成为什么不能立即关闭告警？",
  "AI 检修建议需要哪些证据？",
  "恢复产出应该由谁确认？",
];

export function Knowledge() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [query, setQuery] = useState("告警 时间 去重 工单");
  const [selectedNode, setSelectedNode] = useState<string>("KG-CORE");
  const [question, setQuestion] = useState("重复告警与振动新事件应该如何区分？");
  const [answer, setAnswer] = useState<AiResult | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  const load = async (search = query) => {
    const [docResponse, graphResponse] = await Promise.all([
      api.knowledgeSearch(search),
      graph ? Promise.resolve(graph) : api.knowledgeGraph(),
    ]);
    setDocs(docResponse.items);
    if (!graph) setGraph(graphResponse);
  };

  useEffect(() => {
    load().catch((reason: Error) => setError(reason.message));
  }, []);

  const currentNode = graph?.nodes.find((node) => node.id === selectedNode);

  const ask = async () => {
    setAsking(true);
    setError("");
    try {
      setAnswer(await api.askKnowledge(question));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "知识问答失败");
    } finally {
      setAsking(false);
    }
  };

  if (!graph) return <LoadingBlock label="正在构建知识图谱" />;

  return (
    <div className="page knowledge-page">
      <div className="page-heading compact-heading">
        <div>
          <span className="page-eyebrow">RAG KNOWLEDGE SYSTEM</span>
          <h1>设备维护知识图谱</h1>
          <p>42 条公开资料通过实体关系组织，并由只读模型带引用回答。</p>
        </div>
        <div className="knowledge-stats">
          <div><strong>{graph.knowledgeCount}</strong><span>知识条目</span></div>
          <div><strong>{graph.nodes.length}</strong><span>图谱节点</span></div>
          <div><strong>{graph.edges.length}</strong><span>关系边</span></div>
        </div>
      </div>
      {error && <div className="inline-error">{error}</div>}

      <div className="knowledge-workspace">
        <aside className="knowledge-index">
          <form
            className="knowledge-search"
            onSubmit={(event) => {
              event.preventDefault();
              load(query);
            }}
          >
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索规范、告警或工单" />
          </form>
          <div className="knowledge-list-head"><span>公开知识条目</span><strong>{docs.length}</strong></div>
          <div className="knowledge-list">
            {docs.map((doc) => (
              <button key={doc.id} onClick={() => setSelectedNode(doc.id)}>
                <span>{doc.id} · {doc.category}</span>
                <strong>{doc.title}</strong>
                <small>{doc.source}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="graph-stage graph-stage-3d">
          <div className="graph-toolbar">
            <div className="graph-toolbar-title">
              <span className="graph-live-dot" />
              <Network size={16} />
              <span>KNOWLEDGE GRAPH / 3D</span>
            </div>
            <div className="graph-toolbar-status">
              <span>{graph.nodes.length} NODES</span>
              <span>{graph.edges.length} LINK</span>
            </div>
          </div>
          <KnowledgeGraph3D
            nodes={graph.nodes}
            edges={graph.edges}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
          />
          <div className="graph-hud">
            <span>NODES {graph.nodes.length}</span>
            <span>EDGES {graph.edges.length}</span>
            <span>SYNC 100%</span>
          </div>
          <div className="graph-caption">
            <span><i className="legend-core" />知识中枢</span>
            <span><i className="legend-domain" />业务实体</span>
            <span><i className="legend-category" />知识类别</span>
            <span><i className="legend-document" />公开资料</span>
            <strong>{currentNode?.label || "选择节点查看关系"}</strong>
          </div>
        </section>

        <aside className="knowledge-ask">
          <div className="ask-head">
            <div className="ai-orb small"><Bot size={18} /></div>
            <div><strong>带依据提问</strong><span>RAG + QWEN</span></div>
            <ShieldCheck size={17} />
          </div>
          <div className="selected-knowledge">
            <BookOpen size={16} />
            <div>
              <span>当前节点</span>
              <strong>{currentNode?.label || "知识图谱"}</strong>
            </div>
          </div>
          <div className="question-options">
            <div className="question-options-head">
              <span>可以这样问</span>
              <small>{suggestedQuestions.length} 个问题</small>
            </div>
            <div className="question-option-list">
              {suggestedQuestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`question-option ${question === item ? "selected" : ""}`}
                  onClick={() => setQuestion(item)}
                >
                  <span>{item}</span>
                  <ArrowUpRight size={12} />
                </button>
              ))}
            </div>
          </div>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={4} />
          <button className="primary-button ask-button" onClick={ask} disabled={asking}>
            {asking ? <span className="spinner" /> : <Sparkles size={15} />}
            {asking ? "检索并生成回答" : "基于知识库提问"}
          </button>

          {!answer ? (
            <EmptyState title="回答会附带引用" text="模型只读取当前知识库条目，不执行设备或工单动作。" />
          ) : (
            <div className="answer-block">
              <p>{answer.summary}</p>
              <div className="answer-confidence">置信度 {Math.round((answer.confidence || 0) * 100)}% · {answer.model}</div>
              <div className="answer-evidence">
                {answer.evidence?.slice(0, 4).map((item) => (
                  <a key={item.id} href={item.url} target="_blank" rel="noreferrer">
                    <span>{item.id}</span><strong>{item.title}</strong><ExternalLink size={13} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
