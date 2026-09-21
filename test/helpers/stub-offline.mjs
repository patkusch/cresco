// Offline stand-in for a machine with no network: every request fails, so every
// live collector reports nothing and only the bundled fixtures come back.
globalThis.fetch = async () => ({ ok: false });
