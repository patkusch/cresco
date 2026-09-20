// Offline stand-in for hn.algolia.com, preloaded with `node --import` by the
// backfill tests. Twelve monthly threads, each with three job posts, and a fixed
// story count for every search. Nothing here touches the network.
const stories = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 7 - i, 1, 15));
  return {
    objectID: String(1000 + i),
    title: `Ask HN: Who is hiring? (${d.toISOString().slice(0, 7)})`,
    created_at: d.toISOString().replace('.000Z', 'Z'),
    created_at_i: Math.floor(d.getTime() / 1000),
  };
});

const json = (body) => ({ ok: true, json: async () => body });

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('search_by_date')) return json({ hits: stories });
  if (u.includes('/items/')) {
    return json({ children: [{ text: 'Acme | Python, Kubernetes, React' }, { text: 'Foo | Rust and Go' }, { text: 'Bar | TypeScript' }] });
  }
  if (u.includes('/search?')) return json({ nbHits: 5 });
  return { ok: false };
};
