# NEXUS | Project Process

An editable Obsidian-style process graph for mapping how people get hired, grow, and leave, next to the project-management lifecycle.

It runs as a TanStack Start app (React, TypeScript, Vite, `react-force-graph-2d`) with TanStack Store and Intent. The shared map lives in Azure SQL `atg-requirements` schema `projectprocess` and updates on every edit. Local storage is only a cache. You can still import or export JSON.

## What you get

The sample map has two parts:

- **People flow** — a left-to-right hiring spine: PM requisition → talent acquisition → sources → applicant → interviews → offer → onboard → work under a PM, with career, PIP, and exit branches
- **PM lifecycle** — a directional orange loop for the twelve-stage project process

## Editing

- Click a node or link for Edit / Delete
- Top-left **+** to place a node or draw a link (no arrows, one, or both)
- Drag empty canvas to box-select, then drag the group; click outside or press Esc to clear
- Hold Space or Alt and drag to pan; scroll to zoom
- Bottom-right: Fit, Reorg, Physics, Cards (cards appear when you zoom in)
- Light / dark restyles the canvas, not just the chrome

## Run locally

```bash
npm install
npm run sql:setup
npm run dev
```

Then open `http://127.0.0.1:5173/`.
