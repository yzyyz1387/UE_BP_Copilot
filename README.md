# UE Blueprint AI Studio

> A local-first AI-powered UE5 Blueprint visualizer. Describe your logic in natural language, get a structured node graph with variables, tips, and checklists — all running directly in the browser.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript&logoColor=white&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white&style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Overview

UE Blueprint AI Studio connects directly to any OpenAI-compatible API from the browser and generates structured blueprint plans — no backend required. The left pane renders an interactive node canvas; the right pane surfaces the AI's reasoning as variables, warnings, search tips, and a step-by-step checklist.

The project is intentionally kept as a **local-first prototype**: your API key never leaves your machine to a third-party server.

---

## Features

- **Conversational blueprint generation** — multi-turn chat with full context of the current graph
- **Structured output** — JSON Schema-constrained responses with nodes, links, variables, messages, search tips, and checklist
- **Dual API mode** — supports both `POST /responses` and `POST /chat/completions` endpoints
- **Graceful fallback** — automatically retries with a JSON-only prompt when Structured Outputs are unsupported
- **Interactive canvas** — pan, zoom, click nodes to inspect pins and metadata
- **Node detail in header** — selected node's category, title, inputs and outputs always visible
- **Import / Export** — paste external JSON to load a plan, or export the current graph
- **External prompt template** — one-click copy of a ready-to-use prompt for other AI tools
- **Built-in demo** — a working "Press E to open door" Actor blueprint, no API key needed to explore the UI

---

## Tech Stack

| Layer | Library |
|---|---|
| UI framework | React 19 + TypeScript |
| Build tool | Vite 7 |
| Blueprint canvas | @xyflow/react (React Flow) |
| API transport | Browser `fetch` → OpenAI REST |
| Persistence | `localStorage` (config only) |

---

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, fill in your API settings on the right panel, and start describing a blueprint.

```bash
# Production build
npm run build
npm run preview
```

---

## Configuration

| Field | Description | Example |
|---|---|---|
| Base URL | Root URL of your OpenAI-compatible endpoint | `https://api.openai.com/v1` |
| API Key | Your API key | `sk-...` |
| Model | Model name | `gpt-4o` |
| API Mode | Endpoint variant | `chat/completions` |
| Blueprint Type | UE class context | `Actor`, `Character`, `Widget` |
| UE Version | Target engine version | `UE 5.3+` |
| Scene Context | Optional free-text context for the AI | `Door Actor with BoxCollision` |

---

## Output Schema

Every generation produces a single JSON object conforming to this structure:

```jsonc
{
  "meta": {
    "title": "Actor Blueprint: Press E to Open Door",
    "summary": "...",
    "blueprintType": "Actor",
    "ueVersion": "UE 5.3+",
    "targetUser": "Beginner",
    "sceneContext": "..."
  },
  "assistantReply": "...",   // natural-language summary shown in chat
  "nodes": [...],            // blueprint nodes with pins and position
  "links": [...],            // connections between pins
  "variables": [...],        // suggested variables with reasons
  "messages": [...],         // warnings, tips, notes
  "searchTips": [...],       // how to find hard-to-locate nodes in UE
  "checklist": [...]         // ordered steps to follow in the UE editor
}
```

---

## Project Structure

```
src/
├── components/
│   ├── BlueprintCanvas.tsx   # React Flow canvas wrapper
│   ├── BlueprintNode.tsx     # Custom node renderer
│   ├── ChatPanel.tsx         # Conversation UI
│   ├── HeaderBar.tsx         # Top bar with node detail
│   ├── ImportPanel.tsx       # JSON import / external prompt
│   ├── InspectorTabs.tsx     # Notes, variables, tips, checklist, JSON
│   ├── SettingsPanel.tsx     # API and context configuration
│   └── Toast.tsx             # Toast notification system
├── data/
│   └── demoBlueprint.ts      # Built-in demo plan
├── lib/
│   ├── blueprintTransform.ts # Normalize raw AI output
│   ├── localStorage.ts       # Config persistence
│   ├── openaiClient.ts       # API request logic with fallback
│   └── prompt.ts             # Prompt builders
├── App.tsx
├── schema.ts                 # JSON Schema for structured output
├── styles.css
└── types.ts
```

---

## Security

This project makes API requests directly from the browser. Your key is **not** sent to any intermediary server, but it does exist in the browser environment.

- Suitable for: local development, internal tools, personal use, demos
- Not suitable for: public deployments where end users supply their own keys

For a production deployment, consider adding a server-side proxy layer with short-lived tokens and rate limiting.

---

## Roadmap

**Near-term**
- Node whitelist / dictionary to reduce hallucinated node names
- Canvas state persistence (save / load drafts)
- More accurate UE5 node styling

**Mid-term**
- Blueprint logic validator (connection legality checks)
- Auto-suggest variables from node context
- "How to build this manually in UE" step export

**Long-term**
- UE Editor plugin bridge — consume the JSON plan directly inside Unreal
- Incremental graph patching driven by natural language diffs

---

## License

MIT
