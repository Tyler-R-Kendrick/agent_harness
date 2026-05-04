import { createExternalMessageHandler, registerStreamPort, } from './messages';
export function registerLocalModelConnector(chromeApi) {
    const manifest = chromeApi.runtime.getManifest();
    const env = {
        allowedSenderPatterns: manifest.externally_connectable?.matches ?? [],
        permissions: chromeApi.permissions,
        storage: chromeApi.storage.local,
        manifest,
    };
    const handleMessage = createExternalMessageHandler(env);
    chromeApi.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
        void handleMessage(message, sender).then(sendResponse);
        return true;
    });
    chromeApi.runtime.onConnectExternal.addListener((port) => registerStreamPort(port, env));
}
/* v8 ignore next 3 */
if (typeof chrome !== 'undefined' && chrome.runtime) {
    registerLocalModelConnector(chrome);
}
//# sourceMappingURL=background.js.map