const SCHEMA_KEY = "schemaVersion";

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(SCHEMA_KEY);
  if (typeof stored[SCHEMA_KEY] !== "number") {
    await chrome.storage.local.set({ [SCHEMA_KEY]: 1 });
  }
});
