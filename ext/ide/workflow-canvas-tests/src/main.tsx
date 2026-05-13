import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkflowCanvasRenderer, type WorkflowCanvasWorkspaceFile } from '@agent-harness/ext-workflow-canvas';
import './test-harness.css';

function WorkflowCanvasTestHarness() {
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkflowCanvasWorkspaceFile[]>([]);

  return (
    <WorkflowCanvasRenderer
      workspaceName="Canvas extension test"
      workspaceFiles={workspaceFiles}
      onWorkspaceFilesChange={setWorkspaceFiles}
    />
  );
}

createRoot(document.getElementById('root')!).render(<WorkflowCanvasTestHarness />);
