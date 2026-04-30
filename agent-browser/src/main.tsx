import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import './index.css';
import App from './App';
import { COPILOT_RUNTIME_ENABLED, COPILOT_RUNTIME_URL } from './config';
import { installChatMessageCopyControls } from './services/chatMessageCopyControls';
import { CopilotRuntimeProvider } from './services/copilotRuntimeBridge';
import { configureServiceWorker } from './serviceWorker';

configureServiceWorker();
installChatMessageCopyControls();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Theme appearance="dark" accentColor="jade" grayColor="slate" radius="large" scaling="100%">
      {COPILOT_RUNTIME_ENABLED ? (
        <CopilotRuntimeProvider runtimeUrl={COPILOT_RUNTIME_URL}>
          <App />
        </CopilotRuntimeProvider>
      ) : (
        <App />
      )}
    </Theme>
  </StrictMode>,
);
