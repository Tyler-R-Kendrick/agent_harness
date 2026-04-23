import { ArrowLeft } from 'lucide-react';
import type { ProcessEntry } from '../../services/processLog';

function formatPayload(payload: unknown): string {
  if (payload === null || payload === undefined) return '';
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

/**
 * Per-entry drill-down. Always shows two stacked sections — Reasoning
 * transcript and Payload — so all tokens for a row are discoverable.
 */
export function ProcessDrilldown({
  entry,
  onBack,
}: {
  entry: ProcessEntry;
  onBack: () => void;
}) {
  const transcript = entry.transcript?.trim();
  const payloadText = formatPayload(entry.payload).trim();

  return (
    <aside
      className="op-pane pg-drilldown"
      aria-label={`${entry.actor} ${entry.kind} detail`}
    >
      <header className="op-pane-header">
        <button
          type="button"
          className="op-pane-back"
          aria-label="Back to graph"
          onClick={onBack}
        >
          <ArrowLeft size={14} />
        </button>
        <div className="op-pane-title">
          <strong>{entry.actor}</strong>
          <span className="pg-drilldown-kind">{entry.kind}</span>
        </div>
      </header>
      <div className="pg-drilldown-body">
        <section className="pg-drilldown-section">
          <h3 className="pg-drilldown-section-title">Reasoning transcript</h3>
          {transcript ? (
            <pre className="pg-drilldown-pre">{transcript}</pre>
          ) : (
            <p className="pg-drilldown-empty">No reasoning transcript captured for this entry.</p>
          )}
        </section>
        <section className="pg-drilldown-section">
          <h3 className="pg-drilldown-section-title">Payload</h3>
          {payloadText ? (
            <pre className="pg-drilldown-pre">{payloadText}</pre>
          ) : (
            <p className="pg-drilldown-empty">No structured payload captured for this entry.</p>
          )}
        </section>
        <section className="pg-drilldown-section">
          <h3 className="pg-drilldown-section-title">Summary</h3>
          <p className="pg-drilldown-summary">{entry.summary}</p>
        </section>
      </div>
    </aside>
  );
}
