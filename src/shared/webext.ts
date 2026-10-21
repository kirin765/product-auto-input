// Firefox exposes promise-based APIs through browser; Chrome uses chrome.
const extensionGlobal = globalThis as unknown as { browser?: unknown; chrome?: unknown };
if (extensionGlobal.browser) extensionGlobal.chrome = extensionGlobal.browser;

export {};
