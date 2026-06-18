@AGENTS.md

# Knowledge graph (Graphify)

This repo has a prebuilt Graphify knowledge graph in `graphify-out/`:

- `graph.json` — raw graph data (340 nodes, 708 edges, 18 communities)
- `graph.html` — interactive graph, open in browser
- `GRAPH_REPORT.md` — audit report (god nodes, surprising connections, suggested questions)

## How to use it

**Questions about the codebase → query the graph first, don't grep blindly.**
When `graphify-out/graph.json` exists and the user asks how something works, what calls
what, or to trace a data flow, run:

```bash
graphify query "<question>"
```

Other commands:

```bash
graphify path "ConceptA" "ConceptB"   # shortest path between two nodes
graphify explain "<NodeLabel>"         # plain-language explanation of a node
graphify query "<q>" --dfs             # trace one specific path (vs BFS breadth)
```

## Keep it fresh

After meaningful code changes, refresh the graph so queries stay accurate:

```bash
/graphify . --update      # re-extract only new/changed files (incremental)
/graphify .               # full rebuild
```

Cite `source_location` from the graph output when quoting a specific fact, and answer
from the graph rather than re-deriving structure by hand.
