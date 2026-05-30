"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { masteryBucket, type MasteryBucket } from "@/lib/mastery";
import type { GraphNode, GraphEdge } from "@/lib/db/queries/edges";

// A3 (visual) — hand-rolled SVG node-link graph (no viz dependency, SSR-safe).
// Deterministic layout: nodes are grouped into columns by subject and stacked,
// so the same data always renders the same — no physics, no client-only layout.

const MASTERY_FILL: Record<MasteryBucket, string> = {
  0: "var(--mastery-0)",
  1: "var(--mastery-1)",
  2: "var(--mastery-2)",
  3: "var(--mastery-3)",
  4: "var(--mastery-4)",
};

const EDGE_STYLE: Record<GraphEdge["relation_type"], { stroke: string; dash?: string }> = {
  prerequisite: { stroke: "var(--accent)" },
  contrasts_with: { stroke: "var(--warning)", dash: "5 4" },
  related: { stroke: "var(--border-strong)" },
};

const COL_W = 230;
const ROW_H = 64;
const NODE_W = 168;
const NODE_H = 38;
const TOP = 40;
const SUBJECT_ORDER = ["math", "reasoning", "ga"];

export function GraphCanvas({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const { positions, width, height, columns } = useMemo(() => {
    const subjects = [...new Set(nodes.map((n) => n.subject))].sort(
      (a, b) => SUBJECT_ORDER.indexOf(a) - SUBJECT_ORDER.indexOf(b)
    );
    const positions = new Map<number, { x: number; y: number }>();
    let maxRows = 0;
    subjects.forEach((subject, col) => {
      const group = nodes.filter((n) => n.subject === subject);
      group.forEach((n, row) => {
        positions.set(n.id, { x: 30 + col * COL_W, y: TOP + row * ROW_H });
      });
      maxRows = Math.max(maxRows, group.length);
    });
    return {
      positions,
      width: 30 + subjects.length * COL_W,
      height: TOP + Math.max(1, maxRows) * ROW_H,
      columns: subjects,
    };
  }, [nodes]);

  // Which node ids are connected to the hovered node (to emphasise its edges).
  const adjacent = useMemo(() => {
    if (hover == null) return new Set<number>();
    const set = new Set<number>();
    for (const e of edges) {
      if (e.source_id === hover) set.add(e.target_id);
      if (e.target_id === hover) set.add(e.source_id);
    }
    return set;
  }, [hover, edges]);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ minWidth: width }}
        className="w-full"
        role="img"
        aria-label="Concept knowledge graph"
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
          </marker>
        </defs>

        {columns.map((subject, i) => (
          <text key={subject} x={30 + i * COL_W} y={20} fontSize={11} className="fill-muted uppercase">
            {subject}
          </text>
        ))}

        {edges.map((e, i) => {
          const a = positions.get(e.source_id);
          const b = positions.get(e.target_id);
          if (!a || !b) return null;
          const style = EDGE_STYLE[e.relation_type];
          const active = hover == null || e.source_id === hover || e.target_id === hover;
          const x1 = a.x + NODE_W / 2;
          const y1 = a.y + NODE_H / 2;
          const x2 = b.x + NODE_W / 2;
          const y2 = b.y + NODE_H / 2;
          return (
            <line
              key={`${e.source_id}-${e.target_id}-${e.relation_type}-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={style.stroke}
              strokeWidth={active ? 1.5 : 1}
              strokeDasharray={style.dash}
              opacity={active ? 0.9 : 0.2}
              markerEnd={e.relation_type === "prerequisite" ? "url(#arrow)" : undefined}
            />
          );
        })}

        {nodes.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          const dim = hover != null && hover !== n.id && !adjacent.has(n.id);
          return (
            <g
              key={n.id}
              transform={`translate(${p.x}, ${p.y})`}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
              opacity={dim ? 0.35 : 1}
              className="cursor-pointer"
            >
              <Link href={`/practice?concept=${n.id}`}>
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={8}
                  fill={MASTERY_FILL[masteryBucket(n.p_known)]}
                  stroke={hover === n.id ? "var(--accent)" : "var(--border-strong)"}
                  strokeWidth={hover === n.id ? 2 : 1}
                />
                <text x={10} y={NODE_H / 2 + 4} fontSize={12} className="fill-primary">
                  {truncate(n.name, 22)}
                </text>
              </Link>
            </g>
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-small text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5" style={{ background: "var(--accent)" }} /> prerequisite
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 border-t border-dashed" style={{ borderColor: "var(--warning)" }} /> contrasts with
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5" style={{ background: "var(--border-strong)" }} /> related
        </span>
        <span className="text-muted">· node colour = mastery · click to practise</span>
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
