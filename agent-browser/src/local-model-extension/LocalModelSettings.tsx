import { useEffect, useMemo, useState } from 'react';

import {
  LOCAL_PROVIDER_PRESETS,
  clearLocalModelExtensionSettings,
  getLocalModelExtensionSettings,
  listLocalModelsViaExtension,
  probeLocalModelExtension,
  requestLocalEndpointPermission,
  saveLocalModelExtensionSettings,
} from './client';
import { messageForStatus, statusFromErrorCode } from './errors';
import type { LocalModelConnectionStatus } from './types';

export interface LocalModelSettingsProps {
  extensionId?: string;
}

export function LocalModelSettings({ extensionId }: LocalModelSettingsProps) {
  const [status, setStatus] = useState<LocalModelConnectionStatus>('extension-not-installed');
  const [providerId, setProviderId] = useState(LOCAL_PROVIDER_PRESETS[0].id);
  const [baseUrl, setBaseUrl] = useState(LOCAL_PROVIDER_PRESETS[0].defaultBaseUrl);
  const [apiKey, setApiKey] = useState('');
  const [persistApiKey, setPersistApiKey] = useState(false);
  const [models, setModels] = useState<Array<{ id: string }>>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [busyLabel, setBusyLabel] = useState('');
  const [detail, setDetail] = useState('');
  const preset = useMemo(() => LOCAL_PROVIDER_PRESETS.find((item) => item.id === providerId) ?? LOCAL_PROVIDER_PRESETS[0], [providerId]);

  useEffect(() => {
    let active = true;
    async function load() {
      const probe = await probeLocalModelExtension({ extensionId });
      if (!active) return;
      if (!probe.installed) {
        setStatus('extension-not-installed');
        setDetail(messageForStatus('extension-not-installed'));
        return;
      }
      setStatus('extension-installed');
      setDetail(messageForStatus('extension-installed'));
      try {
        const settings = await getLocalModelExtensionSettings({ extensionId });
        if (!active) return;
        if (settings.providerId && LOCAL_PROVIDER_PRESETS.some((item) => item.id === settings.providerId)) {
          setProviderId(settings.providerId as typeof LOCAL_PROVIDER_PRESETS[number]['id']);
        }
        if (settings.baseUrl) setBaseUrl(settings.baseUrl);
        if (settings.selectedModel) setSelectedModel(settings.selectedModel);
        if (settings.hasStoredApiKey) setPersistApiKey(true);
      } catch {
        // The probe already proved the extension is present; stale settings are non-fatal.
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [extensionId]);

  function handlePresetChange(value: string) {
    const next = LOCAL_PROVIDER_PRESETS.find((item) => item.id === value) ?? LOCAL_PROVIDER_PRESETS[0];
    setProviderId(next.id);
    if (next.defaultBaseUrl && !next.defaultBaseUrl.includes('<port>')) {
      setBaseUrl(next.defaultBaseUrl);
    }
  }

  async function handlePermissionRequest() {
    setBusyLabel('Requesting permission');
    try {
      const origin = new URL(baseUrl).origin;
      const result = await requestLocalEndpointPermission({ extensionId, origin });
      setStatus(result.granted ? 'extension-installed' : 'permission-denied');
      setDetail(result.granted ? 'Permission granted for this local endpoint.' : messageForStatus('permission-denied'));
    } catch (error) {
      updateError(error);
    } finally {
      setBusyLabel('');
    }
  }

  async function handleTestConnection() {
    setBusyLabel('Testing connection');
    try {
      const nextModels = await listLocalModelsViaExtension({ extensionId, baseUrl, apiKey: apiKey || undefined });
      setModels(nextModels);
      setSelectedModel((current) => nextModels.some((model) => model.id === current) ? current : (nextModels[0]?.id ?? ''));
      setStatus('connected');
      setDetail(messageForStatus('connected'));
    } catch (error) {
      updateError(error);
    } finally {
      setBusyLabel('');
    }
  }

  async function handleSaveSettings() {
    setBusyLabel('Saving settings');
    try {
      await saveLocalModelExtensionSettings({
        extensionId,
        providerId,
        baseUrl,
        selectedModel: selectedModel || undefined,
        persistApiKey,
        apiKey: apiKey || undefined,
      });
      setDetail('Local model settings saved in the connector extension.');
    } catch (error) {
      updateError(error);
    } finally {
      setBusyLabel('');
    }
  }

  async function handleClearSettings() {
    setBusyLabel('Clearing settings');
    try {
      await clearLocalModelExtensionSettings({ extensionId });
      setApiKey('');
      setPersistApiKey(false);
      setSelectedModel('');
      setModels([]);
      setDetail('Local model connector settings cleared.');
    } catch (error) {
      updateError(error);
    } finally {
      setBusyLabel('');
    }
  }

  function updateError(error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined;
    const nextStatus = statusFromErrorCode(code);
    setStatus(nextStatus);
    setDetail(error instanceof Error ? error.message : messageForStatus(nextStatus));
  }

  return (
    <div className="local-model-extension-settings">
      <div className="provider-card-header">
        <div className="provider-body">
          <strong>Local Model Connector</strong>
          <p>Use the browser extension to reach localhost OpenAI-compatible runtimes without CORS or Private Network Access setup.</p>
        </div>
        <span className={`badge${status === 'connected' || status === 'extension-installed' ? ' connected' : ''}`}>
          {status === 'connected' ? 'Connected' : status === 'extension-not-installed' ? 'Not installed' : 'Extension ready'}
        </span>
      </div>
      <p className={status === 'connected' || status === 'extension-installed' ? 'muted' : 'file-editor-error'}>{detail || messageForStatus(status)}</p>

      <div className="local-model-extension-grid">
        <label className="provider-command-field">
          <span>Provider</span>
          <select aria-label="Local model provider" value={providerId} onChange={(event) => handlePresetChange(event.target.value)}>
            {LOCAL_PROVIDER_PRESETS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="provider-command-field">
          <span>Endpoint URL</span>
          <input aria-label="Local model endpoint URL" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="http://127.0.0.1:11434/v1" />
        </label>
        <label className="provider-command-field">
          <span>API key</span>
          <input aria-label="Local model API key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={preset.apiKeyRequired ? 'Required by provider' : 'Optional'} autoComplete="off" />
        </label>
        <label className="provider-command-field">
          <span>Model</span>
          <select aria-label="Local model selection" value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} disabled={!models.length}>
            <option value="">{models.length ? 'Choose model' : 'Test connection first'}</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>{model.id}</option>
            ))}
          </select>
        </label>
      </div>

      {preset.notes ? <p className="muted">{preset.notes}</p> : null}

      <label className="settings-checkbox-row local-model-persist-key">
        <input
          type="checkbox"
          checked={persistApiKey}
          onChange={(event) => setPersistApiKey(event.target.checked)}
          aria-label={persistApiKey ? 'Disable local API key persistence' : 'Enable local API key persistence'}
        />
        <span>Store API key in extension storage</span>
      </label>

      <div className="provider-actions">
        <button type="button" className="secondary-button" onClick={handlePermissionRequest} disabled={Boolean(busyLabel) || status === 'extension-not-installed'}>
          {busyLabel === 'Requesting permission' ? 'Requesting...' : 'Allow endpoint'}
        </button>
        <button type="button" className="secondary-button" onClick={handleTestConnection} disabled={Boolean(busyLabel) || status === 'extension-not-installed'}>
          {busyLabel === 'Testing connection' ? 'Testing...' : 'Test connection'}
        </button>
        <button type="button" className="secondary-button" onClick={handleSaveSettings} disabled={Boolean(busyLabel) || status === 'extension-not-installed'}>
          {busyLabel === 'Saving settings' ? 'Saving...' : 'Save settings'}
        </button>
        <button type="button" className="secondary-button danger-button" onClick={handleClearSettings} disabled={Boolean(busyLabel) || status === 'extension-not-installed'}>
          {busyLabel === 'Clearing settings' ? 'Clearing...' : 'Clear settings'}
        </button>
      </div>
    </div>
  );
}
