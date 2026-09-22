const SD_BACKEND_ENV = 'OPEN_GENERATIVE_AI_SD_BACKEND';

const RUNTIME_MANIFEST = {
    'linux-x64': {
        cpu: {
            backend: 'cpu',
            release: 'master-859-7f410a3',
            upstreamCommit: '7f410a3793c5bba8eb198e962ce7a3d6095f9d89',
            assetName: 'sd-master-7f410a3-bin-Linux-Ubuntu-24.04-x86_64.zip',
            url: 'https://github.com/leejet/stable-diffusion.cpp/releases/download/master-859-7f410a3/sd-master-7f410a3-bin-Linux-Ubuntu-24.04-x86_64.zip',
            size: 33224779,
            sha256: '3f3e1a6b57a2e4d184aa9ea9ab916272ea92b4b79d5af667cad89d0a3edc2bc7',
        },
        vulkan: {
            backend: 'vulkan',
            release: 'master-859-7f410a3',
            upstreamCommit: '7f410a3793c5bba8eb198e962ce7a3d6095f9d89',
            assetName: 'sd-master-7f410a3-bin-Linux-Ubuntu-24.04-x86_64-vulkan.zip',
            url: 'https://github.com/leejet/stable-diffusion.cpp/releases/download/master-859-7f410a3/sd-master-7f410a3-bin-Linux-Ubuntu-24.04-x86_64-vulkan.zip',
            size: 46348071,
            sha256: '3f10e3b00fc6574d014044e40c23db33d99d115e7c2ecf6ce8733fcc5287a743',
        },
        rocm: {
            backend: 'rocm',
            release: 'master-859-7f410a3',
            upstreamCommit: '7f410a3793c5bba8eb198e962ce7a3d6095f9d89',
            assetName: 'sd-master-7f410a3-bin-Linux-Ubuntu-24.04-x86_64-rocm-7.14.0.zip',
            url: 'https://github.com/leejet/stable-diffusion.cpp/releases/download/master-859-7f410a3/sd-master-7f410a3-bin-Linux-Ubuntu-24.04-x86_64-rocm-7.14.0.zip',
            size: 264527387,
            sha256: '4a2d142ae4c594a49016188807702d5bd8b5129e3274658f6797f18d029730b8',
        },
    },
    'win32-x64': {
        cpu: {
            backend: 'cpu',
            release: 'master-859-7f410a3',
            upstreamCommit: '7f410a3793c5bba8eb198e962ce7a3d6095f9d89',
            assetName: 'sd-master-7f410a3-bin-win-cpu-x64.zip',
            url: 'https://github.com/leejet/stable-diffusion.cpp/releases/download/master-859-7f410a3/sd-master-7f410a3-bin-win-cpu-x64.zip',
            size: 24207083,
            sha256: '38c58cd603e39f91a63fb4c854db4af19c6a15b642d3982ab3c5b336b05c1855',
        },
        cuda12: {
            backend: 'cuda12',
            release: 'master-859-7f410a3',
            upstreamCommit: '7f410a3793c5bba8eb198e962ce7a3d6095f9d89',
            assetName: 'sd-master-7f410a3-bin-win-cuda12-x64.zip',
            url: 'https://github.com/leejet/stable-diffusion.cpp/releases/download/master-859-7f410a3/sd-master-7f410a3-bin-win-cuda12-x64.zip',
            size: 336517170,
            sha256: 'b97beb83f471138d63d48354e006067a9d0e52fea47f6d20b3b45a3105062eb9',
            companions: [
                {
                    assetName: 'cudart-sd-bin-win-cu12-x64.zip',
                    url: 'https://github.com/leejet/stable-diffusion.cpp/releases/download/master-859-7f410a3/cudart-sd-bin-win-cu12-x64.zip',
                    size: 563452046,
                    sha256: 'fe20366827d357c00797eebb58244dddab7fd9a348d70090c3871004c320f38d',
                    requiredFiles: [
                        'cudart64_12.dll',
                        'cublas64_12.dll',
                        'cublasLt64_12.dll',
                    ],
                },
            ],
        },
        vulkan: {
            backend: 'vulkan',
            release: 'master-859-7f410a3',
            upstreamCommit: '7f410a3793c5bba8eb198e962ce7a3d6095f9d89',
            assetName: 'sd-master-7f410a3-bin-win-vulkan-x64.zip',
            url: 'https://github.com/leejet/stable-diffusion.cpp/releases/download/master-859-7f410a3/sd-master-7f410a3-bin-win-vulkan-x64.zip',
            size: 38957132,
            sha256: '59a56c7e3e6ed87acc8c63d90116711474e9b363e75ba58b4e0448a8e4ba1f0b',
        },
        rocm: {
            backend: 'rocm',
            release: 'master-859-7f410a3',
            upstreamCommit: '7f410a3793c5bba8eb198e962ce7a3d6095f9d89',
            assetName: 'sd-master-7f410a3-bin-win-rocm-7.14.0-x64.zip',
            url: 'https://github.com/leejet/stable-diffusion.cpp/releases/download/master-859-7f410a3/sd-master-7f410a3-bin-win-rocm-7.14.0-x64.zip',
            size: 198079790,
            sha256: 'cb47efa7f59fe00688449b93df936b3e012516b9b67a4d83c756bfb79373197b',
        },
    },
    'darwin-arm64': {
        metal: {
            backend: 'metal',
            release: 'v1.0.3-binaries',
            upstreamCommit: null,
            assetName: 'sd-cli-metal-macos-arm64.zip',
            url: 'https://github.com/Anil-matcha/Open-Generative-AI/releases/download/v1.0.3-binaries/sd-cli-metal-macos-arm64.zip',
            size: 18703875,
            sha256: '197c1254468cac17a00dce9256d683be43bf20ea202d3c2915debc05c6deaac0',
        },
    },
};

const DEFAULT_BACKEND = {
    'linux-x64': 'cpu',
    'win32-x64': 'cpu',
    'darwin-arm64': 'metal',
};

const BACKEND_ALIASES = {
    auto: null,
    cpu: 'cpu',
    cuda: 'cuda12',
    cuda12: 'cuda12',
    vulkan: 'vulkan',
    rocm: 'rocm',
    metal: 'metal',
};

function resolvePinnedRuntime({ platform, arch, env = process.env } = {}) {
    const platformKey = `${platform}-${arch}`;
    const variants = RUNTIME_MANIFEST[platformKey];

    if (!variants) {
        if (platform === 'darwin') {
            throw new Error('Pinned local inference runtime supports macOS Apple Silicon only.');
        }
        throw new Error(`No pinned local inference runtime is certified for ${platformKey}.`);
    }

    const rawPreference = String(env[SD_BACKEND_ENV] || 'auto').trim().toLowerCase();
    if (!(rawPreference in BACKEND_ALIASES)) {
        throw new Error(
            `Unsupported ${SD_BACKEND_ENV}="${rawPreference}". Supported values: auto, cpu, cuda12, vulkan, rocm, metal.`
        );
    }

    const requested = BACKEND_ALIASES[rawPreference] || DEFAULT_BACKEND[platformKey];
    const selected = variants[requested];

    if (!selected) {
        throw new Error(
            `Backend "${requested}" is not certified for ${platformKey}. Available: ${Object.keys(variants).join(', ')}.`
        );
    }

    return {
        platformKey,
        requested: rawPreference,
        ...selected,
    };
}

module.exports = {
    DEFAULT_BACKEND,
    RUNTIME_MANIFEST,
    SD_BACKEND_ENV,
    resolvePinnedRuntime,
};
