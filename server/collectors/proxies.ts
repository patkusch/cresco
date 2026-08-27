/**
 * Leading-indicator proxies per skill.
 *
 * Job postings are where demand *arrives*. These are the things that move
 * earlier in the chain — package adoption and public attention — and the whole
 * point of `npm run leadlag` is to find out whether they actually lead hiring,
 * and by how long, rather than assuming they do.
 *
 * Coverage is deliberately honest and partial. Kubernetes is not an npm package
 * in any meaningful sense, "platform engineering" has no registry footprint at
 * all, and inventing a proxy to fill the table would be worse than a blank.
 * A skill with no proxy simply keeps its lagging signal only.
 */
export interface Proxy {
  /** npm package names — real adoption, millions of events, daily history. */
  npm?: string[];
  /** English Wikipedia article titles — public attention, monthly back to 2015. */
  wikipedia?: string[];
  /** PyPI packages. History is only ~180 days, so these inform levels, not lag. */
  pypi?: string[];
}

export const PROXIES: Record<string, Proxy> = {
  'ai-agents':        { npm: ['langchain', '@langchain/langgraph'], wikipedia: ['Intelligent_agent'], pypi: ['langchain', 'crewai'] },
  'llm-apps':         { npm: ['openai', '@anthropic-ai/sdk'], wikipedia: ['Large_language_model'], pypi: ['openai', 'anthropic'] },
  'rag':              { npm: ['llamaindex', 'chromadb'], wikipedia: ['Retrieval-augmented_generation'], pypi: ['llama-index', 'chromadb'] },
  'mcp':              { npm: ['@modelcontextprotocol/sdk'], pypi: ['mcp'] },
  'evals':            { npm: ['langsmith'], pypi: ['deepeval', 'ragas'] },
  'finetuning':       { wikipedia: ['Fine-tuning_(deep_learning)'], pypi: ['peft', 'trl'] },
  'ai-safety':        { wikipedia: ['AI_safety'] },
  'rust':             { wikipedia: ['Rust_(programming_language)'] },
  'go':               { wikipedia: ['Go_(programming_language)'] },
  'typescript':       { npm: ['typescript'], wikipedia: ['TypeScript'] },
  'python':           { wikipedia: ['Python_(programming_language)'] },
  'kubernetes':       { npm: ['@kubernetes/client-node'], wikipedia: ['Kubernetes'] },
  'terraform':        { wikipedia: ['Terraform_(software)'] },
  'platform-eng':     { wikipedia: ['Platform_engineering'] },
  'wasm':             { npm: ['@wasmer/sdk'], wikipedia: ['WebAssembly'] },
  'ebpf':             { wikipedia: ['EBPF'] },
  'duckdb':           { npm: ['duckdb'], wikipedia: ['DuckDB'], pypi: ['duckdb'] },
  'iceberg':          { wikipedia: ['Apache_Iceberg'], pypi: ['pyiceberg'] },
  'dbt':              { pypi: ['dbt-core'] },
  'streaming':        { npm: ['kafkajs'], wikipedia: ['Apache_Kafka'] },
  'supply-chain-sec': { wikipedia: ['Supply_chain_attack'] },
  'post-quantum':     { wikipedia: ['Post-quantum_cryptography'] },
  'zero-trust':       { wikipedia: ['Zero_trust_architecture'] },
  'rsc':              { npm: ['react-server-dom-webpack'] },
  'edge':             { npm: ['wrangler'], wikipedia: ['Multi-access_edge_computing'] },
};
