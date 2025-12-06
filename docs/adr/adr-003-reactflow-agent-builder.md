# ADR-003: ReactFlow for Visual Agent Builder

**Status:** Accepted

**Date:** 2025-01-23

**Context:** AI Chat Agent System Implementation

## Context

The AI Chat Agent System requires a visual workflow builder that allows users to design agent workflows without coding. Users need to:

- Drag and drop nodes onto a canvas
- Connect nodes with edges to define data flow
- Configure each node's parameters
- Visualize the complete agent workflow
- Save and load workflow definitions

Key requirements:

- React-first architecture (matches our stack)
- TypeScript support
- Customizable nodes and edges
- Production-ready performance
- Active maintenance and community

## Decision

We will use **ReactFlow 12.x** as the visual workflow builder library.

ReactFlow provides:

- Built-in features: zoom, pan, minimap, controls
- Custom node/edge support with full React components
- State management via hooks (`useNodesState`, `useEdgesState`)
- TypeScript-first API
- Extensive documentation and examples
- MIT license
- 2.79M weekly npm downloads

## Alternatives Considered

### 1. Rete.js

**Pros:**

- Specifically designed for node editors
- Plugin architecture

**Cons:**

- Less React-native integration
- Smaller community (89k weekly downloads)
- More complex setup

### 2. Custom Canvas Implementation

**Pros:**

- Full control over features
- No external dependencies

**Cons:**

- Estimated 4-6 weeks development time
- Need to implement: zoom, pan, snap-to-grid, minimap, etc.
- High maintenance burden
- Risk of bugs and edge cases

### 3. GoJS

**Pros:**

- Very mature library
- Rich feature set

**Cons:**

- Commercial license required ($2,500+)
- Not React-first
- Heavier bundle size

## Consequences

### Positive

1. **Rapid Development** - Production-ready canvas in days instead of weeks
2. **Proven Reliability** - Used by thousands of production apps
3. **Customization** - Full control over node/edge rendering with React components
4. **Performance** - Optimized for large graphs (100+ nodes)
5. **TypeScript** - Strong typing reduces bugs
6. **Ecosystem** - Plugins, examples, community support

### Negative

1. **Bundle Size** - Adds ~150KB to bundle (acceptable for feature value)
2. **Learning Curve** - Team needs to learn ReactFlow APIs
3. **Dependency Risk** - Reliant on external library maintenance

### Neutral

1. **MIT License** - No licensing issues, can fork if needed
2. **React Dependency** - Already committed to React

## Implementation Notes

### Node Types We'll Implement

```typescript
export const nodeTypes = {
  llm: LLMNode,          // Model configuration
  tool: ToolNode,        // Tool selection
  search: SearchNode,    // RAG search configuration
  condition: ConditionNode, // Conditional routing
  output: OutputNode,    // Final output
};
```

### Sample Usage

```typescript
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

export function AgentBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
```

### Storage Format

Workflow definitions will be stored as JSON in the `ai_agents.workflow_definition` column:

```json
{
  "nodes": [
    {
      "id": "node-1",
      "type": "llm",
      "position": { "x": 100, "y": 100 },
      "data": {
        "label": "Generate Response",
        "config": {
          "model": "openai/gpt-4o",
          "temperature": 0.7
        }
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2"
    }
  ]
}
```

## Related Decisions

- ADR-001: Vercel AI SDK for Agent Framework (agents will be built from ReactFlow graphs)
- Future ADR: Node validation and workflow testing strategy

## References

- [ReactFlow Documentation](https://reactflow.dev)
- [ReactFlow GitHub](https://github.com/xyflow/xyflow)
- [LangGraph GUI ReactFlow Example](https://creati.ai/ai-tools/langgraph-gui-reactflow/)

**Approved by:** Claude

**Review Date:** 2025-01-23
