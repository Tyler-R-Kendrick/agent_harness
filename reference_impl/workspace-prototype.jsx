import { useState, useCallback, useRef, useEffect } from "react";

// ─── Data Model ────────────────────────────────────────────
const MEMORY_TIERS = {
  hot: { label: "Hot", color: "#ef4444", bg: "bg-red-500", dot: "bg-red-400", desc: "Full process, live JS" },
  warm: { label: "Warm", color: "#eab308", bg: "bg-yellow-500", dot: "bg-yellow-400", desc: "DOM snapshot, frozen" },
  cool: { label: "Cool", color: "#3b82f6", bg: "bg-blue-500", dot: "bg-blue-400", desc: "Serialized state on disk" },
  cold: { label: "Cold", color: "#6b7280", bg: "bg-gray-500", dot: "bg-gray-400", desc: "URL only" },
};

const initialWorkspaces = [
  {
    id: "ws-1",
    name: "Daily Driver",
    type: "workspace",
    persisted: true,
    activeMemory: true,
    expanded: true,
    icon: "🚀",
    memoryMB: 340,
    children: [
      { id: "t-1", name: "Gmail", type: "tab", url: "https://mail.google.com", memoryTier: "hot", memoryMB: 85, favicon: "📧" },
      { id: "t-2", name: "Calendar", type: "tab", url: "https://calendar.google.com", memoryTier: "warm", memoryMB: 32, favicon: "📅" },
      { id: "t-3", name: "Slack", type: "tab", url: "https://app.slack.com", memoryTier: "hot", memoryMB: 120, favicon: "💬" },
      {
        id: "ws-1a",
        name: "News Feed",
        type: "workspace",
        persisted: true,
        activeMemory: false,
        expanded: false,
        icon: "📰",
        memoryMB: 12,
        children: [
          { id: "t-4", name: "Hacker News", type: "tab", url: "https://news.ycombinator.com", memoryTier: "cool", memoryMB: 4, favicon: "🟧" },
          { id: "t-5", name: "TechCrunch", type: "tab", url: "https://techcrunch.com", memoryTier: "cold", memoryMB: 0.1, favicon: "📱" },
        ],
      },
    ],
  },
  {
    id: "ws-2",
    name: "Browser Fork Research",
    type: "workspace",
    persisted: true,
    activeMemory: true,
    expanded: true,
    icon: "🔬",
    memoryMB: 210,
    children: [
      { id: "t-6", name: "Chromium Source", type: "tab", url: "https://source.chromium.org", memoryTier: "hot", memoryMB: 95, favicon: "🌐" },
      { id: "t-7", name: "Servo GitHub", type: "tab", url: "https://github.com/servo/servo", memoryTier: "warm", memoryMB: 28, favicon: "⚙️" },
      { id: "t-8", name: "MDN Web APIs", type: "tab", url: "https://developer.mozilla.org", memoryTier: "warm", memoryMB: 35, favicon: "📚" },
      { id: "t-9", name: "BrowserOS Docs", type: "tab", url: "https://browseros.dev/docs", memoryTier: "cool", memoryMB: 5, favicon: "🖥️" },
    ],
  },
  {
    id: "ws-3",
    name: "Shopping (temp)",
    type: "workspace",
    persisted: false,
    activeMemory: true,
    expanded: false,
    icon: "🛒",
    memoryMB: 65,
    children: [
      { id: "t-10", name: "Amazon - Monitors", type: "tab", url: "https://amazon.com/monitors", memoryTier: "warm", memoryMB: 40, favicon: "📦" },
      { id: "t-11", name: "RTINGS Reviews", type: "tab", url: "https://rtings.com/monitor", memoryTier: "cool", memoryMB: 8, favicon: "📊" },
    ],
  },
  {
    id: "ws-4",
    name: "Old Recipes",
    type: "workspace",
    persisted: true,
    activeMemory: false,
    expanded: false,
    icon: "🍳",
    memoryMB: 0.4,
    children: [
      { id: "t-12", name: "Sourdough Guide", type: "tab", url: "https://example.com/sourdough", memoryTier: "cold", memoryMB: 0.1, favicon: "🍞" },
      { id: "t-13", name: "Thai Curry", type: "tab", url: "https://example.com/thai-curry", memoryTier: "cold", memoryMB: 0.1, favicon: "🍛" },
      { id: "t-14", name: "Pizza Dough", type: "tab", url: "https://example.com/pizza", memoryTier: "cold", memoryMB: 0.1, favicon: "🍕" },
    ],
  },
  {
    id: "ws-5",
    name: "Quick Search",
    type: "workspace",
    persisted: false,
    activeMemory: false,
    expanded: false,
    icon: "🔍",
    memoryMB: 0.2,
    children: [
      { id: "t-15", name: "Google: weather today", type: "tab", url: "https://google.com/search?q=weather", memoryTier: "cold", memoryMB: 0.1, favicon: "🔎" },
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────
function getTotalMemory(nodes) {
  return nodes.reduce((sum, n) => {
    if (n.type === "workspace") return sum + getTotalMemory(n.children || []);
    return sum + (n.memoryMB || 0);
  }, 0);
}

function formatMemory(mb) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${Math.round(mb)} MB`;
  return `${Math.round(mb * 1024)} KB`;
}

function countTabs(node) {
  if (node.type === "tab") return 1;
  return (node.children || []).reduce((sum, c) => sum + countTabs(c), 0);
}

// ─── Components ────────────────────────────────────────────

function MemoryTierDot({ tier }) {
  const t = MEMORY_TIERS[tier];
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${t.dot} flex-shrink-0`}
      title={`${t.label}: ${t.desc}`}
    />
  );
}

