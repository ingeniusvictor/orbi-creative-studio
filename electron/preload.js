const { contextBridge, ipcRenderer } = require('electron');
const { getBuildIdentity } = require('./lib/buildIdentity');

contextBridge.exposeInMainWorld('localAI', {
    isElectron: true,

    // ── sd.cpp engine ──────────────────────────────────────────────────────
    getBinaryStatus: () => ipcRenderer.invoke('local-ai:binary-status'),
    downloadBinary: () => ipcRenderer.invoke('local-ai:download-binary'),

    listModels: () => ipcRenderer.invoke('local-ai:list-models'),
    downloadModel: (modelId) => ipcRenderer.invoke('local-ai:download-model', modelId),
    downloadAuxiliary: (auxKey) => ipcRenderer.invoke('local-ai:download-auxiliary', auxKey),
    deleteModel: (modelId) => ipcRenderer.invoke('local-ai:delete-model', modelId),
    cancelDownload: (modelId) => ipcRenderer.invoke('local-ai:cancel-download', modelId),

    generate: (params) => ipcRenderer.invoke('local-ai:generate', params),
    cancelGeneration: () => ipcRenderer.invoke('local-ai:cancel-generation'),

    // ── Wan2GP engine (remote Gradio server) ───────────────────────────────
    wan2gp: {
        getConfig:  () => ipcRenderer.invoke('wan2gp:get-config'),
        setUrl:     (url) => ipcRenderer.invoke('wan2gp:set-url', url),
        probe:      (url) => ipcRenderer.invoke('wan2gp:probe', url),
        listModels: () => ipcRenderer.invoke('wan2gp:list-models'),
        generate:   (params) => ipcRenderer.invoke('wan2gp:generate', params),
        cancelGeneration: () => ipcRenderer.invoke('wan2gp:cancel-generation'),
        uploadFile: (payload) => ipcRenderer.invoke('wan2gp:upload-file', payload),
    },

    // Progress events — both engines emit on local-ai:progress
    onProgress: (callback) => {
        const listener = (_, data) => callback(data);
        ipcRenderer.on('local-ai:progress', listener);
        return () => ipcRenderer.removeListener('local-ai:progress', listener);
    },
    onDownloadProgress: (callback) => {
        const listener = (_, data) => callback(data);
        ipcRenderer.on('local-ai:download-progress', listener);
        return () => ipcRenderer.removeListener('local-ai:download-progress', listener);
    },
});

// Provider secrets remain owned by the Electron main process. The renderer gets
// only the operations required for readiness and mutation; no generic secret
// read or filesystem/keychain access is exposed here.
contextBridge.exposeInMainWorld('orbiCredentials', {
    isElectron: true,
    getMuapiReadiness: () => ipcRenderer.invoke('provider-credentials:readiness'),
    setMuapiKey: (value) => ipcRenderer.invoke('provider-credentials:set-muapi-key', value),
    deleteMuapiKey: () => ipcRenderer.invoke('provider-credentials:delete-muapi-key'),
});


// MuAPI cloud requests are executed in the trusted main process. The renderer
// supplies only an allowed API path/body or upload bytes; credentials are never
// returned through this bridge.
contextBridge.exposeInMainWorld('orbiMuapi', {
    isElectron: true,
    request: (request) => ipcRenderer.invoke('muapi-transport:request', request),
    uploadFile: (payload) => ipcRenderer.invoke('muapi-transport:upload', payload),
});


// Compute Router receives only a narrow, sanitized readiness snapshot.
// This bridge does not execute generation or expose provider secrets/paths.
contextBridge.exposeInMainWorld('orbiComputeRouter', {
    isElectron: true,
    getReadinessSnapshot: () => ipcRenderer.invoke('compute-router:readiness-snapshot'),
});


// Controlled benchmark is an explicit review-evidence capability. The renderer
// may supply only an allowlisted model/backend/resolution/run index; filesystem
// paths, runtime identity and source commit are resolved in the trusted main process.
contextBridge.exposeInMainWorld('orbiBenchmark', {
    isElectron: true,
    runSample: (request) => ipcRenderer.invoke('compute-router:controlled-benchmark-sample', request),
    exportPilotBundle: (bundle) => ipcRenderer.invoke('compute-router:hardware-pilot-export', bundle),
});


// Build identity is generated before packaging and exposed as immutable,
 // non-sensitive metadata. It carries no execution or provider authority.
contextBridge.exposeInMainWorld('orbiBuildIdentity', getBuildIdentity());
