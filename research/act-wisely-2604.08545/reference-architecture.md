# Reference Architecture — HDPO-style Tool Arbitration in Agent Harness

## Goals

- Add a deterministic, testable policy layer that chooses **tool use vs abstain**.
- Preserve compatibility with existing agent-browser chat-agent routing and MCP tool execution.
- Produce logs suitable for offline training/eval loops.

## Components

1. **Task Analyzer**
   - Inputs: user prompt, workspace context, tool catalog.
   - Outputs: required-knowledge hints + confidence priors.

2. **Arbitration Policy (online)**
   - Produces `decision: "abstain" | "use_tool"` and confidence score.
   - Applies safety gates (e.g., always use tool for freshness-critical or compliance-critical requests).

3. **Tool Executor**
   - Existing MCP or in-process tool path.
   - Called only if arbitration returns `use_tool`.

4. **Outcome Evaluator**
   - Generates two signals:
     - quality proxy (success/accuracy),
     - efficiency proxy (tool count/latency).

5. **Trajectory Logger**
   - Captures turn-level decisions and outcomes.
   - Schema supports replay and offline policy updates.

6. **Offline Policy Improver (HDPO-inspired)**
   - Optimizes quality and efficiency on decoupled tracks.
   - Promotes candidates that satisfy quality floor while reducing redundant calls.

## Data flow

1. Incoming request enters Task Analyzer.
2. Arbitration Policy decides abstain/use_tool.
3. Tool Executor executes only when needed.
4. Agent returns answer and emits decision+outcome event.
5. Offline loop consumes logs and produces updated policy weights/thresholds.

## Safety and validation gates

- **Always-tool domains:** real-time prices/news, regulated calculations, or explicit user “look it up” instructions.
- **Confidence floor:** abstention allowed only above threshold and outside mandatory-tool domains.
- **Quality floor checks:** policy updates rejected if accuracy regresses beyond configured tolerance.

## Rollout policy

1. Shadow mode: policy predicts but does not gate.
2. Soft gate: low-risk intents only.
3. Full gate: all intents except always-tool domains.
4. Continuous monitoring on quality and tool-use deltas.

## Metrics

- Redundant tool-call rate.
- Mean tool calls per task.
- Task success rate / benchmark score.
- p50/p95 latency.
- Policy abstain precision and recall.
