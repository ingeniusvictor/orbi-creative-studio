const fs = require('node:fs');

const path = 'components/StandaloneShell.js';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first === -1) throw new Error(`${label}: expected source fragment not found`);
  if (source.indexOf(before, first + before.length) !== -1) {
    throw new Error(`${label}: source fragment is not unique`);
  }
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  'credential import',
  "import { getCommonCopy, getLocaleConfig, localizeStudioPath } from '@/lib/locales';\n",
  "import { getCommonCopy, getLocaleConfig, localizeStudioPath } from '@/lib/locales';\nimport { clearMuapiKey, clearMuapiKeyCookie, getMuapiKey, setMuapiKey, syncMuapiKeyCookie } from '@/src/lib/providerCredentials.mjs';\n",
);

replaceOnce(
  'legacy storage constant',
  "const STORAGE_KEY = 'muapi_key';\n",
  '',
);

replaceOnce(
  'mount credential read',
  `    const stored = localStorage.getItem(STORAGE_KEY);\n    if (stored) {\n      setApiKey(stored);\n      fetchBalance(stored);\n      // Sync cookie immediately on mount to establish identity for background requests\n      document.cookie = \`muapi_key=\${stored}; path=/; max-age=31536000; SameSite=Lax\`;\n    }`,
  `    const stored = getMuapiKey();\n    if (stored) {\n      setApiKey(stored);\n      fetchBalance(stored);\n      // Sync the compatibility cookie through the provider credential boundary.\n      syncMuapiKeyCookie(stored);\n    }`,
);

replaceOnce(
  'credential save',
  `  const handleKeySave = useCallback((key) => {\n    localStorage.setItem(STORAGE_KEY, key);\n    setApiKey(key);\n    fetchBalance(key);\n    document.cookie = \`muapi_key=\${key}; path=/; max-age=31536000; SameSite=Lax\`;\n  }, [fetchBalance]);`,
  `  const handleKeySave = useCallback((key) => {\n    const storedKey = setMuapiKey(key);\n    setApiKey(storedKey);\n    fetchBalance(storedKey);\n    syncMuapiKeyCookie(storedKey);\n  }, [fetchBalance]);`,
);

replaceOnce(
  'credential clear',
  `  const handleKeyChange = useCallback(() => {\n    localStorage.removeItem(STORAGE_KEY);\n    setApiKey(null);\n    setBalance(null);\n    document.cookie = \"muapi_key=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT\";\n  }, []);`,
  `  const handleKeyChange = useCallback(() => {\n    clearMuapiKey();\n    clearMuapiKeyCookie();\n    setApiKey(null);\n    setBalance(null);\n  }, []);`,
);

fs.writeFileSync(path, source);
console.log('StandaloneShell provider credential migration applied successfully.');
