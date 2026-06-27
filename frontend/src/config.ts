import dayjs from "dayjs";

export const ACCENT = '#4F46E5';
/* ---------------- 静态配置 ---------------- */
export const FRAMEWORKS = [
  { key: 'CLAUDE_CODE', name: 'Claude Code', enabled: true },
  { key: 'OPENCLAW', name: 'OpenClaw', enabled: true },
  { key: 'CUSTOM', name: 'Custom', enabled: false, tip: 'coming soon' },
  { key: 'HERMES', name: 'Hermes', enabled: false },
];
export const PROVIDERS = [
  { label: 'Anthropic', options: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'].map(v => ({ value: v, label: v })) },
  { label: 'OpenAI', options: ['gpt-5.5', 'gpt-5.5-pro', 'gpt-5.4-mini'].map(v => ({ value: v, label: v })) },
  { label: 'DashScope（阿里云百炼）', options: ['qwen3.6-max-preview', 'qwen3.6-plus', 'qwen3.6-flash', 'qwen3.6-27b', 'qwen3.6-35b-a3b'].map(v => ({ value: v, label: v })) },
  { label: 'AISpace-伏渊（自研）', options: ['yufeng-vl', 'yufeng-plus'].map(v => ({ value: v, label: v })) },
];
export const MODEL_PARAMS = [
  { key: 'temperature', label: 'Temperature', type: 'slider', min: 0, max: 1, step: 0.1 },
  { key: 'max_tokens', label: 'Max Tokens', type: 'number', min: 256, max: 32000 },
];
export const TOOLS = [
  { id: 't1', name: 'web_search', desc: '联网搜索', cat: '系统工具', mcp: 'system', ver: 'v1.2', locked: false },
  { id: 't2', name: 'code_runner', desc: '代码执行沙箱', cat: '系统工具', mcp: 'system', ver: 'v2.0', locked: false },
  { id: 't3', name: 'file_read', desc: '读取文件', cat: '系统工具', mcp: 'system', ver: 'v1.0', locked: false },
  { id: 't4', name: 'jira_connector', desc: 'Jira 工单读写', cat: '自定义工具', mcp: 'jira-mcp', ver: 'v0.9', locked: true },
  { id: 't5', name: 'sap_invoice', desc: 'SAP 发票查询', cat: '自定义工具', mcp: 'sap-mcp', ver: 'v0.3', locked: true },
  { id: 't6', name: 'crm_lookup', desc: '客户信息检索', cat: '自定义工具', mcp: 'crm-mcp', ver: 'v1.1', locked: false },
];
export const SKILLS = [
  { id: 's1', name: '需求分析', desc: '把对话转成结构化 spec', cat: '产品', locked: false },
  { id: 's2', name: '数据透视', desc: '表格数据分析与图表', cat: '数据', locked: false },
  { id: 's3', name: '合同审查', desc: '法务条款风险识别', cat: '法务', locked: true },
  { id: 's4', name: 'PPT 生成', desc: '生成演示稿', cat: '办公', locked: false },
  { id: 's5', name: '财务建模', desc: '财务测算模型', cat: '财务', locked: true },
];
export const TEMPLATES = {
  CLAUDE_CODE: { 'claude.md': `# <Agent 名称>\n\n## 角色\n你是 <一句话定义身份与专长>。\n\n## 目标\n- <核心目标 1>\n- <核心目标 2>\n\n## 工作方式\n- <方法论或步骤>\n- <何时调用工具/技能>\n\n## 约束与边界\n- <不做什么、红线>\n\n## 输出风格\n- <语气、格式、长度偏好>\n` },
  OPENCLAW: {
    'role.md': `# 角色\n\n## 身份\n你是 <身份 / 职业 / 专长>。\n\n## 性格与语气\n<性格特质、说话风格>\n\n## 立场与原则\n<价值观与原则>\n`,
    'agent.md': `# 行为\n\n## 核心能力\n- <能力 1>\n- <能力 2>\n\n## 工作流程\n1. <第一步>\n2. <后续步骤>\n\n## 工具与技能使用\n- <场景与调用>\n\n## 约束\n- <能力边界>\n`,
    'user.md': `# 用户上下文\n\n## 使用者\n<服务对象是谁>\n\n## 偏好\n- <语言、格式、详略>\n\n## 背景信息\n<业务 / 项目背景>\n`,
  },
};
export const fwName = k => (FRAMEWORKS.find(f => f.key === k) || {}).name || k;

/* 运行环境（隔离级别）——用意图语言，L 级别仅作小标 */
// 隔离是**嵌套**的：L0 每用户沙箱 = 租户边界（每用户一个、跨用户绝不共享、始终生效，不是可选项）；
// 在你自己的沙箱「里面」再选 agent 怎么放 —— 这才是可选的「部署方式」：L1 共享 / L2 独立 / L3 即用即弃。
// 所有部署方式都在**你自己的租户内**，没有团队/跨用户共享。detail 供部署弹窗完整说明。
export const TENANT_NOTE = 'L0 租户隔离：每个用户一个专属沙箱、跨用户绝不共享 —— 始终生效。下面的部署方式都是「在你这个沙箱里面」怎么放 agent。';
export const ISOLATIONS = [
  { key: 'L1', name: '共享', tag: 'L1', hint: '你名下多个 Agent 共用一个沙箱，最省（库依赖仍隔离）', suit: '默认，多数 Agent',
    detail: '在你的租户沙箱里，你名下多个 Agent 共用一个运行沙箱（默认）。\n· 适用：多数 Agent\n· 隔离：各 Agent 的库依赖隔离（venv / node_modules），但彼此的故障 / 资源不隔离——同沙箱一个崩可能波及其他\n· 成本与启动：最省，本地按需起进程' },
  { key: 'L2', name: '独立', tag: 'L2', hint: '你名下每个 Agent 独占一个沙箱：崩溃 / 资源 / 被攻破都不波及别人', suit: '重要 Agent、强隔离',
    detail: '在你的租户内，每个 Agent 独占一个沙箱 / 容器。\n· 适用：重要 Agent、需强隔离、有系统级特殊依赖\n· 隔离：崩溃 / 资源占满 / 被攻破都不波及你名下其他 Agent；可装 L1 搞不定的系统级依赖\n· 成本与启动：较贵，需预热 + 空闲回收（云端独立沙箱）' },
  { key: 'L3', name: '即用即弃', tag: 'L3', hint: '每次会话起一个临时沙箱、跑完即焚，隔离最强', suit: '跑不可信代码',
    detail: '每次会话开一个全新的临时沙箱、跑完即销毁。\n· 适用：跑不可信 / 任意代码，需最强隔离\n· 隔离：会话之间互不影响；长期记忆须外置（跑完即焚）\n· 成本与启动：按会话起销，有冷启动开销' },
];
const _ISO_NAME = { L0: '租户边界', L1: '共享', L2: '独立', L3: '即用即弃' };
export const isoName = k => _ISO_NAME[k] || k;

/* ---------------- 初始 mock 数据 ---------------- */
export const INIT_WORKSPACES = [
  { id: 'w1', name: '我的工作空间', members: [{ id: 'u0', name: 'Helena（我）', role: 'owner' }, { id: 'u1', name: '张工', role: 'member' }] },
  { id: 'w2', name: '智能客服项目', members: [{ id: 'u0', name: 'Helena（我）', role: 'member' }, { id: 'u2', name: '李产品', role: 'owner' }, { id: 'u3', name: '王全栈', role: 'owner' }] },
];
export const td = d => dayjs().subtract(d, 'day').format('YYYY-MM-DD HH:mm');
export const now = () => dayjs().format('YYYY-MM-DD HH:mm');
export function mkAgent(id, wsId, snaps, times) {
  const versions = snaps.map((s, i) => ({ version: i + 1, createdAt: times[i], config: s }));
  const cur = snaps[snaps.length - 1];
  return { id, wsId, version: versions.length, updatedAt: times[times.length - 1], deleted: false, ...cur, versions };
}
export const INIT_AGENTS = [
  mkAgent('a1', 'w1', [
    { name: '需求分析助手', desc: '把用户对话整理成需求', framework: 'CLAUDE_CODE', model: 'claude-haiku-4-5', params: { temperature: 0.7, max_tokens: 4096 }, tools: ['t1'], skills: ['s1'],
      files: { 'claude.md': '# 需求分析助手\n\n## 角色\n你是需求分析助手。\n\n## 目标\n- 把对话整理成需求\n' } },
    { name: '需求分析助手', desc: '把用户对话整理成结构化需求', framework: 'CLAUDE_CODE', model: 'claude-sonnet-4-6', params: { temperature: 0.5, max_tokens: 4096 }, tools: ['t1', 't3'], skills: ['s1'],
      files: { 'claude.md': '# 需求分析助手\n\n## 角色\n你是资深需求分析助手，擅长澄清模糊需求。\n\n## 目标\n- 把对话整理成结构化 spec\n- 主动追问边界与异常\n\n## 输出风格\n- 用 EARS 句式描述验收条件\n' } },
  ], [td(6), td(1)]),
  mkAgent('a2', 'w1', [
    { name: '数据洞察 Bot', desc: '业务数据分析与可视化', framework: 'OPENCLAW', model: 'qwen3.6-plus', params: { temperature: 0.7, max_tokens: 8192 }, tools: ['t2'], skills: ['s2', 's4'], files: { ...TEMPLATES.OPENCLAW } },
  ], [td(4)]),
  mkAgent('a3', 'w2', [
    { name: '客服一线应答', desc: '客服自动应答', framework: 'CLAUDE_CODE', model: 'claude-haiku-4-5', params: { temperature: 0.7, max_tokens: 2048 }, tools: ['t1'], skills: [],
      files: { 'claude.md': '# 客服应答\n\n## 角色\n你是客服。\n' } },
    { name: '客服一线应答', desc: '客服场景自动应答', framework: 'CLAUDE_CODE', model: 'yufeng-vl', params: { temperature: 0.6, max_tokens: 4096 }, tools: ['t1', 't6'], skills: ['s1'],
      files: { 'claude.md': '# 客服应答\n\n## 角色\n你是耐心专业的一线客服。\n\n## 约束\n- 不承诺无法兑现的服务\n' } },
    { name: '客服一线应答', desc: '客服场景自动应答', framework: 'CLAUDE_CODE', model: 'yufeng-vl', params: { temperature: 0.6, max_tokens: 4096 }, tools: ['t1', 't6'], skills: ['s1'],
      files: { 'claude.md': '# 客服应答\n\n## 角色\n你是耐心专业的一线客服，优先安抚情绪再解决问题。\n\n## 约束\n- 不承诺无法兑现的服务\n- 涉及退款一律转人工\n' } },
  ], [td(10), td(3), td(0)]),
];

/* ---------------- 通用小组件 ---------------- */
