import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Box,
  Brush,
  ChevronDown,
  Copy,
  FileArchive,
  FileCode2,
  FileText,
  Folder,
  MessageSquare,
  MousePointer2,
  Move,
  Palette,
  PenLine,
  Plus,
  Save,
  Shapes,
  SlidersHorizontal,
  Type,
  Upload,
  Wand2,
} from 'lucide-react';
import { listDesignMdThemeOptions, type DesignMdCssRenderResult } from '../../src/index';
import type { WorkspaceFile } from '../../types';
import {
  buildDesignSystemArtifacts,
  createDesignerExportArtifact,
  createDesignerSketchArtifact,
  listDesignerFileEntries,
  readDesignerManifest,
  updateDesignerManifest,
  upsertWorkspaceFile,
  type DesignerExportKind,
  type DesignerFileEntry,
  type DesignerFidelity,
  type DesignSystemSetupInput,
} from './designerModel';

type DesignerMode = 'home' | 'setup' | 'generation' | 'review' | 'sketch';
type DesignerHomeTab = 'designs' | 'examples' | 'systems';
type DesignerWorkspaceTab = 'design-system' | 'design-files' | 'sketch';
type DesignerRailTab = 'chat' | 'comments';

export interface DesignerThemeSettings {
  themeId: string;
  applyToShell: boolean;
}

export interface DesignerPanelProps {
  workspaceName: string;
  workspaceFiles: WorkspaceFile[];
  designCss: DesignMdCssRenderResult | null;
  designThemeSettings: DesignerThemeSettings;
  onDesignThemeSettingsChange: (settings: DesignerThemeSettings) => void;
  onWorkspaceFilesChange: (files: WorkspaceFile[]) => void;
}

const initialSetupInput: DesignSystemSetupInput = {
  projectName: '',
  companyBlurb: '',
  githubUrl: '',
  localFolder: '',
  figFile: '',
  assets: '',
  notes: '',
  fidelity: 'high',
};

const generationSteps = [
  { title: 'Updated todos', detail: '+ Explore agent-browser UI and DESIGN.md' },
  { title: 'Reading source materials', detail: 'Reading App.css, DESIGN.md, icons, and screenshots' },
  { title: 'Searching visual references', detail: 'Comparing Design Studio setup, review, files, and sketch flows' },
  { title: 'Viewing image metadata', detail: 'Sampling canvas, shell, toolbar, and share menu requirements' },
  { title: 'Set project title', detail: 'Agent Browser Design System' },
];

const shareActions: Array<{ kind: DesignerExportKind; label: string; icon: typeof FileText }> = [
  { kind: 'zip', label: 'Download project as .zip', icon: FileArchive },
  { kind: 'pdf', label: 'Export as PDF', icon: FileText },
  { kind: 'pptx', label: 'Export as PPTX...', icon: FileText },
  { kind: 'canva', label: 'Send to Canva...', icon: Upload },
  { kind: 'html', label: 'Export as standalone HTML', icon: FileCode2 },
  { kind: 'handoff', label: 'Agent handoff...', icon: ArrowUpRight },
];

