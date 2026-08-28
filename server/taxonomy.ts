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
  {
    id: 'llm-serving',
    label: 'LLM inference & serving',
    category: 'AI engineering',
    aliases: ['vllm', 'inference server', 'model serving', 'triton inference', 'llm inference'],
    queries: ['LLM inference optimization', 'vLLM model serving'],
  },
  {
    id: 'cuda',
    label: 'GPU & CUDA programming',
    category: 'AI engineering',
    aliases: ['cuda', 'gpu programming', 'triton kernel', 'nvidia gpu'],
    queries: ['CUDA programming', 'GPU kernel optimization'],
  },
  {
    id: 'mlops',
    label: 'MLOps',
    category: 'AI engineering',
    aliases: ['mlops', 'ml platform', 'mlflow', 'model registry', 'feature store'],
    queries: ['MLOps', 'machine learning platform'],
  },
  {
    id: 'computer-vision',
    label: 'Computer vision',
    category: 'AI engineering',
    aliases: ['computer vision', 'opencv', 'image segmentation', 'object detection'],
    queries: ['computer vision', 'object detection deep learning'],
  },
  {
    id: 'embeddings',
    label: 'Embeddings & vector search',
    category: 'AI engineering',
    aliases: ['embeddings', 'pgvector', 'pinecone', 'weaviate', 'faiss'],
    queries: ['vector embeddings', 'vector database search'],
  },
  {
    id: 'java',
    label: 'Java',
    category: 'Languages',
    aliases: ['java', 'jvm', 'spring boot'],
    queries: ['Java developer', 'Spring Boot'],
  },
  {
    id: 'csharp',
    label: 'C# / .NET',
    category: 'Languages',
    aliases: ['c#', 'csharp', '.net', 'dotnet', 'asp.net'],
    queries: ['C# .NET developer', 'ASP.NET Core'],
  },
  {
    id: 'cpp',
    label: 'C++',
    category: 'Languages',
    aliases: ['c++', 'cpp'],
    queries: ['C++ programming', 'modern C++'],
  },
  {
    id: 'kotlin',
    label: 'Kotlin',
    category: 'Languages',
    aliases: ['kotlin'],
    queries: ['Kotlin programming'],
  },
  {
    id: 'swift',
    label: 'Swift',
    category: 'Languages',
    aliases: ['swift', 'swiftui'],
    queries: ['Swift programming', 'SwiftUI'],
  },
  {
    id: 'scala',
    label: 'Scala',
    category: 'Languages',
    aliases: ['scala'],
    queries: ['Scala programming'],
  },
  {
    id: 'ruby',
    label: 'Ruby',
    category: 'Languages',
    aliases: ['ruby', 'rails', 'ruby on rails'],
    queries: ['Ruby on Rails'],
  },
  {
    id: 'php',
    label: 'PHP',
    category: 'Languages',
    aliases: ['php', 'laravel'],
    queries: ['PHP developer', 'Laravel'],
  },
  {
    id: 'elixir',
    label: 'Elixir',
    category: 'Languages',
    aliases: ['elixir', 'phoenix framework', 'erlang'],
    queries: ['Elixir programming', 'Phoenix framework'],
  },
  {
    id: 'aws',
    label: 'AWS',
    category: 'Cloud',
    aliases: ['aws', 'amazon web services', 'ec2', 'lambda'],
    queries: ['AWS cloud', 'AWS architecture'],
  },
  {
    id: 'azure',
    label: 'Azure',
    category: 'Cloud',
    aliases: ['azure', 'microsoft azure'],
    queries: ['Microsoft Azure'],
  },
  {
    id: 'gcp',
    label: 'Google Cloud',
    category: 'Cloud',
    aliases: ['gcp', 'google cloud', 'bigquery'],
    queries: ['Google Cloud Platform', 'BigQuery'],
  },
  {
    id: 'docker',
    label: 'Docker & containers',
    category: 'Platform',
    aliases: ['docker', 'containerisation', 'containerization', 'podman', 'oci image'],
    queries: ['Docker containers'],
  },
  {
    id: 'gitops',
    label: 'GitOps & CD',
    category: 'Platform',
    aliases: ['gitops', 'argocd', 'argo cd', 'flux cd', 'continuous delivery'],
    queries: ['GitOps ArgoCD', 'continuous delivery pipeline'],
  },
  {
    id: 'observability',
    label: 'Observability & OpenTelemetry',
    category: 'Platform',
    aliases: ['observability', 'opentelemetry', 'otel', 'prometheus', 'grafana', 'distributed tracing'],
    queries: ['OpenTelemetry', 'observability engineering'],
  },
  {
    id: 'sre',
    label: 'Site reliability engineering',
    category: 'Platform',
    aliases: ['sre', 'site reliability', 'incident response', 'error budget'],
    queries: ['site reliability engineering'],
  },
  {
    id: 'service-mesh',
    label: 'Service mesh',
    category: 'Platform',
    aliases: ['service mesh', 'istio', 'linkerd', 'envoy proxy'],
    queries: ['service mesh Istio'],
  },
  {
    id: 'spark',
    label: 'Apache Spark',
    category: 'Data',
    aliases: ['spark', 'pyspark', 'databricks'],
    queries: ['Apache Spark', 'PySpark'],
  },
  {
    id: 'snowflake',
    label: 'Snowflake',
    category: 'Data',
    aliases: ['snowflake'],
    queries: ['Snowflake data warehouse'],
  },
  {
    id: 'clickhouse',
    label: 'ClickHouse',
    category: 'Data',
    aliases: ['clickhouse'],
    queries: ['ClickHouse database'],
  },
  {
    id: 'postgres',
    label: 'PostgreSQL',
    category: 'Data',
    aliases: ['postgres', 'postgresql'],
    queries: ['PostgreSQL', 'Postgres performance'],
  },
  {
    id: 'airflow',
    label: 'Airflow & orchestration',
    category: 'Data',
    aliases: ['airflow', 'dagster', 'prefect', 'data orchestration'],
    queries: ['Apache Airflow', 'data pipeline orchestration'],
  },
  {
    id: 'elasticsearch',
    label: 'Elasticsearch',
    category: 'Data',
    aliases: ['elasticsearch', 'opensearch', 'elk stack'],
    queries: ['Elasticsearch'],
  },
  {
    id: 'redis',
    label: 'Redis & caching',
    category: 'Data',
    aliases: ['redis', 'valkey', 'memcached'],
    queries: ['Redis caching'],
  },
  {
    id: 'react',
    label: 'React',
    category: 'Web',
    aliases: ['react', 'reactjs', 'next.js', 'nextjs'],
    queries: ['React development', 'Next.js'],
  },
  {
    id: 'vue',
    label: 'Vue & Svelte',
    category: 'Web',
    aliases: ['vue', 'vuejs', 'nuxt', 'svelte', 'sveltekit'],
    queries: ['Vue.js', 'Svelte'],
  },
  {
    id: 'graphql',
    label: 'GraphQL',
    category: 'Web',
    aliases: ['graphql', 'apollo server'],
    queries: ['GraphQL API'],
  },
  {
    id: 'accessibility',
    label: 'Web accessibility',
    category: 'Web',
    aliases: ['accessibility', 'a11y', 'wcag', 'screen reader'],
    queries: ['web accessibility WCAG'],
  },
  {
    id: 'ios',
    label: 'iOS development',
    category: 'Mobile',
    aliases: ['ios', 'iphone app', 'xcode', 'uikit'],
    queries: ['iOS development Swift'],
  },
  {
    id: 'android',
    label: 'Android development',
    category: 'Mobile',
    aliases: ['android', 'jetpack compose'],
    queries: ['Android development Kotlin'],
  },
  {
    id: 'cross-platform-mobile',
    label: 'React Native & Flutter',
    category: 'Mobile',
    aliases: ['react native', 'flutter', 'expo'],
    queries: ['React Native', 'Flutter development'],
  },
  {
    id: 'cloud-security',
    label: 'Cloud security',
    category: 'Security',
    aliases: ['cloud security', 'cspm', 'iam policy', 'security posture'],
    queries: ['cloud security architecture'],
  },
  {
    id: 'appsec',
    label: 'Application security',
    category: 'Security',
    aliases: ['appsec', 'application security', 'penetration testing', 'threat modelling', 'threat modeling'],
    queries: ['application security', 'threat modeling'],
  },
  {
    id: 'detection-eng',
    label: 'Detection engineering',
    category: 'Security',
    aliases: ['detection engineering', 'siem', 'soc analyst', 'threat detection'],
    queries: ['detection engineering SIEM'],
  },
];

