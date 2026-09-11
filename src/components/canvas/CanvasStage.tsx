"use client";

import { forwardRef, useEffect, useRef } from "react";
import { Stage, Layer, Rect, Text, Line, Circle, Group } from "react-konva";
import type Konva from "konva";
import { useCanvasStore } from "@/store/canvasStore";
import { BLOCK_CATALOG } from "@/lib/catalog";
import type { CanvasNode as TCanvasNode } from "@/lib/types";

const NODE_W = 160;
const NODE_H = 64;

interface Props {
  width: number;
  height: number;
  onStageReady?: (stage: Konva.Stage | null) => void;
}

const CanvasStage = forwardRef<Konva.Stage, Props>(function CanvasStage(
  { width, height, onStageReady },
  ref,
) {
  const doc = useCanvasStore((s) => s.doc);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const selectEdge = useCanvasStore((s) => s.selectEdge);
  const moveNode = useCanvasStore((s) => s.moveNode);
  const addEdge = useCanvasStore((s) => s.addEdge);
  const connectingFrom = useCanvasStore((s) => s.connectingFrom);
  const setConnecting = useCanvasStore((s) => s.setConnecting);
  const innerRef = useRef<Konva.Stage | null>(null);

  useEffect(() => {
    onStageReady?.(innerRef.current);
    return () => onStageReady?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setStage(node: Konva.Stage | null) {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }

  const nodeById = new Map<string, TCanvasNode>(doc.nodes.map((n) => [n.id, n]));

  function nodeCenter(n: TCanvasNode) {
    return { x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 };
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.target === e.target.getStage()) {
      selectNode(null);
      selectEdge(null);
    }
  }

  function handleNodeActivate(nodeId: string) {
    const current = useCanvasStore.getState().connectingFrom;
    if (current && current !== nodeId) {
      addEdge(current, nodeId);
      setConnecting(null);
      return;
    }
    if (current === nodeId) {
      setConnecting(null);
      selectNode(nodeId);
      return;
    }
    selectNode(nodeId);
  }

  return (
    <Stage
      ref={setStage}
      width={width}
      height={height}
      onMouseDown={handleStageClick}
      className="kanvas-host"
    >
      <Layer>
        {doc.edges.map((edge) => {
          const s = nodeById.get(edge.source);
          const t = nodeById.get(edge.target);
          if (!s || !t) return null;
          const a = nodeCenter(s);
          const b = nodeCenter(t);
          const midX = (a.x + b.x) / 2;
          const sel = selectedEdgeId === edge.id;
          return (
            <Line
              key={edge.id}
              points={[a.x, a.y, midX, a.y, midX, b.y, b.x, b.y]}
              stroke={sel ? "#d4ff40" : "#3a4a55"}
              strokeWidth={sel ? 3 : 2}
              hitStrokeWidth={12}
              onClick={() => selectEdge(edge.id)}
            />
          );
        })}

        {doc.nodes.map((n) => {
          const profile = BLOCK_CATALOG[n.type];
          const selected = selectedNodeId === n.id;
          const isConnectTarget = connectingFrom && connectingFrom !== n.id;
          return (
            <Group key={n.id}>
              <Rect
                x={n.x}
                y={n.y}
                width={NODE_W}
                height={NODE_H}
                cornerRadius={10}
                fill="#161c21"
                stroke={selected ? "#d4ff40" : isConnectTarget ? "#d4ff40" : profile.color}
                strokeWidth={selected || isConnectTarget ? 3 : 2}
                shadowColor="#000"
                shadowBlur={selected ? 14 : 6}
                shadowOpacity={0.5}
                draggable
                onDragEnd={(e) => moveNode(n.id, e.target.x(), e.target.y())}
                onClick={() => handleNodeActivate(n.id)}
                onTap={() => handleNodeActivate(n.id)}
              />
              <Rect
                x={n.x}
                y={n.y}
                width={6}
                height={NODE_H}
                cornerRadius={[10, 0, 0, 10]}
                fill={profile.color}
              />
              <Text
                x={n.x + 16}
                y={n.y + 12}
                width={NODE_W - 24}
                text={n.label}
                fontSize={14}
                fontStyle="bold"
                fill="#e6edf3"
                listening={false}
              />
              <Text
                x={n.x + 16}
                y={n.y + 34}
                width={NODE_W - 24}
                text={profile.category}
                fontSize={11}
                fill="#8b98a5"
                listening={false}
              />
              <Circle
                x={n.x + NODE_W}
                y={n.y + NODE_H / 2}
                radius={6}
                fill="#0b0e0f"
                stroke={profile.color}
                strokeWidth={2}
                onClick={(e) => {
                  e.cancelBubble = true;
                  setConnecting(n.id);
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  setConnecting(n.id);
                }}
                onMouseEnter={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "crosshair";
                }}
                onMouseLeave={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = "default";
                }}
              />
            </Group>
          );
        })}
      </Layer>
    </Stage>
  );
});

export default CanvasStage;