export function DesignerPanel({
  workspaceName,
  workspaceFiles,
  designCss,
  designThemeSettings,
  onDesignThemeSettingsChange,
  onWorkspaceFilesChange,
}: DesignerPanelProps) {
  const [mode, setMode] = useState<DesignerMode>(() => readDesignerManifest(workspaceFiles) ? 'review' : 'home');
  const [homeTab, setHomeTab] = useState<DesignerHomeTab>('designs');
  const [workspaceTab, setWorkspaceTab] = useState<DesignerWorkspaceTab>('design-system');
  const [railTab, setRailTab] = useState<DesignerRailTab>('chat');
  const [setupInput, setSetupInput] = useState<DesignSystemSetupInput>(initialSetupInput);
  const [feedback, setFeedback] = useState('');
  const [inlineComment, setInlineComment] = useState('');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [displaySize, setDisplaySize] = useState(52);
  const [layoutDensity, setLayoutDensity] = useState(4);
  const [toast, setToast] = useState<string | null>(null);

  const manifest = useMemo(() => readDesignerManifest(workspaceFiles), [workspaceFiles]);
  const designDocument = useMemo(
    () => workspaceFiles.find((file) => file.path === 'DESIGN.md') ?? null,
    [workspaceFiles],
  );
  const themeOptions = useMemo(
    () => designDocument ? listDesignMdThemeOptions(designDocument) : [{ id: 'default', label: 'Default' }],
    [designDocument],
  );
  const fileEntries = useMemo(() => listDesignerFileEntries(workspaceFiles), [workspaceFiles]);
  const selectedFile = selectedFilePath
    ? workspaceFiles.find((file) => file.path === selectedFilePath) ?? null
    : null;
  const designName = manifest?.name ?? (setupInput.projectName || 'Agent Browser Design System');

  const changeSetup = (key: keyof DesignSystemSetupInput, value: string) => {
    setSetupInput((current) => ({ ...current, [key]: value }));
  };
  const commitFiles = (files: WorkspaceFile[]) => onWorkspaceFilesChange(files);
  const addManifestChange = (
    updater: Parameters<typeof updateDesignerManifest>[1],
    timestamp = new Date().toISOString(),
  ) => {
    commitFiles(updateDesignerManifest(workspaceFiles, updater, timestamp));
  };

  function startSetup() {
    setMode('setup');
    setWorkspaceTab('design-system');
    setHomeTab('systems');
  }

  function continueToGeneration() {
    const nextFiles = buildDesignSystemArtifacts(workspaceFiles, setupInput, new Date().toISOString());
    commitFiles(nextFiles);
    setRailTab('chat');
    setWorkspaceTab('design-system');
    setMode('generation');
  }

  function approveComponent(componentId: string) {
    addManifestChange((current) => ({
      ...current,
      review: {
        ...current.review,
        components: current.review.components.map((component) => (
          component.id === componentId ? { ...component, status: 'approved' } : component
        )),
      },
    }));
  }

  function submitFeedback() {
    const body = feedback.trim();
    if (!body) return;
    addManifestChange((current) => ({
      ...current,
      review: {
        ...current.review,
        feedback: [...current.review.feedback, body],
      },
    }));
    setFeedback('');
  }

  function addComment() {
    const body = inlineComment.trim();
    if (!body) return;
    const createdAt = new Date().toISOString();
    addManifestChange((current) => ({
      ...current,
      comments: [
        ...current.comments,
        { id: `comment-${createdAt}`, target: workspaceTab, body, createdAt },
      ],
    }), createdAt);
    setInlineComment('');
  }

  function saveSketch() {
    const timestamp = new Date().toISOString();
    const sketch = createDesignerSketchArtifact(designName, timestamp);
    commitFiles(upsertWorkspaceFile(workspaceFiles, sketch));
    setToast(`Saved ${sketch.path}`);
  }

  function createExport(kind: DesignerExportKind) {
    const timestamp = new Date().toISOString();
    const artifact = createDesignerExportArtifact(kind, designName, timestamp);
    const withArtifact = upsertWorkspaceFile(workspaceFiles, artifact);
    const withManifest = updateDesignerManifest(withArtifact, (current) => ({
      ...current,
      exports: [...current.exports, { kind, path: artifact.path, createdAt: timestamp }],
    }), timestamp);
    commitFiles(withManifest);
    setShareOpen(false);
    setToast(`Created ${artifact.path}`);
  }

  const rail = mode === 'home'
    ? (
      <HomeRail
        setupInput={setupInput}
        onSetupChange={changeSetup}
        onStartSetup={startSetup}
        onCreatePrototype={() => {
          setMode('generation');
          setRailTab('chat');
        }}
      />
    )
    : (
      <DesignerChatRail
        tab={railTab}
        mode={mode}
        manifest={manifest}
        inlineComment={inlineComment}
        onTabChange={setRailTab}
        onCommentChange={setInlineComment}
        onAddComment={addComment}
      />
    );

  return (
    <section className="designer-panel" aria-label="Designer">
      {rail}
      <div className="designer-main">
        {mode === 'home' ? (
          <HomeStage
            homeTab={homeTab}
            projectName={setupInput.projectName}
            displaySize={displaySize}
            layoutDensity={layoutDensity}
            onHomeTabChange={setHomeTab}
            onStartSetup={startSetup}
            onUsePrompt={() => {
              setSetupInput((current) => ({
                ...current,
                projectName: 'Calculator construction kit',
                companyBlurb: 'Calculator construction kit with dense visual tweak controls.',
              }));
              setHomeTab('designs');
            }}
            onDisplaySizeChange={setDisplaySize}
            onLayoutDensityChange={setLayoutDensity}
          />
        ) : mode === 'setup' ? (
          <SetupStage
            setupInput={setupInput}
            onSetupChange={changeSetup}
            onContinue={continueToGeneration}
          />
        ) : (
          <WorkspaceStage
            mode={mode}
            workspaceName={workspaceName}
            workspaceTab={workspaceTab}
            manifest={manifest}
            designCss={designCss}
            designThemeSettings={designThemeSettings}
            themeOptions={themeOptions}
            fileEntries={fileEntries}
            selectedFile={selectedFile}
            feedback={feedback}
            toast={toast}
            shareOpen={shareOpen}
            onWorkspaceTabChange={setWorkspaceTab}
            onModeChange={setMode}
            onShareOpenChange={setShareOpen}
            onThemeSettingsChange={onDesignThemeSettingsChange}
            onApproveComponent={approveComponent}
            onFeedbackChange={setFeedback}
            onSubmitFeedback={submitFeedback}
            onSelectFile={setSelectedFilePath}
            onSaveSketch={saveSketch}
            onExport={createExport}
          />
        )}
      </div>
    </section>
  );
}