function PersistBadge({ persisted }) {
  return persisted ? (
    <span className="text-xs opacity-70" title="Persisted (saved across sessions)">📌</span>
  ) : (
    <span className="text-xs opacity-40" title="Temporary (session only)">○</span>
  );
}

function ActiveMemoryIndicator({ active }) {
  if (!active) return null;
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0" title="Active Memory (pre-loaded)">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
    </span>
  );
}

function TabNode({ tab, depth, isSelected, onSelect }) {
  const tier = MEMORY_TIERS[tab.memoryTier];
  return (
    <div
      onClick={() => onSelect(tab.id)}
      className={`flex items-center gap-2 py-1 px-2 cursor-pointer rounded-md transition-all duration-150 group
        ${isSelected ? "bg-white bg-opacity-10 ring-1 ring-white ring-opacity-20" : "hover:bg-white hover:bg-opacity-5"}`}
      style={{ paddingLeft: `${depth * 16 + 12}px` }}
    >
      <MemoryTierDot tier={tab.memoryTier} />
      <span className="text-sm flex-shrink-0">{tab.favicon || "🌐"}</span>
      <span className={`text-sm truncate ${tab.memoryTier === "cold" ? "opacity-50" : tab.memoryTier === "cool" ? "opacity-65" : "opacity-90"}`}>
        {tab.name}
      </span>
      <span className="ml-auto text-xs opacity-30 group-hover:opacity-60 flex-shrink-0 tabular-nums">
        {formatMemory(tab.memoryMB)}
      </span>
    </div>
  );
}

