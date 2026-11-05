from __future__ import annotations

import json
import math
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path


KNOWLEDGE_PATH = Path(__file__).resolve().parent.parent / "knowledge" / "public_knowledge.json"


@lru_cache(maxsize=1)
def load_knowledge() -> list[dict]:
    return json.loads(KNOWLEDGE_PATH.read_text(encoding="utf-8"))


def tokenize(text: str) -> list[str]:
    normalized = text.lower().replace("_", " ")
    latin = re.findall(r"[a-z0-9-]{2,}", normalized)
    chinese_spans = re.findall(r"[\u4e00-\u9fff]+", normalized)
    chinese: list[str] = []
    for span in chinese_spans:
        chinese.extend(span[index : index + 2] for index in range(max(1, len(span) - 1)))
    return latin + chinese


def search_knowledge(query: str, limit: int = 8) -> list[dict]:
    query_terms = Counter(tokenize(query))
    if not query_terms:
        return load_knowledge()[:limit]
    scored: list[tuple[float, dict]] = []
    for item in load_knowledge():
        searchable = " ".join(
            [
                str(item.get("title", "")),
                str(item.get("category", "")),
                str(item.get("content", "")),
                " ".join(item.get("tags", [])),
            ]
        )
        document_terms = Counter(tokenize(searchable))
        score = 0.0
        for term, weight in query_terms.items():
            if term in document_terms:
                score += (1 + math.log(1 + document_terms[term])) * weight
                if term in str(item.get("title", "")).lower():
                    score += 3.0
                if term in " ".join(item.get("tags", [])).lower():
                    score += 2.0
        if score > 0:
            scored.append((score, item))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [{**item, "score": round(score, 3)} for score, item in scored[:limit]]


def build_knowledge_graph() -> dict:
    docs = load_knowledge()
    categories = sorted({item["category"] for item in docs})
    nodes: list[dict] = [
        {
            "id": f"CAT-{index + 1}",
            "label": category,
            "type": "category",
            "group": category,
        }
        for index, category in enumerate(categories)
    ]
    edges: list[dict] = []
    category_ids = {node["group"]: node["id"] for node in nodes}
    domain_nodes = [
        {"id": "KG-CORE", "label": "维护知识中枢", "type": "core", "group": "core"},
        {"id": "DOMAIN-ASSET", "label": "设备资产", "type": "domain", "group": "业务域"},
        {"id": "DOMAIN-ALARM", "label": "告警事件", "type": "domain", "group": "业务域"},
        {"id": "DOMAIN-WORK", "label": "检修工单", "type": "domain", "group": "业务域"},
        {"id": "DOMAIN-AI", "label": "AI 证据", "type": "domain", "group": "业务域"},
    ]
    nodes.extend(domain_nodes)
    for domain_id in ("DOMAIN-ASSET", "DOMAIN-ALARM", "DOMAIN-WORK", "DOMAIN-AI"):
        edges.append({"source": domain_id, "target": "KG-CORE", "relation": "汇聚"})
    category_domain = {
        "ThingsBoard": "DOMAIN-ASSET",
        "检修": "DOMAIN-WORK",
        "告警治理": "DOMAIN-ALARM",
        "智能体": "DOMAIN-AI",
        "知识库": "DOMAIN-AI",
        "AI安全": "DOMAIN-AI",
    }
    for category, node_id in category_ids.items():
        target = category_domain.get(category)
        if target:
            edges.append({"source": node_id, "target": target, "relation": "支撑"})

    # Keep the graph readable: show the most representative documents only.
    representative_ids = {
        "K-001", "K-002", "K-004", "K-005", "K-008", "K-009", "K-010",
        "K-011", "K-016", "K-018", "K-019", "K-020", "K-021", "K-022",
        "K-025", "K-029", "K-030", "K-031", "K-032", "K-033", "K-035",
        "K-036", "K-037", "K-039", "K-040", "K-042",
    }
    for item in docs:
        if item["id"] not in representative_ids:
            continue
        nodes.append(
            {
                "id": item["id"],
                "label": item["title"],
                "type": "document",
                "group": item["category"],
                "url": item["url"],
            }
        )
        edges.append(
            {
                "source": item["id"],
                "target": category_ids[item["category"]],
                "relation": "属于",
            }
        )
    return {"nodes": nodes, "edges": edges, "knowledgeCount": len(docs)}