function HomeRail({
  setupInput,
  onSetupChange,
  onStartSetup,
  onCreatePrototype,
}: {
  setupInput: DesignSystemSetupInput;
  onSetupChange: (key: keyof DesignSystemSetupInput, value: string) => void;
  onStartSetup: () => void;
  onCreatePrototype: () => void;
}) {
  return (
    <aside className="designer-home-rail" aria-label="Designer home">
      <header className="designer-brand">
        <Palette size={24} />
        <div>
          <h1>Design Studio</h1>
          <p>by Anthropic Labs <span>Research Preview</span></p>
        </div>
      </header>
      <div className="designer-type-tabs" role="group" aria-label="Create type">
        {['Prototype', 'Slide deck', 'From template', 'Other'].map((label, index) => (
          <button key={label} type="button" className={index === 0 ? 'active' : ''}>{label}</button>
        ))}
      </div>
      <section className="designer-create-card">
        <h2>New prototype</h2>
        <input
          aria-label="Project name"
          placeholder="Project name"
          value={setupInput.projectName}
          onChange={(event) => onSetupChange('projectName', event.target.value)}
        />
        <div className="designer-fidelity-grid">
          <button
            type="button"
            className={setupInput.fidelity === 'wireframe' ? 'active' : ''}
            onClick={() => onSetupChange('fidelity', 'wireframe' satisfies DesignerFidelity)}
          >
            <span className="wireframe-thumb" />
            Wireframe
          </button>
          <button
            type="button"
            className={setupInput.fidelity === 'high' ? 'active' : ''}
            onClick={() => onSetupChange('fidelity', 'high' satisfies DesignerFidelity)}
          >
            <span className="fidelity-thumb" />
            High fidelity
          </button>
        </div>
        <button type="button" className="designer-primary-action" onClick={onCreatePrototype}>
          <Plus size={16} /> Create
        </button>
      </section>
      <p className="designer-private-note">Only you can see your project by default.</p>
      <section className="designer-cta-card">
        <p>Create a design system so anyone can create good-looking designs and assets.</p>
        <button type="button" onClick={onStartSetup}>Set up design system</button>
      </section>
      <footer className="designer-home-footer">
        <button type="button">Docs</button>
        <button type="button">contact@example.com's Organization</button>
        <button type="button">Tyler</button>
      </footer>
    </aside>
  );
}

