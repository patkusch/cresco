import type { Skill } from './types.ts';

/**
 * The seed vocabulary. Deliberately small and opinionated: a radar that
 * tracks 400 skills tracks none of them well. Aliases matter more than
 * the list length — "LLM apps", "GenAI engineering" and "AI engineering"
 * are one skill, and counting them separately is how these systems lie.
 */
export const SKILLS: Skill[] = [
  {
    id: 'ai-agents',
    label: 'AI agents & orchestration',
    category: 'AI engineering',
    aliases: ['agentic', 'ai agent', 'multi-agent', 'agent framework', 'autonomous agents'],
    queries: ['AI agents', 'agentic workflows', 'multi-agent systems'],
  },
  {
    id: 'llm-apps',
    label: 'LLM application engineering',
    category: 'AI engineering',
    aliases: ['llm app', 'genai engineer', 'ai engineer', 'llm engineering'],
    queries: ['LLM application development', 'AI engineer', 'building with LLMs'],
  },
  {
    id: 'rag',
    label: 'Retrieval-augmented generation',
    category: 'AI engineering',
    aliases: ['rag', 'retrieval augmented', 'vector search', 'semantic search'],
    queries: ['retrieval augmented generation', 'RAG pipeline', 'vector database'],
  },
  {
    id: 'mcp',
    label: 'Model Context Protocol',
    category: 'AI engineering',
    aliases: ['mcp', 'model context protocol', 'mcp server'],
    queries: ['Model Context Protocol', 'MCP server'],
  },
  {
    id: 'evals',
    label: 'LLM evals & observability',
    category: 'AI engineering',
    aliases: ['llm eval', 'model evaluation', 'llm observability', 'guardrails'],
    queries: ['LLM evaluation', 'LLM observability', 'model evals'],
  },
  {
    id: 'finetuning',
    label: 'Fine-tuning & model adaptation',
    category: 'AI engineering',
    aliases: ['fine-tuning', 'lora', 'peft', 'distillation'],
    queries: ['fine-tuning LLM', 'LoRA fine tuning', 'model distillation'],
  },
  {
    id: 'ai-safety',
    label: 'AI safety & governance',
    category: 'AI engineering',
    aliases: ['ai safety', 'ai governance', 'responsible ai', 'ai risk', 'eu ai act'],
    queries: ['AI governance', 'AI safety engineering', 'EU AI Act compliance'],
  },
  {
    id: 'rust',
    label: 'Rust',
    category: 'Languages',
    aliases: ['rust', 'rustlang'],
    queries: ['Rust programming', 'Rust developer'],
  },
  {
    id: 'go',
    label: 'Go',
    category: 'Languages',
    aliases: ['golang', 'go developer'],
    queries: ['Go programming', 'Golang developer'],
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    category: 'Languages',
    aliases: ['typescript', 'ts'],
    queries: ['TypeScript', 'TypeScript developer'],
  },
  {
    id: 'python',
    label: 'Python',
    category: 'Languages',
    aliases: ['python', 'py'],
    queries: ['Python developer', 'Python programming'],
  },
  {
    id: 'kubernetes',
    label: 'Kubernetes',
    category: 'Platform',
    aliases: ['kubernetes', 'k8s', 'eks', 'aks'],
    queries: ['Kubernetes', 'Kubernetes operator'],
  },
  {
    id: 'terraform',
    label: 'Terraform & IaC',
    category: 'Platform',
    aliases: ['terraform', 'infrastructure as code', 'opentofu', 'pulumi'],
    queries: ['Terraform', 'infrastructure as code'],
  },
  {
    id: 'platform-eng',
    label: 'Platform engineering',
    category: 'Platform',
    aliases: ['platform engineering', 'internal developer platform', 'idp', 'devex'],
    queries: ['platform engineering', 'internal developer platform'],
  },
  {
    id: 'wasm',
    label: 'WebAssembly',
    category: 'Platform',
    aliases: ['webassembly', 'wasm', 'wasi'],
    queries: ['WebAssembly', 'WASM runtime'],
  },
  {
    id: 'ebpf',
    label: 'eBPF',
    category: 'Platform',
    aliases: ['ebpf', 'cilium'],
    queries: ['eBPF', 'eBPF observability'],
  },
  {
    id: 'duckdb',
    label: 'DuckDB & local analytics',
    category: 'Data',
    aliases: ['duckdb', 'in-process analytics'],
    queries: ['DuckDB', 'DuckDB analytics'],
  },
  {
    id: 'iceberg',
    label: 'Apache Iceberg & lakehouse',
    category: 'Data',
    aliases: ['iceberg', 'lakehouse', 'delta lake', 'open table format'],
    queries: ['Apache Iceberg', 'lakehouse architecture'],
  },
  {
    id: 'dbt',
    label: 'dbt & analytics engineering',
    category: 'Data',
    aliases: ['dbt', 'analytics engineering', 'data modelling'],
    queries: ['dbt analytics engineering', 'data modelling dbt'],
  },
  {
    id: 'streaming',
    label: 'Streaming data (Kafka/Flink)',
    category: 'Data',
    aliases: ['kafka', 'flink', 'streaming pipeline', 'event streaming'],
    queries: ['Apache Kafka', 'Apache Flink streaming'],
  },
  {
    id: 'supply-chain-sec',
    label: 'Software supply-chain security',
    category: 'Security',
    aliases: ['supply chain security', 'sbom', 'sigstore', 'slsa'],
    queries: ['software supply chain security', 'SBOM'],
  },
  {
    id: 'post-quantum',
    label: 'Post-quantum cryptography',
    category: 'Security',
    aliases: ['post-quantum', 'pqc', 'kyber', 'quantum safe'],
    queries: ['post-quantum cryptography', 'quantum safe encryption'],
  },
  {
    id: 'zero-trust',
    label: 'Zero-trust & identity',
    category: 'Security',
    aliases: ['zero trust', 'iam', 'workload identity', 'spiffe'],
    queries: ['zero trust architecture', 'workload identity'],
  },
  {
    id: 'rsc',
    label: 'React Server Components',
    category: 'Web',
    aliases: ['react server components', 'rsc', 'next app router'],
    queries: ['React Server Components', 'Next.js app router'],
  },
  {
    id: 'edge',
    label: 'Edge compute',
    category: 'Web',
    aliases: ['edge functions', 'edge compute', 'cloudflare workers'],
    queries: ['edge computing', 'Cloudflare Workers'],
  },
];

export const CATEGORIES = [...new Set(SKILLS.map((s) => s.category))];

const INDEX: { skill: Skill; needles: string[] }[] = SKILLS.map((skill) => ({
  skill,
  needles: [skill.label, ...skill.aliases].map((n) => n.toLowerCase()),
}));

/** Which of our skills does this free text mention? Used for Who's-Hiring style corpora. */
export function skillsMentionedIn(text: string): string[] {
  const hay = ` ${text.toLowerCase().replace(/[^a-z0-9+#./ -]/g, ' ')} `;
  const found: string[] = [];
  for (const { skill, needles } of INDEX) {
    if (needles.some((n) => hay.includes(` ${n} `) || hay.includes(` ${n},`) || hay.includes(` ${n}.`))) {
      found.push(skill.id);
    }
  }
  return found;
}

export function getSkill(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}