function WorkspaceFolder({ workspace, depth = 0, selectedId, onSelect, onToggle, onTogglePersist, onToggleMemory, onHibernate }) {
  const tabCount = countTabs(workspace);
  const isTemporary = !workspace.persisted;
  const isActive = workspace.activeMemory;

  const borderClass = isActive
    ? "border-l-2 border-green-500"
    : isTemporary
    ? "border-l-2 border-dashed border-gray-600"
    : "border-l-2 border-gray-700";

  const opacityClass = !isActive && isTemporary ? "opacity-45" : !isActive ? "opacity-65" : "opacity-100";

  return (
    <div className={`${opacityClass} transition-opacity duration-300`}>
      {/* Folder header */}
      <div
        className={`flex items-center gap-1.5 py-1.5 px-2 cursor-pointer rounded-md transition-all duration-150 group
          ${borderClass}
          ${selectedId === workspace.id ? "bg-white bg-opacity-10" : "hover:bg-white hover:bg-opacity-5"}`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => onToggle(workspace.id)}
      >
        {/* Expand/collapse chevron */}
        <span className={`text-xs transition-transform duration-200 flex-shrink-0 ${workspace.expanded ? "rotate-90" : ""}`}>
          ▶
        </span>

        <ActiveMemoryIndicator active={isActive} />
        <PersistBadge persisted={workspace.persisted} />

        <span className="text-sm flex-shrink-0">{workspace.icon || "📁"}</span>
        <span className={`text-sm font-medium truncate ${isTemporary ? "italic" : ""}`}>
          {workspace.name}
        </span>

        {/* Badges */}
        <span className="ml-auto flex items-center gap-2 flex-shrink-0">
          <span className="text-xs opacity-30 tabular-nums">{tabCount} tab{tabCount !== 1 ? "s" : ""}</span>
          <span className="text-xs opacity-30 tabular-nums">{formatMemory(workspace.memoryMB)}</span>

          {/* Context actions (visible on hover) */}
          <span className="hidden group-hover:flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onTogglePersist(workspace.id); }}
              className="p-0.5 rounded hover:bg-white hover:bg-opacity-10 text-xs"
              title={workspace.persisted ? "Remove bookmark (make temporary)" : "Bookmark (persist across sessions)"}
            >
              {workspace.persisted ? "📌" : "📍"}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleMemory(workspace.id); }}
              className="p-0.5 rounded hover:bg-white hover:bg-opacity-10 text-xs"
              title={workspace.activeMemory ? "Remove from active memory" : "Add to active memory (pre-load)"}
            >
              {workspace.activeMemory ? "🧠" : "💤"}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onHibernate(workspace.id); }}
              className="p-0.5 rounded hover:bg-white hover:bg-opacity-10 text-xs"
              title="Hibernate workspace (save state & free memory)"
            >
              ❄️
            </button>
          </span>
        </span>
      </div>

      {/* Children */}
      {workspace.expanded && workspace.children && (
        <div className="transition-all duration-200">
          {workspace.children.map((child) =>
            child.type === "workspace" ? (
              <WorkspaceFolder
                key={child.id}
                workspace={child}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
                onToggle={onToggle}
                onTogglePersist={onTogglePersist}
                onToggleMemory={onToggleMemory}
                onHibernate={onHibernate}
              />
            ) : (
              <TabNode
                key={child.id}
                tab={child}
                depth={depth + 1}
                isSelected={selectedId === child.id}
                onSelect={onSelect}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function MemoryBar({ workspaces }) {
  const totalBudget = 2048;
  const tiers = { hot: 0, warm: 0, cool: 0, cold: 0 };

  function collectTiers(nodes) {
    for (const n of nodes) {
      if (n.type === "tab") tiers[n.memoryTier] += n.memoryMB;
      if (n.children) collectTiers(n.children);
    }
  }
  collectTiers(workspaces);

  const used = tiers.hot + tiers.warm + tiers.cool + tiers.cold;
  const pct = (mb) => Math.max((mb / totalBudget) * 100, 0.5);

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between text-xs opacity-50 mb-1">
        <span>Memory Budget</span>
        <span>{formatMemory(used)} / {formatMemory(totalBudget)}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-800 gap-px">
        <div className="bg-red-500 rounded-l transition-all duration-500" style={{ width: `${pct(tiers.hot)}%` }} title={`Hot: ${formatMemory(tiers.hot)}`} />
        <div className="bg-yellow-500 transition-all duration-500" style={{ width: `${pct(tiers.warm)}%` }} title={`Warm: ${formatMemory(tiers.warm)}`} />
        <div className="bg-blue-500 transition-all duration-500" style={{ width: `${pct(tiers.cool)}%` }} title={`Cool: ${formatMemory(tiers.cool)}`} />
        <div className="bg-gray-600 rounded-r transition-all duration-500" style={{ width: `${pct(tiers.cold)}%` }} title={`Cold: ${formatMemory(tiers.cold)}`} />
      </div>
      <div className="flex gap-3 mt-1.5 text-xs opacity-40">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Hot</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />Warm</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Cool</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500 inline-block" />Cold</span>
      </div>
    </div>
  );
}

function ProcessTree({ workspaces }) {
  return (
    <div className="px-3 py-2 text-xs font-mono opacity-60">
      <div className="mb-1 text-xs font-sans opacity-70 font-medium">Process Hierarchy</div>
      <div className="text-green-400">Browser Main (PID 1)</div>
      {workspaces.map((ws) => {
        if (!ws.activeMemory) return null;
        const pid = Math.floor(Math.random() * 9000 + 1000);
        return (
          <div key={ws.id} className="ml-3">
            <div className="text-blue-300">├─ {ws.name} (PID {pid})</div>
            {ws.children
              ?.filter((c) => c.type === "tab" && (c.memoryTier === "hot" || c.memoryTier === "warm"))
              .map((tab, i, arr) => (
                <div key={tab.id} className="ml-4 text-gray-400">
                  {i === arr.length - 1 ? "└─" : "├─"} {tab.name}{" "}
                  <span className={tab.memoryTier === "hot" ? "text-red-400" : "text-yellow-400"}>
                    [{tab.memoryTier}]
                  </span>
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}

function StateExplainer({ workspace, tab }) {
  if (!workspace && !tab) {
    return (
      <div className="flex items-center justify-center h-full opacity-30 text-sm">
        Select a workspace or tab to inspect
      </div>
    );
  }

  if (tab) {
    const tier = MEMORY_TIERS[tab.memoryTier];
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{tab.favicon}</span>
          <span className="font-medium">{tab.name}</span>
        </div>
        <div className="text-xs opacity-50 truncate">{tab.url}</div>
        <div className="flex items-center gap-2 mt-2">
          <span className={`w-3 h-3 rounded-full ${tier.dot}`} />
          <span className="text-sm font-medium" style={{ color: tier.color }}>{tier.label} Tier</span>
        </div>
        <div className="text-xs opacity-60">{tier.desc}</div>
        <div className="text-xs opacity-40 mt-1">Memory: {formatMemory(tab.memoryMB)}</div>
        <div className="mt-3 p-2 rounded bg-white bg-opacity-5 text-xs opacity-50 space-y-1">
          <div className="font-medium opacity-70">What this means:</div>
          {tab.memoryTier === "hot" && <div>This tab has a full renderer process running. JS is executing, event loop is active. Switching to it is instant (&lt;50ms) but it costs ~50-150MB.</div>}
          {tab.memoryTier === "warm" && <div>This tab's DOM is frozen in memory. JS is paused. Switching takes ~300-500ms to restore the JS context. Costs ~20-50MB.</div>}
          {tab.memoryTier === "cool" && <div>This tab's state is serialized to disk (URL, scroll position, form data). No process running. Restore takes ~1-2s. Minimal memory.</div>}
          {tab.memoryTier === "cold" && <div>Only the URL is stored. Full page reload required on activation (~2-5s). Essentially a bookmark. Near-zero memory.</div>}
        </div>
      </div>
    );
  }

  return null;
}

// ─── Main App ──────────────────────────────────────────────

export default function WorkspacePrototype() {
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProcessTree, setShowProcessTree] = useState(false);
  const [notification, setNotification] = useState(null);

  const notify = useCallback((msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2000);
  }, []);

  // Deep update helper
  const updateNode = useCallback((nodes, id, updater) => {
    return nodes.map((n) => {
      if (n.id === id) return updater(n);
      if (n.children) return { ...n, children: updateNode(n.children, id, updater) };
      return n;
    });
  }, []);

  const handleToggle = useCallback((id) => {
    setWorkspaces((ws) => updateNode(ws, id, (n) => ({ ...n, expanded: !n.expanded })));
    setSelectedId(id);
  }, [updateNode]);

  const handleSelect = useCallback((id) => setSelectedId(id), []);

  const handleTogglePersist = useCallback((id) => {
    setWorkspaces((ws) => updateNode(ws, id, (n) => {
      const newPersisted = !n.persisted;
      return { ...n, persisted: newPersisted };
    }));
    notify("Toggled persistence");
  }, [updateNode, notify]);

  const handleToggleMemory = useCallback((id) => {
    setWorkspaces((ws) => updateNode(ws, id, (n) => {
      const newActive = !n.activeMemory;
      // Simulate memory tier changes on children
      const newChildren = (n.children || []).map((c) => {
        if (c.type !== "tab") return c;
        if (newActive) {
          return { ...c, memoryTier: "warm", memoryMB: c.memoryMB < 10 ? 25 : c.memoryMB };
        } else {
          return { ...c, memoryTier: "cool", memoryMB: Math.min(c.memoryMB, 5) };
        }
      });
      const newMem = newChildren.reduce((s, c) => s + (c.memoryMB || 0), 0);
      return { ...n, activeMemory: newActive, children: newChildren, memoryMB: newMem };
    }));
    notify("Toggled active memory");
  }, [updateNode, notify]);

  const handleHibernate = useCallback((id) => {
    setWorkspaces((ws) => updateNode(ws, id, (n) => {
      const newChildren = (n.children || []).map((c) => {
        if (c.type !== "tab") return c;
        return { ...c, memoryTier: "cold", memoryMB: 0.1 };
      });
      return { ...n, activeMemory: false, memoryMB: newChildren.length * 0.1, children: newChildren };
    }));
    notify("Workspace hibernated — state saved to disk");
  }, [updateNode, notify]);

  // Find selected node for inspector
  const findNode = (nodes, id) => {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const found = findNode(n.children, id);
        if (found) return found;
      }
    }
    return null;
  };
  const selected = selectedId ? findNode(workspaces, selectedId) : null;

  // Search filter
  const filterNodes = (nodes, q) => {
    if (!q) return nodes;
    return nodes.reduce((acc, n) => {
      if (n.name.toLowerCase().includes(q.toLowerCase())) {
        acc.push({ ...n, expanded: true });
      } else if (n.children) {
        const filtered = filterNodes(n.children, q);
        if (filtered.length > 0) acc.push({ ...n, children: filtered, expanded: true });
      }
      return acc;
    }, []);
  };
  const displayWorkspaces = filterNodes(workspaces, searchQuery);
  const totalMem = getTotalMemory(workspaces);
  const totalTabs = workspaces.reduce((s, w) => s + countTabs(w), 0);

  return (
    <div className="flex h-screen bg-gray-950 text-gray-200 font-sans select-none overflow-hidden">
      {/* ─── Sidebar ─── */}
      <div className="w-80 flex flex-col border-r border-gray-800 bg-gray-950">
        {/* Header */}
        <div className="p-3 border-b border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-50">Workspaces</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setShowProcessTree(!showProcessTree)}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${showProcessTree ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
              >
                {showProcessTree ? "◉ Processes" : "○ Processes"}
              </button>
              <button
                onClick={() => {
                  const newWs = {
                    id: `ws-${Date.now()}`,
                    name: "New Workspace",
                    type: "workspace",
                    persisted: false,
                    activeMemory: true,
                    expanded: true,
                    icon: "📂",
                    memoryMB: 0,
                    children: [],
                  };
                  setWorkspaces((ws) => [...ws, newWs]);
                  notify("Created new workspace");
                }}
                className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
              >
                + New
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search workspaces & tabs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-md px-3 py-1.5 text-xs placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-40 hover:opacity-80"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="px-3 py-1.5 border-b border-gray-800 flex items-center gap-3 text-xs opacity-40">
          <span>{workspaces.length} workspaces</span>
          <span>·</span>
          <span>{totalTabs} tabs</span>
          <span>·</span>
          <span>{formatMemory(totalMem)}</span>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-1">
          {displayWorkspaces.length === 0 ? (
            <div className="text-center py-8 text-xs opacity-30">No results</div>
          ) : (
            displayWorkspaces.map((ws) => (
              <WorkspaceFolder
                key={ws.id}
                workspace={ws}
                selectedId={selectedId}
                onSelect={handleSelect}
                onToggle={handleToggle}
                onTogglePersist={handleTogglePersist}
                onToggleMemory={handleToggleMemory}
                onHibernate={handleHibernate}
              />
            ))
          )}
        </div>

        {/* Memory bar */}
        <div className="border-t border-gray-800">
          <MemoryBar workspaces={workspaces} />
        </div>

        {/* Process tree overlay */}
        {showProcessTree && (
          <div className="border-t border-gray-800">
            <ProcessTree workspaces={workspaces} />
          </div>
        )}
      </div>

      {/* ─── Main Content Area ─── */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="h-10 border-b border-gray-800 flex items-center px-4 gap-3">
          <span className="text-xs opacity-30">Workspace Browser Prototype</span>
          <span className="ml-auto text-xs opacity-20">Memory-aware · Process-isolated · Tree-first</span>
        </div>

        {/* Content */}
        <div className="flex-1 flex">
          {/* Page preview area */}
          <div className="flex-1 flex items-center justify-center">
            {selected?.type === "tab" ? (
              <div className="text-center space-y-3">
                <div className="text-4xl">{selected.favicon}</div>
                <div className="text-lg font-medium opacity-80">{selected.name}</div>
                <div className="text-xs opacity-30">{selected.url}</div>
                <div className="flex items-center gap-2 justify-center mt-4">
                  <span className={`w-3 h-3 rounded-full ${MEMORY_TIERS[selected.memoryTier].dot}`} />
                  <span className="text-sm" style={{ color: MEMORY_TIERS[selected.memoryTier].color }}>
                    {MEMORY_TIERS[selected.memoryTier].label} Tier
                  </span>
                  <span className="text-xs opacity-40">— {formatMemory(selected.memoryMB)}</span>
                </div>
                {selected.memoryTier === "cold" && (
                  <div className="mt-4 px-4 py-2 rounded bg-gray-800 text-xs opacity-50">
                    This tab is in cold storage (URL only). Click to activate and load from network.
                  </div>
                )}
                {selected.memoryTier === "cool" && (
                  <div className="mt-4 px-4 py-2 rounded bg-blue-950 text-xs opacity-60">
                    Serialized state on disk. ~1-2s to restore scroll position and form data.
                  </div>
                )}
              </div>
            ) : selected?.type === "workspace" ? (
              <div className="text-center space-y-3 max-w-md">
                <div className="text-4xl">{selected.icon}</div>
                <div className="text-lg font-medium opacity-80">{selected.name}</div>
                <div className="flex items-center gap-4 justify-center text-xs opacity-50">
                  <span>{countTabs(selected)} tabs</span>
                  <span>{formatMemory(selected.memoryMB)}</span>
                  <span className={selected.persisted ? "text-yellow-400" : "text-gray-500"}>
                    {selected.persisted ? "📌 Persisted" : "○ Temporary"}
                  </span>
                  <span className={selected.activeMemory ? "text-green-400" : "text-gray-500"}>
                    {selected.activeMemory ? "🧠 Active" : "💤 Dormant"}
                  </span>
                </div>
                <div className="mt-4 p-3 rounded bg-white bg-opacity-5 text-xs opacity-40 text-left space-y-1">
                  <div className="font-medium opacity-70 mb-2">Workspace State:</div>
                  {selected.persisted && selected.activeMemory && (
                    <div>Always-ready workspace. Persisted to disk and pre-loaded in memory on browser start. Highest priority for memory budget. Process tree active.</div>
                  )}
                  {selected.persisted && !selected.activeMemory && (
                    <div>Saved bookmark workspace. URL references persist, but no memory is allocated until you activate it. Loaded on-demand.</div>
                  )}
                  {!selected.persisted && selected.activeMemory && (
                    <div>Ephemeral working context. Active in memory this session, but will be lost when the browser closes unless you pin it.</div>
                  )}
                  {!selected.persisted && !selected.activeMemory && (
                    <div>Temporary and dormant. Candidate for garbage collection. Will be cleaned up after timeout or when browser closes.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4 opacity-30">
                <div className="text-5xl">🌲</div>
                <div className="text-sm">Select a workspace or tab from the tree</div>
                <div className="text-xs max-w-xs mx-auto leading-relaxed">
                  Workspaces unify tabs, bookmarks, and sessions into a single tree. Hover over a workspace to see actions — pin it, add to active memory, or hibernate it.
                </div>
              </div>
            )}
          </div>

          {/* Inspector panel */}
          {selected && (
            <div className="w-64 border-l border-gray-800 overflow-y-auto">
              {selected.type === "tab" ? (
                <StateExplainer tab={selected} />
              ) : (
                <div className="p-4 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-40">Inspector</div>
                  <div className="flex items-center gap-2">
                    <span>{selected.icon}</span>
                    <span className="font-medium text-sm">{selected.name}</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between opacity-60">
                      <span>Type</span><span>Workspace</span>
                    </div>
                    <div className="flex justify-between opacity-60">
                      <span>Tabs</span><span>{countTabs(selected)}</span>
                    </div>
                    <div className="flex justify-between opacity-60">
                      <span>Memory</span><span>{formatMemory(selected.memoryMB)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="opacity-60">Persisted</span>
                      <button
                        onClick={() => handleTogglePersist(selected.id)}
                        className={`px-2 py-0.5 rounded text-xs ${selected.persisted ? "bg-yellow-900 text-yellow-300" : "bg-gray-800 text-gray-400"}`}
                      >
                        {selected.persisted ? "📌 Yes" : "No"}
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="opacity-60">Active Memory</span>
                      <button
                        onClick={() => handleToggleMemory(selected.id)}
                        className={`px-2 py-0.5 rounded text-xs ${selected.activeMemory ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-400"}`}
                      >
                        {selected.activeMemory ? "🧠 On" : "💤 Off"}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => handleHibernate(selected.id)}
                    className="w-full mt-3 px-3 py-1.5 rounded bg-blue-950 text-blue-300 text-xs hover:bg-blue-900 transition-colors"
                  >
                    ❄️ Hibernate Workspace
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notification toast */}
      {notification && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-gray-200 px-4 py-2 rounded-lg text-sm shadow-lg border border-gray-700 animate-bounce">
          {notification}
        </div>
      )}

      {/* Legend overlay */}
      <div className="fixed bottom-3 right-3 bg-gray-900 border border-gray-800 rounded-lg p-3 text-xs opacity-70 space-y-1.5 max-w-xs">
        <div className="font-medium opacity-80 mb-2">Visual Legend</div>
        <div className="flex items-center gap-2"><span>📌</span> Persisted (survives sessions)</div>
        <div className="flex items-center gap-2"><span className="opacity-40">○</span> Temporary (session only)</div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative rounded-full h-2 w-2 bg-green-500" /></span>
          Active Memory (pre-loaded)
        </div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Hot — <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Warm — <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Cool — <span className="w-2 h-2 rounded-full bg-gray-500 inline-block" /> Cold</div>
        <div className="opacity-50 mt-1">Hover workspaces for actions</div>
      </div>
    </div>
  );
}