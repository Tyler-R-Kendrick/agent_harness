import { useEffect, useMemo, useState } from 'react';
import { listEditableHarnessElements } from './harnessSpec';
import type { HarnessAppSpec, HarnessElementPatch } from './types';

export type HarnessInspectorPanelProps = {
  spec: HarnessAppSpec;
  onPatchElement: (patch: HarnessElementPatch) => void;
  onRegenerate: (prompt: string) => void;
  onRestoreDefault: () => void;
};

function readElementTitle(spec: HarnessAppSpec, elementId: string): string {
  const element = spec.elements[elementId];
  const title = element?.props?.title ?? element?.props?.label ?? element?.props?.name;
  return typeof title === 'string' ? title : '';
}

export function HarnessInspectorPanel({
  spec,
  onPatchElement,
  onRegenerate,
  onRestoreDefault,
}: HarnessInspectorPanelProps) {
  const editableElements = useMemo(() => listEditableHarnessElements(spec), [spec]);
  const [selectedElementId, setSelectedElementId] = useState(editableElements[0]?.id ?? spec.root);
  const [titleDraft, setTitleDraft] = useState(() => readElementTitle(spec, selectedElementId));
  const [prompt, setPrompt] = useState('');
  const selectedElement = spec.elements[selectedElementId] ?? spec.elements[spec.root];

  useEffect(() => {
    if (!spec.elements[selectedElementId] && editableElements[0]) {
      setSelectedElementId(editableElements[0].id);
    }
  }, [editableElements, selectedElementId, spec.elements]);

  useEffect(() => {
    setTitleDraft(readElementTitle(spec, selectedElementId));
  }, [selectedElementId, spec]);

  const submitPatch = () => {
    const title = titleDraft.trim();
    if (!title || !selectedElement) return;
    onPatchElement({
      elementId: selectedElement.id,
      props: { title },
    });
  };

  const submitRegeneration = () => {
    const normalized = prompt.trim();
    if (!normalized) return;
    onRegenerate(normalized);
  };

  return (
    <aside className="harness-inspector-panel" aria-label="Harness inspector">
      <div className="harness-inspector-elements" aria-label="Editable app elements">
        {editableElements.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`harness-inspector-element${entry.id === selectedElementId ? ' is-selected' : ''}`}
            aria-label={entry.title}
            onClick={() => setSelectedElementId(entry.id)}
          >
            <span>{entry.title}</span>
            <small>{entry.type}</small>
          </button>
        ))}
      </div>

      <div className="harness-inspector-editor">
        <div className="harness-inspector-meta">
          <strong>{selectedElement?.type ?? 'Element'}</strong>
          <span>{selectedElement?.slot ?? 'app'}</span>
        </div>
        <label htmlFor="harness-element-title">Element title</label>
        <input
          id="harness-element-title"
          aria-label="Element title"
          value={titleDraft}
          onChange={(event) => setTitleDraft(event.target.value)}
        />
        <button type="button" className="primary-button" onClick={submitPatch}>Save element</button>
      </div>

      <div className="harness-inspector-regenerate">
        <label htmlFor="harness-regenerate-prompt">Describe app change</label>
        <textarea
          id="harness-regenerate-prompt"
          aria-label="Describe app change"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
        />
        <div className="harness-inspector-actions">
          <button type="button" className="primary-button" onClick={submitRegeneration}>Regenerate app</button>
          <button type="button" className="secondary-button" onClick={onRestoreDefault}>Restore default</button>
        </div>
      </div>
    </aside>
  );
}