function HomeStage({
  homeTab,
  projectName,
  displaySize,
  layoutDensity,
  onHomeTabChange,
  onStartSetup,
  onUsePrompt,
  onDisplaySizeChange,
  onLayoutDensityChange,
}: {
  homeTab: DesignerHomeTab;
  projectName: string;
  displaySize: number;
  layoutDensity: number;
  onHomeTabChange: (tab: DesignerHomeTab) => void;
  onStartSetup: () => void;
  onUsePrompt: () => void;
  onDisplaySizeChange: (value: number) => void;
  onLayoutDensityChange: (value: number) => void;
}) {
  return (
    <div className="designer-home-stage">
      <nav className="designer-stage-tabs" aria-label="Designer main tabs">
        {(['designs', 'examples', 'systems'] as const).map((tab) => (
          <button key={tab} type="button" className={homeTab === tab ? 'active' : ''} onClick={() => onHomeTabChange(tab)}>
            {tab === 'systems' ? 'Design systems' : tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>
      {homeTab === 'designs' ? (
        <section className="designer-home-content">
          <div className="designer-segmented">
            <button type="button" className="active">Recent</button>
            <button type="button">Your designs</button>
          </div>
          <article className="designer-tutorial-card">
            <div className="tutorial-illustration" />
            <strong>Learn about Design Studio</strong>
            <span>Quick tutorial</span>
          </article>
          {projectName ? <p className="designer-prompt-chip">Prompt ready: {projectName}</p> : null}
          <input className="designer-search" aria-label="Search designs" placeholder="Search..." />
        </section>
      ) : homeTab === 'examples' ? (
        <section className="designer-example-stage">
          <div className="calculator-example" aria-label="Calculator construction kit preview">
            <div className="calculator-device">
              <div className="calculator-display">0</div>
              {['AC', '+/-', '%', '/', '7', '8', '9', 'x', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '='].map((key) => (
                <span key={key}>{key}</span>
              ))}
            </div>
            <div className="calculator-controls">
              <h2>Calculator Kit</h2>
              <TweakGroup title="Shell style" options={['Default', 'Flat', 'Brutal', 'Soft', 'Glass']} />
              <TweakGroup title="Key shape" options={['Sharp', 'Rounded', 'Round', 'Pill', 'Circle']} />
              <label>
                <span>Display size</span>
                <input aria-label="Display size" type="range" min="36" max="72" value={displaySize} onChange={(event) => onDisplaySizeChange(Number(event.target.value))} />
                <output>{displaySize}</output>
              </label>
              <label>
                <span>Layout density</span>
                <input aria-label="Layout density" type="range" min="3" max="6" value={layoutDensity} onChange={(event) => onLayoutDensityChange(Number(event.target.value))} />
                <output>{layoutDensity}x</output>
              </label>
            </div>
          </div>
          <aside className="designer-example-copy">
            <h2>Calculator construction kit</h2>
            <p>"Create a Calculator construction kit", a simple calculator UI with many tweak controls and a two-column layout.</p>
            <button type="button" onClick={onUsePrompt}>Use this prompt</button>
          </aside>
        </section>
      ) : (
        <section className="designer-systems-stage">
          <h2>Design Systems</h2>
          <div className="designer-system-row">
            <div>
              <strong>Create new design system</strong>
              <span>Teach Claude your brand and product</span>
            </div>
            <button type="button" onClick={onStartSetup}>Create</button>
          </div>
          <h3>Templates</h3>
          <div className="designer-empty-template">No templates yet. Create one from any project via the Share menu - File type.</div>
          <p>Only you can view these settings.</p>
        </section>
      )}
    </div>
  );
}

function DesignerChatRail({
  tab,
  mode,
  manifest,
  inlineComment,
  onTabChange,
  onCommentChange,
  onAddComment,
}: {
  tab: DesignerRailTab;
  mode: DesignerMode;
  manifest: ReturnType<typeof readDesignerManifest>;
  inlineComment: string;
  onTabChange: (tab: DesignerRailTab) => void;
  onCommentChange: (value: string) => void;
  onAddComment: () => void;
}) {
  return (
    <aside className="designer-chat-rail" aria-label="Designer chat">
      <div className="designer-project-title">
        <Palette size={18} />
        <strong>{manifest?.name ?? 'Design System'}</strong>
      </div>
      <div className="designer-rail-tabs">
        <button type="button" className={tab === 'chat' ? 'active' : ''} onClick={() => onTabChange('chat')}>Chat</button>
        <button type="button" className={tab === 'comments' ? 'active' : ''} onClick={() => onTabChange('comments')}>Comments</button>
        <button type="button" aria-label="New comment"><Plus size={14} /></button>
      </div>
      {tab === 'chat' ? (
        <div className="designer-chat-stream">
          <strong>You</strong>
          <span className="designer-user-pill">Create design system</span>
          <strong>Claude</strong>
          {mode === 'generation' ? generationSteps.map((step) => (
            <article key={step.title} className="designer-tool-card">
              <header><Wand2 size={14} /> {step.title}<ChevronDown size={13} /></header>
              <p>{step.detail}</p>
            </article>
          )) : (
            <article className="designer-tool-card">
              <header><SlidersHorizontal size={14} /> Updated todos<ChevronDown size={13} /></header>
              <p>Explore agent-browser, build token and component cards, then review.</p>
            </article>
          )}
          <div className="designer-caveats">
            <strong>Caveats / substitutions to flag:</strong>
            <ul>
              <li><b>Fonts swapped.</b> Font files can be added under design/fonts.</li>
              <li><b>Brand color sampled.</b> Confirm tokens in DESIGN.md before publishing.</li>
              <li><b>One product surface.</b> Agent Browser is the canonical shell target.</li>
              <li><b>No external export APIs.</b> Export actions create local handoff artifacts.</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="designer-comments-pane">
          <label>
            <span>Inline comment</span>
            <textarea aria-label="Inline comment" value={inlineComment} onChange={(event) => onCommentChange(event.target.value)} placeholder="Click a canvas area, then describe the change..." />
          </label>
          <button type="button" onClick={onAddComment}>Add comment</button>
          <div className="designer-comment-list">
            {manifest?.comments.length ? manifest.comments.map((comment) => (
              <article key={comment.id}>
                <MessageSquare size={13} />
                <span>{comment.body}</span>
              </article>
            )) : <p>No inline comments yet.</p>}
          </div>
        </div>
      )}
      <div className="designer-composer">
        <textarea aria-label="Designer prompt" placeholder="Describe what you want to create..." />
        <div>
          <button type="button" aria-label="Designer settings"><SlidersHorizontal size={14} /></button>
          <button type="button">Import</button>
          <button type="button">Send</button>
        </div>
      </div>
    </aside>
  );
}

function WorkspaceStage(props: {
  mode: DesignerMode;
  workspaceName: string;
  workspaceTab: DesignerWorkspaceTab;
  manifest: ReturnType<typeof readDesignerManifest>;
  designCss: DesignMdCssRenderResult | null;
  designThemeSettings: DesignerThemeSettings;
  themeOptions: Array<{ id: string; label: string }>;
  fileEntries: DesignerFileEntry[];
  selectedFile: WorkspaceFile | null;
  feedback: string;
  toast: string | null;
  shareOpen: boolean;
  onWorkspaceTabChange: (tab: DesignerWorkspaceTab) => void;
  onModeChange: (mode: DesignerMode) => void;
  onShareOpenChange: (open: boolean) => void;
  onThemeSettingsChange: (settings: DesignerThemeSettings) => void;
  onApproveComponent: (componentId: string) => void;
  onFeedbackChange: (value: string) => void;
  onSubmitFeedback: () => void;
  onSelectFile: (path: string) => void;
  onSaveSketch: () => void;
  onExport: (kind: DesignerExportKind) => void;
}) {
  const {
    mode,
    workspaceName,
    workspaceTab,
    manifest,
    designCss,
    designThemeSettings,
    themeOptions,
    fileEntries,
    selectedFile,
    feedback,
    toast,
    shareOpen,
    onWorkspaceTabChange,
    onModeChange,
    onShareOpenChange,
    onThemeSettingsChange,
    onApproveComponent,
    onFeedbackChange,
    onSubmitFeedback,
    onSelectFile,
    onSaveSketch,
    onExport,
  } = props;

  return (
    <div className="designer-workspace">
      <header className="designer-workspace-tabs">
        <nav role="tablist" aria-label="Designer workspace tabs">
          <button type="button" role="tab" aria-selected={workspaceTab === 'design-system'} onClick={() => onWorkspaceTabChange('design-system')}>Design System</button>
          <button type="button" role="tab" aria-selected={workspaceTab === 'design-files'} onClick={() => onWorkspaceTabChange('design-files')}>Design Files</button>
          {workspaceTab === 'sketch' || mode === 'sketch' ? <button type="button" role="tab" aria-selected>sketch-2026-05-02...</button> : null}
        </nav>
        <div className="designer-workspace-actions">
          {mode !== 'generation' ? <button type="button" onClick={() => { onWorkspaceTabChange('sketch'); onModeChange('sketch'); }}>New sketch</button> : null}
          <button type="button" className="designer-share-button" onClick={() => onShareOpenChange(!shareOpen)}>Share</button>
        </div>
      </header>
      {workspaceTab === 'design-files' ? (
        <DesignFilesStage fileEntries={fileEntries} selectedFile={selectedFile} onSelectFile={onSelectFile} />
      ) : workspaceTab === 'sketch' || mode === 'sketch' ? (
        <SketchStage toast={toast} onSaveSketch={onSaveSketch} />
      ) : mode === 'setup' ? (
        <SetupFallback />
      ) : mode === 'generation' ? (
        <GenerationStage onReview={() => onModeChange('review')} />
      ) : (
        <ReviewStage
          workspaceName={workspaceName}
          manifest={manifest}
          designCss={designCss}
          designThemeSettings={designThemeSettings}
          themeOptions={themeOptions}
          feedback={feedback}
          onThemeSettingsChange={onThemeSettingsChange}
          onApproveComponent={onApproveComponent}
          onFeedbackChange={onFeedbackChange}
          onSubmitFeedback={onSubmitFeedback}
        />
      )}
      {shareOpen ? <ShareMenu onExport={onExport} /> : null}
    </div>
  );
}

function SetupStage({
  setupInput,
  onSetupChange,
  onContinue,
}: {
  setupInput: DesignSystemSetupInput;
  onSetupChange: (key: keyof DesignSystemSetupInput, value: string) => void;
  onContinue: () => void;
}) {
  return (
    <section className="designer-setup-stage">
      <button type="button" className="designer-back-button">Back</button>
      <div className="designer-spinner" />
      <button type="button" className="designer-continue-button" onClick={onContinue}>Continue to generation</button>
      <div className="designer-setup-form">
        <div className="designer-setup-mark"><Shapes size={42} /></div>
        <h2>Set up your design system</h2>
        <p>Tell us about your company and attach any design resources you have.</p>
        <label>
          <span>Company name and blurb <small>(or name of design system)</small></span>
          <textarea
            aria-label="Company name and blurb"
            value={setupInput.companyBlurb}
            onChange={(event) => onSetupChange('companyBlurb', event.target.value)}
            placeholder="e.g. Mission Impastabowl: fast-casual pasta restaurant with in-store touchscreen kiosk, mobile app and website"
          />
        </label>
        <section className="designer-upload-table" aria-label="Design system source materials">
          <div>
            <strong>Link code on GitHub</strong>
            <input aria-label="Link code on GitHub" value={setupInput.githubUrl} onChange={(event) => onSetupChange('githubUrl', event.target.value)} placeholder="https://github.com/owner/repo" />
            <button type="button">Add</button>
          </div>
          <div>
            <strong>Link code from your computer</strong>
            <input aria-label="Link code from your computer" value={setupInput.localFolder} onChange={(event) => onSetupChange('localFolder', event.target.value)} placeholder="Drag a folder here or browse" />
          </div>
          <p>This doesn't upload the whole codebase; Claude will copy selected files. For large codebases, attach a frontend-focused subfolder.</p>
          <div>
            <strong>Upload a .fig file</strong>
            <input aria-label="Upload a .fig file" value={setupInput.figFile} onChange={(event) => onSetupChange('figFile', event.target.value)} placeholder="Drop .fig here or browse" />
          </div>
          <p>Parsed locally in your browser - never uploaded.</p>
          <div>
            <strong>Add fonts, logos and assets</strong>
            <input aria-label="Add fonts, logos and assets" value={setupInput.assets} onChange={(event) => onSetupChange('assets', event.target.value)} placeholder="Drag files here or browse" />
          </div>
        </section>
        <label>
          <span>Any other notes?</span>
          <textarea aria-label="Any other notes" value={setupInput.notes} onChange={(event) => onSetupChange('notes', event.target.value)} placeholder="What matters most about this brand?" />
        </label>
      </div>
    </section>
  );
}

function SetupFallback() {
  return (
    <div className="designer-setup-fallback">
      <p>Setup is open in the form. Continue to generation to create DESIGN.md and design files.</p>
    </div>
  );
}

function GenerationStage({ onReview }: { onReview: () => void }) {
  return (
    <section className="designer-generation-stage">
      <button type="button" className="designer-back-button">Back</button>
      <div className="designer-spinner" />
      <button type="button" className="designer-continue-button" onClick={onReview}>Review draft design system</button>
      <div className="designer-generation-center">
        <h2>Creating your design system...</h2>
        <p>Keep this tab open and come back in 5 minutes</p>
        <div className="designer-progress-line"><span /></div>
      </div>
      <div className="designer-generation-thumb">
        <strong>1791</strong>
        <span />
      </div>
    </section>
  );
}

function ReviewStage({
  workspaceName,
  manifest,
  designCss,
  designThemeSettings,
  themeOptions,
  feedback,
  onThemeSettingsChange,
  onApproveComponent,
  onFeedbackChange,
  onSubmitFeedback,
}: {
  workspaceName: string;
  manifest: ReturnType<typeof readDesignerManifest>;
  designCss: DesignMdCssRenderResult | null;
  designThemeSettings: DesignerThemeSettings;
  themeOptions: Array<{ id: string; label: string }>;
  feedback: string;
  onThemeSettingsChange: (settings: DesignerThemeSettings) => void;
  onApproveComponent: (componentId: string) => void;
  onFeedbackChange: (value: string) => void;
  onSubmitFeedback: () => void;
}) {
  return (
    <section className="designer-review-stage">
      <h2>Review draft design system</h2>
      <article className="designer-publish-card">
        <p>Your design system is ready, but your feedback will improve it. Your team's new projects will use this design system by default.</p>
        <label><input type="checkbox" defaultChecked /> Published</label>
        <label><input type="checkbox" defaultChecked /> Default</label>
        <strong>Use this system</strong>
        <button type="button">New design</button>
      </article>
      <article className="designer-warning-card">
        <Upload size={16} />
        <div>
          <strong>Missing brand fonts</strong>
          <p>Claude is rendering typography with substitute web fonts.</p>
        </div>
        <button type="button">Upload fonts</button>
      </article>
      <div className="designer-theme-review">
        <label>
          <span>Design Studio theme</span>
          <select
            aria-label="Design Studio theme"
            value={designThemeSettings.themeId}
            onChange={(event) => onThemeSettingsChange({ ...designThemeSettings, themeId: event.target.value })}
          >
            {themeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <input
            aria-label="Apply Design Studio theme to Agent Browser"
            type="checkbox"
            checked={designThemeSettings.applyToShell}
            onChange={(event) => onThemeSettingsChange({ ...designThemeSettings, applyToShell: event.target.checked })}
          />
          Apply tokens to Agent Browser shell
        </label>
      </div>
      <div className="designer-component-review">
        {(manifest?.review.components ?? []).map((component) => (
          <article key={component.id} className="designer-review-card">
            <header>
              <div>
                <strong>{component.label}</strong>
                <span>{component.variants.join(' - ')}</span>
              </div>
              <button type="button" onClick={() => onApproveComponent(component.id)}>Looks good for {component.label}</button>
              <button type="button" className="needs-work">Needs work...</button>
            </header>
            <div className="designer-widget-preview">
              {component.variants.map((variant) => <button key={variant} type="button" data-design-widget={variant.includes('Primary') ? 'button-primary' : 'button-secondary'}>{variant}</button>)}
            </div>
          </article>
        ))}
      </div>
      <label className="designer-feedback-box">
        <span>Feedback for {workspaceName}</span>
        <textarea aria-label="Describe what you'd prefer" value={feedback} onChange={(event) => onFeedbackChange(event.target.value)} placeholder="Describe what you'd prefer..." />
      </label>
      <div className="designer-feedback-actions">
        <button type="button">Cancel</button>
        <button type="button" onClick={onSubmitFeedback}>Submit feedback</button>
      </div>
      <div className="designer-feedback-list">
        {manifest?.review.feedback.map((item) => <p key={item}>{item}</p>)}
      </div>
      <textarea className="designer-css-output" aria-label="Generated Design Studio CSS" readOnly value={designCss?.css ?? ''} />
    </section>
  );
}

function DesignFilesStage({
  fileEntries,
  selectedFile,
  onSelectFile,
}: {
  fileEntries: DesignerFileEntry[];
  selectedFile: WorkspaceFile | null;
  onSelectFile: (path: string) => void;
}) {
  const sections = ['Folders', 'Stylesheets', 'Documents', 'Previews', 'Sketches', 'Exports', 'Assets'] as const;
  return (
    <section className="designer-files-stage">
      <div className="designer-file-toolbar">
        <button type="button" aria-label="Back to folder"><ChevronDown size={14} /></button>
        <button type="button" aria-label="Refresh files"><Wand2 size={14} /></button>
        <span>project</span>
      </div>
      <div className="designer-file-list">
        {sections.map((section) => {
          const entries = fileEntries.filter((entry) => entry.section === section);
          if (!entries.length) return null;
          return (
            <div key={section} className="designer-file-section">
              <h3>{section.toUpperCase()}</h3>
              {entries.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  className="designer-file-row"
                  onClick={() => entry.kind === 'file' && onSelectFile(entry.path)}
                  aria-label={entry.kind === 'file' ? `Preview ${entry.name}` : entry.name}
                >
                  {entry.kind === 'folder' ? <Folder size={17} /> : <FileText size={17} />}
                  <span><strong>{entry.name}</strong><small>{entry.kind === 'folder' ? 'Folder' : entry.section.slice(0, -1)}</small></span>
                  <em>{entry.kind === 'file' ? '4h ago' : '-'}</em>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <aside className="designer-file-preview">
        {selectedFile ? (
          <pre aria-label="Selected design file preview">{selectedFile.content}</pre>
        ) : (
          <p>Select a file to preview</p>
        )}
      </aside>
      <footer className="designer-drop-zone">
        <Upload size={14} /> DROP FILES HERE
        <span>Images, docs, references, Figma links, or folders - Claude will use them as context.</span>
      </footer>
    </section>
  );
}

function SketchStage({ toast, onSaveSketch }: { toast: string | null; onSaveSketch: () => void }) {
  const tools = [
    { label: 'Select tool', icon: MousePointer2 },
    { label: 'Pan tool', icon: Move },
    { label: 'Pen tool', icon: PenLine },
    { label: 'Text tool', icon: Type },
    { label: 'Shape tool', icon: Shapes },
    { label: 'Arrow tool', icon: ArrowUpRight },
    { label: 'Component library', icon: Box },
  ];
  return (
    <section className="designer-sketch-stage" aria-label="Designer sketch canvas">
      <div className="designer-sketch-toolbar">
        {tools.map(({ label, icon: ToolIcon }) => (
          <button key={label} type="button" aria-label={label}><ToolIcon size={19} /></button>
        ))}
        <button type="button" className="designer-save-button" onClick={onSaveSketch}><Save size={15} /> Save sketch</button>
      </div>
      <div className="designer-sketch-note">
        <Brush size={18} />
        <span>Sketch canvas ready</span>
      </div>
      {toast ? <div className="designer-toast">{toast}</div> : null}
    </section>
  );
}

function ShareMenu({ onExport }: { onExport: (kind: DesignerExportKind) => void }) {
  return (
    <aside className="designer-share-menu" role="dialog" aria-label="Share and export design">
      <label>
        <span>Access</span>
        <select aria-label="Share access" defaultValue="edit">
          <option value="edit">Teammates can edit</option>
          <option value="comment">Teammates can comment</option>
          <option value="view">View only</option>
        </select>
      </label>
      <button type="button" className="designer-copy-link"><Copy size={13} /> Copy link</button>
      <p>Only you can see this design.</p>
      <label>
        <span>File type</span>
        <select aria-label="File type" defaultValue="design-system">
          <option value="design-system">Design System</option>
          <option value="prototype">Prototype</option>
          <option value="template">Template</option>
        </select>
      </label>
      <button type="button">Duplicate project</button>
      <button type="button">Duplicate as template</button>
      {shareActions.map(({ kind, label, icon: ActionIcon }) => (
        <button key={kind} type="button" onClick={() => onExport(kind)}>
          <ActionIcon size={14} /> {label}
        </button>
      ))}
    </aside>
  );
}

function TweakGroup({ title, options }: { title: string; options: string[] }) {
  return (
    <div className="designer-tweak-group">
      <strong>{title}</strong>
      <div>
        {options.map((option, index) => <button key={option} type="button" className={index === 0 ? 'active' : ''}>{option}</button>)}
      </div>
    </div>
  );
}