export const CATEGORIES = [...new Set(SKILLS.map((s) => s.category))];

/**
 * Terms that are ordinary English words as well as technology names.
 *
 * "Ready to go now", "react to incidents", "spark innovation" and "swift response"
 * all appear constantly in job adverts, and matching them case-insensitively
 * inflates those skills with prose. These are required to appear capitalised, the
 * way a product name is written. That undercounts the occasional lowercase
 * mention, which is the safe direction: a missed count is a gap, an invented one
 * is a fabricated trend.
 */
const AMBIGUOUS = new Set(['go', 'react', 'rust', 'swift', 'spark', 'flutter', 'azure', 'expo', 'prefect', 'beam']);

/**
 * Word-boundary matching that survives `+` and `#`.
 *
 * \b is useless next to those characters — it is defined on word characters, so
 * /\bc\+\+\b/ never fires on "C++". Lookarounds on the punctuation that can be
 * part of a technology name do the job instead.
 */
function needleRegex(needle: string, caseSensitive: boolean): RegExp {
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\w#+.])${esc}(?![\\w#+.])`, caseSensitive ? '' : 'i');
}

interface Needle { re: RegExp; caseSensitive: boolean }

const INDEX: { skill: Skill; needles: Needle[] }[] = SKILLS.map((skill) => ({
  skill,
  needles: [skill.label, ...skill.aliases].map((n) => {
    const caseSensitive = AMBIGUOUS.has(n.toLowerCase());
    // Aliases are stored lowercase, so an ambiguous one has to be capitalised
    // before it can be matched case-sensitively — otherwise the rule inverts and
    // catches exactly the prose it was written to exclude.
    const pattern = caseSensitive ? n.replace(/\b\w/g, (c) => c.toUpperCase()) : n.toLowerCase();
    return { re: needleRegex(pattern, caseSensitive), caseSensitive };
  }),
}));

/**
 * Which of our skills does this free text mention?
 *
 * Slashes are separators, not characters: "C/C++", "Go/Golang" and "React/Vue" are
 * how stacks are actually written in job adverts, and treating the slash as part of
 * the token made every one of those a miss.
 */
export function skillsMentionedIn(text: string): string[] {
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/[\/,;:()\[\]|]/g, ' ').replace(/\s+/g, ' ');
  const lower = clean.toLowerCase();
  const found: string[] = [];
  for (const { skill, needles } of INDEX) {
    if (needles.some((n) => n.re.test(n.caseSensitive ? clean : lower))) found.push(skill.id);
  }
  return found;
}

export function getSkill(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}
