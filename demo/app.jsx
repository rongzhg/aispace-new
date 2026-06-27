/* AISpace · Agent 管理平台 Demo
   覆盖 Spec A/B/C/J/H + 调试(I)。纯前端 mock，无后端。
   风格：浅色高级 SaaS（Linear/Vercel）。React 18 + Ant Design 5（CDN UMD）。 */

const { useState, useMemo } = React;
const {
  ConfigProvider, App: AntApp, Layout, Menu, Button, Table, Input, Select, Card, Tabs,
  Drawer, Checkbox, Tag, Collapse, Descriptions, Modal, Tooltip, Avatar, Dropdown,
  Slider, InputNumber, Popconfirm, Popover, Space, Typography, Empty, Segmented, Divider, theme,
} = antd;
const {
  PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined, SearchOutlined, AppstoreOutlined,
  UserOutlined, TeamOutlined, SendOutlined, ReloadOutlined, ArrowLeftOutlined, DownOutlined,
  RobotOutlined, ToolOutlined, BulbOutlined, CheckOutlined, MessageOutlined, FileTextOutlined,
  SettingOutlined, CloseOutlined, ThunderboltOutlined, SwapOutlined, BranchesOutlined,
} = icons;
const { Sider, Content } = Layout;
const { Text } = Typography;

const ACCENT = '#4F46E5';

// ---- 后端接入：探活成功走真实 API，否则回退内存 mock ----
const API_BASE = 'http://localhost:8000';
let API_ON = false;
async function apiCall(path, opts = {}) {
  const r = await fetch(API_BASE + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

/* ---------------- 静态配置 ---------------- */
const FRAMEWORKS = [
  { key: 'CLAUDE_CODE', name: 'Claude Code', enabled: true },
  { key: 'OPENCLAW', name: 'OpenClaw', enabled: true },
  { key: 'CUSTOM', name: 'Custom', enabled: false, tip: 'coming soon' },
  { key: 'HERMES', name: 'Hermes', enabled: false },
];
const PROVIDERS = [
  { label: 'Anthropic', options: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'].map(v => ({ value: v, label: v })) },
  { label: 'OpenAI', options: ['gpt-5.5', 'gpt-5.5-pro', 'gpt-5.4-mini'].map(v => ({ value: v, label: v })) },
  { label: 'DashScope（阿里云百炼）', options: ['qwen3.7', 'qwen3-vl-plus'].map(v => ({ value: v, label: v })) },
  { label: 'AISpace-伏渊（自研）', options: ['yufeng-vl', 'yufeng-plus'].map(v => ({ value: v, label: v })) },
];
const MODEL_PARAMS = [
  { key: 'temperature', label: 'Temperature', type: 'slider', min: 0, max: 1, step: 0.1 },
  { key: 'max_tokens', label: 'Max Tokens', type: 'number', min: 256, max: 32000 },
];
const TOOLS = [
  { id: 't1', name: 'web_search', desc: '联网搜索', cat: '系统工具', mcp: 'system', ver: 'v1.2', locked: false },
  { id: 't2', name: 'code_runner', desc: '代码执行沙箱', cat: '系统工具', mcp: 'system', ver: 'v2.0', locked: false },
  { id: 't3', name: 'file_read', desc: '读取文件', cat: '系统工具', mcp: 'system', ver: 'v1.0', locked: false },
  { id: 't4', name: 'jira_connector', desc: 'Jira 工单读写', cat: '自定义工具', mcp: 'jira-mcp', ver: 'v0.9', locked: true },
  { id: 't5', name: 'sap_invoice', desc: 'SAP 发票查询', cat: '自定义工具', mcp: 'sap-mcp', ver: 'v0.3', locked: true },
  { id: 't6', name: 'crm_lookup', desc: '客户信息检索', cat: '自定义工具', mcp: 'crm-mcp', ver: 'v1.1', locked: false },
];
const SKILLS = [
  { id: 's1', name: '需求分析', desc: '把对话转成结构化 spec', cat: '产品', locked: false },
  { id: 's2', name: '数据透视', desc: '表格数据分析与图表', cat: '数据', locked: false },
  { id: 's3', name: '合同审查', desc: '法务条款风险识别', cat: '法务', locked: true },
  { id: 's4', name: 'PPT 生成', desc: '生成演示稿', cat: '办公', locked: false },
  { id: 's5', name: '财务建模', desc: '财务测算模型', cat: '财务', locked: true },
];
const TEMPLATES = {
  CLAUDE_CODE: { 'claude.md': `# <Agent 名称>\n\n## 角色\n你是 <一句话定义身份与专长>。\n\n## 目标\n- <核心目标 1>\n- <核心目标 2>\n\n## 工作方式\n- <方法论或步骤>\n- <何时调用工具/技能>\n\n## 约束与边界\n- <不做什么、红线>\n\n## 输出风格\n- <语气、格式、长度偏好>\n` },
  OPENCLAW: {
    'role.md': `# 角色\n\n## 身份\n你是 <身份 / 职业 / 专长>。\n\n## 性格与语气\n<性格特质、说话风格>\n\n## 立场与原则\n<价值观与原则>\n`,
    'agent.md': `# 行为\n\n## 核心能力\n- <能力 1>\n- <能力 2>\n\n## 工作流程\n1. <第一步>\n2. <后续步骤>\n\n## 工具与技能使用\n- <场景与调用>\n\n## 约束\n- <能力边界>\n`,
    'user.md': `# 用户上下文\n\n## 使用者\n<服务对象是谁>\n\n## 偏好\n- <语言、格式、详略>\n\n## 背景信息\n<业务 / 项目背景>\n`,
  },
};
const fwName = k => (FRAMEWORKS.find(f => f.key === k) || {}).name || k;

/* 运行环境（隔离级别）——用意图语言，L 级别仅作小标 */
const ISOLATIONS = [
  { key: 'L1', name: '共享环境', tag: 'L1', hint: '和你其他 agent 共用一个沙箱，启动快、最省（各自的库依赖仍隔离）', suit: '默认，多数 agent' },
  { key: 'L2', name: '独立环境', tag: 'L2', hint: '独占一个沙箱：崩溃 / 资源占用 / 被攻破都不波及别人；需要系统级特殊依赖时也用它', suit: '重要 agent、强隔离' },
  { key: 'L3', name: '即用即弃', tag: 'L3', hint: '每次会话开一个全新沙箱、跑完即销毁，隔离最强', suit: '跑不可信代码' },
];
const isoName = k => (ISOLATIONS.find(i => i.key === k) || {}).name || k;

/* ---------------- 初始 mock 数据 ---------------- */
const INIT_WORKSPACES = [
  { id: 'w1', name: '我的工作空间', members: [{ id: 'u0', name: 'Helena（我）', role: 'owner' }, { id: 'u1', name: '张工', role: 'member' }] },
  { id: 'w2', name: '智能客服项目', members: [{ id: 'u0', name: 'Helena（我）', role: 'member' }, { id: 'u2', name: '李产品', role: 'owner' }, { id: 'u3', name: '王全栈', role: 'owner' }] },
];
let AGENT_SEQ = 100;
const td = d => dayjs().subtract(d, 'day').format('YYYY-MM-DD HH:mm');
const now = () => dayjs().format('YYYY-MM-DD HH:mm');
function mkAgent(id, wsId, snaps, times) {
  const versions = snaps.map((s, i) => ({ version: i + 1, createdAt: times[i], config: s }));
  const cur = snaps[snaps.length - 1];
  return { id, wsId, version: versions.length, updatedAt: times[times.length - 1], deleted: false, ...cur, versions };
}
const INIT_AGENTS = [
  mkAgent('a1', 'w1', [
    { name: '需求分析助手', desc: '把用户对话整理成需求', framework: 'CLAUDE_CODE', model: 'claude-haiku-4-5', params: { temperature: 0.7, max_tokens: 4096 }, tools: ['t1'], skills: ['s1'],
      files: { 'claude.md': '# 需求分析助手\n\n## 角色\n你是需求分析助手。\n\n## 目标\n- 把对话整理成需求\n' } },
    { name: '需求分析助手', desc: '把用户对话整理成结构化需求', framework: 'CLAUDE_CODE', model: 'claude-sonnet-4-6', params: { temperature: 0.5, max_tokens: 4096 }, tools: ['t1', 't3'], skills: ['s1'],
      files: { 'claude.md': '# 需求分析助手\n\n## 角色\n你是资深需求分析助手，擅长澄清模糊需求。\n\n## 目标\n- 把对话整理成结构化 spec\n- 主动追问边界与异常\n\n## 输出风格\n- 用 EARS 句式描述验收条件\n' } },
  ], [td(6), td(1)]),
  mkAgent('a2', 'w1', [
    { name: '数据洞察 Bot', desc: '业务数据分析与可视化', framework: 'OPENCLAW', model: 'qwen3.7', params: { temperature: 0.7, max_tokens: 8192 }, tools: ['t2'], skills: ['s2', 's4'], files: { ...TEMPLATES.OPENCLAW } },
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
function Section({ title, extra, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: 650, color: '#33333C', letterSpacing: 0.2 }}>{title}</Text>
        {extra}
      </div>
      {children}
    </div>
  );
}
function Field({ label, required, hint, error, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 6, fontSize: 13, color: '#5A5C6B' }}>
        {label}{required && <span style={{ color: '#E5484D', marginLeft: 3 }}>*</span>}
      </div>
      {children}
      {hint && !error && <div style={{ fontSize: 12, color: '#8A8C99', marginTop: 5 }}>{hint}</div>}
      {error && <div style={{ fontSize: 12, color: '#E5484D', marginTop: 5 }}>{error}</div>}
    </div>
  );
}
function CodeEditor({ value, onChange, rows = 12 }) {
  return (
    <Input.TextArea value={value} onChange={e => onChange(e.target.value)} autoSize={{ minRows: rows, maxRows: 22 }}
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.6, background: '#FCFCFD', color: '#2A2A33' }} />
  );
}

/* ================= 发布结果弹窗（详情/Builder 共用）================= */
function PublishChooser({ open, agentName, onCancel, onConfirm }) {
  const [iso, setIso] = useState('L1');
  return (
    <Modal title={`发布${agentName ? '「' + agentName + '」' : ''}`} open={open} onCancel={onCancel}
      okText="发布" onOk={() => onConfirm(iso)} width={520} destroyOnClose>
      <div style={{ fontSize: 13, color: '#5A5C6B', margin: '4px 0 12px' }}>选择运行环境（决定隔离强度——成本与互相影响范围）：</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ISOLATIONS.map(o => {
          const on = iso === o.key;
          return (
            <div key={o.key} onClick={() => setIso(o.key)} style={{ border: '1px solid ' + (on ? ACCENT : '#EBEBF1'), background: on ? '#F5F5FE' : '#fff', borderRadius: 8, padding: '10px 12px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', border: '4px solid ' + (on ? ACCENT : '#CDCDD6'), boxSizing: 'border-box', flexShrink: 0 }} />
                <span style={{ fontWeight: 650, fontSize: 14, color: '#17171C' }}>{o.name}</span>
                {o.key === 'L1' && <span style={pill('#F1F1F4', '#5A5C6B')}>默认</span>}
                <span style={{ marginLeft: 'auto', fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11, color: '#A6A8B4' }}>{o.tag} · {o.suit}</span>
              </div>
              <div style={{ fontSize: 12.5, color: '#5A5C6B', marginTop: 4, paddingLeft: 22 }}>{o.hint}</div>
            </div>
          );
        })}
      </div>
      {iso === 'L3' && <div style={{ marginTop: 12, color: '#946C00', background: '#FFF8E6', border: '1px solid #FCE2A0', borderRadius: 6, padding: '8px 12px', fontSize: 12.5 }}>「即用即弃」每次会话环境跑完即销毁，长期记忆需外置（持久卷 / 记忆库），否则会话结束即丢。</div>}
    </Modal>
  );
}

function PublishModal({ pub, agentName, onClose }) {
  const base = pub && pub.service_url ? pub.service_url : '';
  const curl = `curl -X POST ${base}/chat \\\n  -H "Content-Type: application/json" \\\n  -d '{"message":"你好"}'`;
  const curlStream = `curl -N -X POST ${base}/chat/stream \\\n  -H "Content-Type: application/json" \\\n  -d '{"message":"你好"}'`;
  return (
    <Modal title="已发布" open={!!pub} onCancel={onClose} footer={null} width={560}>
      {pub && (
        <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
          <p>已把 <b>{agentName}</b>（v{pub.version}{pub.isolation ? ' · ' + isoName(pub.isolation) : ''}）写入本机 Claude Code 工作目录：</p>
          <div style={{ background: '#FAFAFB', border: '1px solid #F1F1F5', borderRadius: 6, padding: '8px 12px', fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12.5, marginBottom: 12, wordBreak: 'break-all' }}>{pub.path}</div>
          {pub.service_url && (
            <div style={{ background: '#E9F7EF', border: '1px solid #Bfe6cf', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#1E8449' }}>
              ✓ 已作为服务运行：<span style={{ fontFamily: 'ui-monospace,Menlo,monospace' }}>{pub.service_url}</span>。可在 Playground 直接对话，或通过该 API 调用。
            </div>
          )}
          {pub.service_url && (
            <>
              <p style={{ margin: '0 0 6px' }}>通过 API 调用该服务（请求 <Text code style={{ fontSize: 12 }}>{'{message, session_id?}'}</Text>；多轮把返回的 <Text code style={{ fontSize: 12 }}>session_id</Text> 带回）：</p>
              <div style={{ fontSize: 12, color: '#5A5C6B', margin: '2px 0 4px' }}>① 一次性（协议1）→ <Text code style={{ fontSize: 11.5 }}>{'{reply, session_id, engine}'}</Text></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <pre style={{ flex: 1, background: '#0f1115', color: '#a7f3d0', padding: '10px 12px', borderRadius: 8, fontSize: 12, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0 }}>{curl}</pre>
                <Button size="small" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(curl); antMsg.success('已复制'); }}>复制</Button>
              </div>
              <div style={{ fontSize: 12, color: '#5A5C6B', margin: '10px 0 4px' }}>② SSE 流式（协议2）→ <Text code style={{ fontSize: 11.5 }}>text/event-stream</Text>，事件 <Text code style={{ fontSize: 11.5 }}>delta/done/error</Text></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <pre style={{ flex: 1, background: '#0f1115', color: '#a7f3d0', padding: '10px 12px', borderRadius: 8, fontSize: 12, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0 }}>{curlStream}</pre>
                <Button size="small" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(curlStream); antMsg.success('已复制'); }}>复制</Button>
              </div>
              <div style={{ marginTop: 8, color: '#8A8C99', fontSize: 12 }}>跨域/平台内调用走后端代理：<Text code style={{ fontSize: 12 }}>/api/agents/{'{id}'}/service-chat[/stream]</Text></div>
            </>
          )}
          {!pub.claude_code && <div style={{ marginTop: 10, color: '#946C00', background: '#FFF8E6', border: '1px solid #FCE2A0', borderRadius: 6, padding: '8px 12px', fontSize: 12.5 }}>提示：本机未检测到 claude 命令，装好 Claude Code 后服务才能真实回复（否则返回 mock）。</div>}
          <div style={{ marginTop: 10, color: '#8A8C99', fontSize: 12 }}>已写入文件：{(pub.files || []).join('、')}</div>
        </div>
      )}
    </Modal>
  );
}

/* ================= 工具/技能抽屉 (Spec D/E/H) ================= */
function AssetDrawer({ open, type, selected, onClose, onConfirm }) {
  const data = type === 'tool' ? TOOLS : SKILLS;
  const [sel, setSel] = useState(selected);
  const [kw, setKw] = useState('');
  React.useEffect(() => { setSel(selected); setKw(''); }, [open, selected]);
  const cats = useMemo(() => {
    const map = {};
    data.filter(i => i.name.toLowerCase().includes(kw.toLowerCase())).forEach(i => { (map[i.cat] = map[i.cat] || []).push(i); });
    return map;
  }, [kw, type]);
  const toggle = (id, locked) => { if (!locked) setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]); };
  return (
    <Drawer title={type === 'tool' ? '选择工具' : '选择技能'} width={440} open={open} onClose={onClose}
      styles={{ header: { borderBottom: '1px solid #F1F1F5' } }}
      extra={<Button type="primary" onClick={() => onConfirm(sel)}>确认（{sel.length}）</Button>}>
      <Input allowClear prefix={<SearchOutlined style={{ color: '#bbb' }} />} placeholder="按名称搜索"
        value={kw} onChange={e => setKw(e.target.value)} style={{ marginBottom: 18 }} />
      {Object.keys(cats).length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无匹配" />}
      {Object.entries(cats).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#8A8C99', textTransform: 'uppercase', letterSpacing: 0.5 }}>{cat}</Text>
          <div style={{ marginTop: 10 }}>
            {items.map(it => {
              const checked = sel.includes(it.id);
              return (
                <div key={it.id} onClick={() => toggle(it.id, it.locked)} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 12px',
                  border: '1px solid ' + (checked ? ACCENT : '#EEEFF2'),
                  background: it.locked ? '#FAFAFB' : (checked ? '#F5F5FE' : '#fff'),
                  borderRadius: 10, marginBottom: 8, cursor: it.locked ? 'not-allowed' : 'pointer', opacity: it.locked ? 0.65 : 1, transition: 'all .15s',
                }}>
                  <Checkbox checked={checked} disabled={it.locked} style={{ marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{it.name}</span>
                      {it.locked && <Tooltip title="当前空间无该资产权限"><LockOutlined style={{ color: '#C0C0C8', fontSize: 12 }} /></Tooltip>}
                    </div>
                    <div style={{ color: '#8A909A', fontSize: 12, marginTop: 2 }}>{it.desc}</div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                      {it.mcp && <span style={pill('#EEF0FF', '#4F46E5')}>{it.mcp}</span>}
                      {it.ver && <span style={pill('#F1F1F4', '#5A5C6B')}>{it.ver}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </Drawer>
  );
}
const pill = (bg, color) => ({ background: bg, color, fontSize: 11, padding: '1px 8px', borderRadius: 6, fontWeight: 600 });

/* ================= 调试面板 (Spec I · mock) ================= */
function DebugPanel({ cfg, chatPath, streamPath }) {
  const [msgs, setMsgs] = useState([{ role: 'sys', text: API_ON ? `调试 · 模型 ${cfg.model || '未选'} · 本机 ${cfg.framework === 'OPENCLAW' ? 'OpenClaw Gateway' : 'Claude Code'} 运行` : `调试 · 模型 ${cfg.model || '未选'} · 本地 mock（未连后端）` }]);
  const [input, setInput] = useState('');
  const [sid, setSid] = useState(null);
  const [busy, setBusy] = useState(false);
  const setBot = (text, extra) => setMsgs(m => { const c = [...m]; for (let i = c.length - 1; i >= 0; i--) { if (c[i].role === 'bot') { c[i] = { ...c[i], text, ...(extra || {}) }; break; } } return c; });
  const send = async () => {
    if (!input.trim() || busy) return;
    const q = input.trim();
    setMsgs(m => [...m, { role: 'user', text: q }]);
    setInput('');
    if (!API_ON) {
      const toolNote = (cfg.tools && cfg.tools.length) ? `（可调用 ${cfg.tools.length} 个工具）` : '';
      setMsgs(m => [...m, { role: 'bot', text: `「${cfg.name || '未命名 Agent'}」${toolNote}收到：${q}\n\n这是基于当前配置的模拟回复（连上后端即真实运行）。` }]);
      return;
    }
    setBusy(true);
    if (streamPath) {
      // 协议2：SSE 流式
      setMsgs(m => [...m, { role: 'bot', text: '', pending: true }]);
      try {
        const resp = await fetch(API_BASE + streamPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q, session_id: sid }) });
        const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = ''; let acc = '';
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const raw = buf.slice(0, i); buf = buf.slice(i + 2);
            let ev = 'message', data = '';
            raw.split('\n').forEach(l => { if (l.startsWith('event:')) ev = l.slice(6).trim(); else if (l.startsWith('data:')) data += l.slice(5).trim(); });
            if (!data) continue; let d; try { d = JSON.parse(data); } catch (e) { continue; }
            if (ev === 'delta') { acc += d.text || ''; setBot(acc, { pending: false }); }
            else if (ev === 'done') { if (d.session_id) setSid(d.session_id); acc = d.reply || acc; setBot(acc, { pending: false }); }
            else if (ev === 'error') { setBot('错误：' + (d.reply || ''), { pending: false, err: true }); }
          }
        }
        if (!acc) setBot('(空响应)', { pending: false });
      } catch (e) { setBot('调用失败：' + e.message, { pending: false, err: true }); }
      finally { setBusy(false); }
      return;
    }
    // 协议1：一次性 JSON
    setMsgs(m => [...m, { role: 'bot', text: '运行中…', pending: true }]);
    try {
      const d = await apiCall(chatPath || `/api/agents/${cfg.id || 'new'}/chat`, { method: 'POST', body: JSON.stringify({ message: q, config: cfg, session_id: sid }) });
      if (d.session_id) setSid(d.session_id);
      setMsgs(m => m.filter(x => !x.pending).concat({ role: 'bot', text: d.reply || '(空响应)', err: d.engine === 'error' }));
    } catch (e) {
      setMsgs(m => m.filter(x => !x.pending).concat({ role: 'bot', text: '调用失败：' + e.message, err: true }));
    } finally { setBusy(false); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 2px' }}>
        {msgs.map((m, i) => m.role === 'sys' ? (
          <div key={i} style={{ textAlign: 'center', fontSize: 12, color: '#8A8C99', margin: '8px 0 16px' }}>{m.text}</div>
        ) : (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <div style={{
              maxWidth: '82%', padding: '10px 13px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              background: m.role === 'user' ? ACCENT : '#F4F4F7', color: m.role === 'user' ? '#fff' : '#2A2A33',
              borderBottomRightRadius: m.role === 'user' ? 3 : 12, borderBottomLeftRadius: m.role === 'bot' ? 3 : 12,
            }}>{m.text}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid #F1F1F5' }}>
        <Input placeholder="输入消息，试跑当前 Agent…" value={input} onChange={e => setInput(e.target.value)} onPressEnter={send} />
        <Button type="primary" icon={<SendOutlined />} onClick={send} />
      </div>
    </div>
  );
}

/* ================= Builder：创建/编辑 (Spec A/B/C + I) ================= */
function AgentBuilder({ mode, agent, onCancel, onSave, onPublished }) {
  const isEdit = mode === 'edit';
  const init = agent || {};
  const [framework, setFramework] = useState(init.framework || 'CLAUDE_CODE');
  const [name, setName] = useState(init.name || '');
  const [desc, setDesc] = useState(init.desc || '');
  const [model, setModel] = useState(init.model);
  const [params, setParams] = useState(init.params || { temperature: 0.7, max_tokens: 4096 });
  const [files, setFiles] = useState(init.files ? { ...init.files } : { ...TEMPLATES['CLAUDE_CODE'] });
  const [tools, setTools] = useState(init.tools || []);
  const [skills, setSkills] = useState(init.skills || []);
  const [drawer, setDrawer] = useState(null);
  const [activeFile, setActiveFile] = useState(Object.keys(init.files || TEMPLATES['CLAUDE_CODE'])[0]);
  const [panel, setPanel] = useState(null); // null | 'debug' | 'preview'
  const [previewFmt, setPreviewFmt] = useState('JSON');
  const [pub, setPub] = useState(null);
  const [choose, setChoose] = useState(false);
  const askPublish = () => { if (!API_ON) { message.info('发布需先在本机启动后端'); return; } setChoose(true); };
  const doPublish = async (iso) => {
    setChoose(false);
    try {
      // 发布 = 把当前配置存为新版本(有改动才升版本)并发布；iso=运行环境/隔离级别
      const r = await apiCall(`/api/agents/${agent.id}/publish?isolation=${iso || 'L1'}`, { method: 'POST', body: JSON.stringify({ config: cfg }) });
      setPub(r);
      if (onPublished) onPublished();
    } catch (e) { message.error('发布失败：' + e.message); }
  };

  const pickFramework = key => {
    setFramework(key);
    if (!isEdit) { setFiles({ ...TEMPLATES[key] }); setActiveFile(Object.keys(TEMPLATES[key])[0]); }
  };
  const fileKeys = Object.keys(TEMPLATES[framework]);
  const nameErr = name && (name.length < 2 || name.length > 50) ? '名称需 2-50 字符' : '';
  const cfg = { name, desc, framework, model, params, files, tools, skills };
  const dirty = !isEdit || JSON.stringify(cfg) !== JSON.stringify({ name: agent.name, desc: agent.desc, framework: agent.framework, model: agent.model, params: agent.params, files: agent.files, tools: agent.tools, skills: agent.skills });
  const canSave = name && !nameErr && model && dirty;

  const configObj = {
    name, description: desc, framework, model, parameters: params,
    files: fileKeys.reduce((o, k) => { o[k] = (files[k] || '').slice(0, 48).replace(/\n/g, ' ') + '…'; return o; }, {}),
    tools: tools.map(id => (TOOLS.find(t => t.id === id) || {}).name),
    skills: skills.map(id => (SKILLS.find(s => s.id === id) || {}).name),
  };
  const previewText = previewFmt === 'JSON' ? JSON.stringify(configObj, null, 2)
    : Object.entries(configObj).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n');

  const togglePanel = key => setPanel(p => p === key ? null : key);
  const paramsContent = (
    <div style={{ width: 280 }}>
      {MODEL_PARAMS.map(p => (
        <div key={p.key} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12.5, color: '#5A5C6B', marginBottom: 4 }}>{p.label}</div>
          {p.type === 'slider'
            ? <Slider min={p.min} max={p.max} step={p.step} value={params[p.key]} onChange={v => setParams({ ...params, [p.key]: v })} />
            : <InputNumber min={p.min} max={p.max} value={params[p.key]} style={{ width: '100%' }} onChange={v => setParams({ ...params, [p.key]: v })} />}
        </div>
      ))}
      <div style={{ fontSize: 11.5, color: '#8A8C99' }}>参数定义由外部接口下发，本平台动态渲染</div>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 紧凑顶栏：返回 + 内联名称/描述 + 框架 + 模型 + 参数 + 调试/预览 + 保存 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14, borderBottom: '1px solid #F1F1F5', marginBottom: 16, flexWrap: 'wrap' }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onCancel} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Input variant="borderless" value={name} disabled={isEdit} maxLength={50} placeholder="未命名 Agent"
              onChange={e => setName(e.target.value)} style={{ fontSize: 18, fontWeight: 750, padding: 0, width: 280, color: '#17171C' }} />
            {isEdit && <span style={pill('#F1F1F4', '#5A5C6B')}>v{agent.version}</span>}
          </div>
          <Input variant="borderless" value={desc} placeholder="添加描述…" onChange={e => setDesc(e.target.value)}
            style={{ fontSize: 12.5, padding: 0, color: '#8A8C99' }} />
          {nameErr && <div style={{ fontSize: 12, color: '#E5484D' }}>{nameErr}</div>}
        </div>
        <Segmented size="small" value={framework} onChange={pickFramework} disabled={isEdit}
          options={FRAMEWORKS.map(f => ({ value: f.key, disabled: !f.enabled,
            label: <Tooltip title={f.enabled ? '' : (f.tip || '未开放')}><span>{f.name}</span></Tooltip> }))} />
        <Select value={model} placeholder="选择模型 *" style={{ width: 190 }} options={PROVIDERS} onChange={setModel}
          showSearch optionFilterProp="label" status={!model ? 'warning' : ''} />
        <Popover trigger="click" placement="bottomRight" title="模型参数" content={paramsContent}>
          <Button icon={<SettingOutlined />} disabled={!model}>参数</Button>
        </Popover>
        <Tooltip title="配置预览"><Button icon={<FileTextOutlined />} type={panel === 'preview' ? 'primary' : 'default'} onClick={() => togglePanel('preview')} /></Tooltip>
        <Button icon={<MessageOutlined />} type={panel === 'debug' ? 'primary' : 'default'} onClick={() => togglePanel('debug')}>调试</Button>
        {isEdit && <Tooltip title="发布已保存的最新版本（如刚改过先保存）；点击后选运行环境"><Button onClick={askPublish}>发布</Button></Tooltip>}
        <Tooltip title={!canSave ? (isEdit ? '无变更或必填项未完善' : '请填写名称并选择模型') : ''}>
          <Button type="primary" disabled={!canSave} onClick={() => onSave(cfg)}>{isEdit ? '保存为新版本' : '创建 (v1)'}</Button>
        </Tooltip>
      </div>

      {/* 主区：配置编辑器为重点 + 可收起的右侧面板 */}
      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
        <div style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
          <div style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 14, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: 650, color: '#33333C' }}>配置文件 · {fwName(framework)}</Text>
              <Button size="small" type="text" style={{ color: ACCENT }} onClick={() => setFiles({ ...TEMPLATES[framework] })}>重置为模板</Button>
            </div>
            {fileKeys.length > 1 ? (
              <Tabs activeKey={activeFile} onChange={setActiveFile} size="small"
                items={fileKeys.map(k => ({ key: k, label: <span>{k}{files[k] && files[k].trim() ? <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: ACCENT, marginLeft: 6, verticalAlign: 'middle' }} /> : null}</span>,
                  children: <CodeEditor value={files[k] || ''} onChange={v => setFiles({ ...files, [k]: v })} rows={18} /> }))} />
            ) : <CodeEditor value={files[fileKeys[0]] || ''} onChange={v => setFiles({ ...files, [fileKeys[0]]: v })} rows={18} />}
          </div>

          <div style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 14, padding: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: 650, color: '#33333C' }}>能力</Text>
            <div style={{ display: 'flex', gap: 32, marginTop: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ color: '#5A5C6B', fontSize: 13 }}><ToolOutlined /> 工具</span>
                  <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => setDrawer('tool')}>添加</Button>
                </div>
                <div>{tools.length === 0 ? <Text style={{ color: '#A6A8B4', fontSize: 12 }}>未选择</Text> :
                  tools.map(id => { const t = TOOLS.find(x => x.id === id); return <Tag key={id} closable bordered={false} onClose={() => setTools(tools.filter(x => x !== id))} style={{ marginBottom: 6, background: '#EEF0FF', color: ACCENT }}>{t && t.name}</Tag>; })}</div>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ color: '#5A5C6B', fontSize: 13 }}><BulbOutlined /> 技能</span>
                  <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => setDrawer('skill')}>添加</Button>
                </div>
                <div>{skills.length === 0 ? <Text style={{ color: '#A6A8B4', fontSize: 12 }}>未选择</Text> :
                  skills.map(id => { const s = SKILLS.find(x => x.id === id); return <Tag key={id} closable bordered={false} onClose={() => setSkills(skills.filter(x => x !== id))} style={{ marginBottom: 6, background: '#F1F1F4', color: '#4A4A55' }}>{s && s.name}</Tag>; })}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧面板：默认收起，按需展开 */}
        {panel && (
          <div style={{ width: 400, background: '#fff', border: '1px solid #EBEBF1', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontWeight: 650, fontSize: 14 }}>{panel === 'debug' ? '调试 · 试跑当前配置' : '配置预览'}</Text>
              <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setPanel(null)} />
            </div>
            {panel === 'debug'
              ? <div style={{ flex: 1, minHeight: 0, height: 'calc(100vh - 220px)' }}><DebugPanel cfg={cfg} /></div>
              : <div>
                  <Segmented size="small" options={['JSON', 'YAML']} value={previewFmt} onChange={setPreviewFmt} style={{ marginBottom: 10 }} />
                  <pre style={{ background: '#FAFAFC', border: '1px solid #F1F1F5', color: '#33333C', padding: 14, borderRadius: 10, fontSize: 12.5, lineHeight: 1.6, maxHeight: 'calc(100vh - 280px)', overflow: 'auto', fontFamily: 'ui-monospace, Menlo, monospace' }}>{previewText}</pre>
                </div>}
          </div>
        )}
      </div>

      <AssetDrawer open={drawer === 'tool'} type="tool" selected={tools} onClose={() => setDrawer(null)} onConfirm={s => { setTools(s); setDrawer(null); }} />
      <AssetDrawer open={drawer === 'skill'} type="skill" selected={skills} onClose={() => setDrawer(null)} onConfirm={s => { setSkills(s); setDrawer(null); }} />
      <PublishChooser open={choose} agentName={name} onCancel={() => setChoose(false)} onConfirm={doPublish} />
      <PublishModal pub={pub} agentName={name} onClose={() => setPub(null)} />
    </div>
  );
}

/* ================= 详情 (Spec A) ================= */
function AgentDetail({ agent, service, onServiceChanged, onBack, onEdit, onDiff }) {
  const [ver, setVer] = useState(agent.version);
  const [play, setPlay] = useState(false);
  const [pub, setPub] = useState(null);
  const [choose, setChoose] = useState(false);
  const askPublish = () => { if (!API_ON) { antMsg.info('发布需先在本机启动后端'); return; } setChoose(true); };
  const doPublish = async (iso) => {
    setChoose(false);
    try { setPub(await apiCall(`/api/agents/${agent.id}/publish?version=${ver}&isolation=${iso || 'L1'}`, { method: 'POST' })); onServiceChanged && onServiceChanged(); }
    catch (e) { antMsg.error('发布失败：' + e.message); }
  };
  const stopService = async () => {
    try { await apiCall(`/api/agents/${agent.id}/service/stop`, { method: 'POST' }); antMsg.success('已停服'); onServiceChanged && onServiceChanged(); }
    catch (e) { antMsg.error('停服失败：' + e.message); }
  };
  const svcCurl = service ? `curl -X POST ${service.url}/chat \\\n  -H "Content-Type: application/json" \\\n  -d '{"message":"你好"}'` : '';
  const svcCurlStream = service ? `curl -N -X POST ${service.url}/chat/stream \\\n  -H "Content-Type: application/json" \\\n  -d '{"message":"你好"}'` : '';
  // 兼容：列表项可能不带 versions（API 列表接口不返回），缺省用自身配置兜底，避免崩溃
  const versions = (agent.versions && agent.versions.length) ? agent.versions
    : [{ version: agent.version || 1, createdAt: agent.updatedAt || '', config: agent }];
  const isLatest = ver === agent.version;
  // 按所选版本读取该版本的配置快照（而非永远读最新）
  const vc = (versions.find(v => v.version === ver) || {}).config || agent;
  const fileKeys = Object.keys(vc.files || {});
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <Space size={12}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} />
          <span style={{ fontSize: 17, fontWeight: 700 }}>{agent.name}</span>
          <span style={pill('#EEF0FF', '#4F46E5')}>{fwName(vc.framework)}</span>
        </Space>
        <Space wrap>
          <Select size="middle" value={ver} style={{ width: 180 }} onChange={setVer}
            options={versions.slice().reverse().map(v => ({ value: v.version, label: `v${v.version}${v.version === agent.version ? ' · 最新' : ''} · ${(v.createdAt || '').slice(5)}` }))} />
          <Tooltip title={versions.length < 2 ? '至少两个版本才能对比' : ''}>
            <Button disabled={versions.length < 2} onClick={() => onDiff(agent)}>对比版本</Button>
          </Tooltip>
          <Button icon={<ThunderboltOutlined />} onClick={() => setPlay(true)}>试跑</Button>
          <Button onClick={askPublish}>发布</Button>
          <Button type="primary" icon={<EditOutlined />} onClick={() => onEdit(agent)}>编辑</Button>
        </Space>
      </div>
      <PublishChooser open={choose} agentName={agent.name} onCancel={() => setChoose(false)} onConfirm={doPublish} />
      <PublishModal pub={pub} agentName={agent.name} onClose={() => setPub(null)} />
      {(service || agent.published) && (
        <div style={{ background: '#fff', border: '1px solid #ECECEF', borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 650 }}>运行服务</span>
              <span style={pill('#EEF0FF', '#4F46E5')}>{fwName(agent.framework)}</span>
              {service && service.isolation && <span style={pill('#F1F1F4', '#5A5C6B')}>{isoName(service.isolation)} · {service.isolation}</span>}
              {service
                ? <><span style={pill('#E9F7EF', '#1E8449')}>● 运行中 v{service.version}</span><Text code style={{ fontSize: 12 }}>{service.url}</Text></>
                : <span style={pill('#F1F1F4', '#A6A8B4')}>○ 已停止</span>}
            </div>
            <Space>
              {service
                ? <Popconfirm title="停止该 Agent 服务？" onConfirm={stopService}><Button size="small" danger>停服</Button></Popconfirm>
                : <Button size="small" onClick={askPublish}>启动（重新发布）</Button>}
            </Space>
          </div>
          {agent.framework === 'OPENCLAW' && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#4F46E5', background: '#EEF0FF', border: '1px solid #C7CBF5', borderRadius: 6, padding: '6px 10px' }}>
              OpenClaw：本 Agent 由平台共享 Gateway 托管（一个 Gateway 托多个 agent，按 agentId 路由）；本机未装 openclaw 时回退 mock，装上即走真实 CLI。
            </div>
          )}
          {service && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: '#8A8C99', marginBottom: 6 }}>API 调用（请求 <Text code style={{ fontSize: 11.5 }}>{'{message, session_id?}'}</Text>；多轮把返回的 session_id 带回；跨域可走后端代理 <Text code style={{ fontSize: 11.5 }}>/api/agents/{agent.id}/service-chat[/stream]</Text>）</div>
              <div style={{ fontSize: 12, color: '#5A5C6B', margin: '4px 0' }}>① 一次性（协议1）→ <Text code style={{ fontSize: 11.5 }}>{'{reply, session_id, engine}'}</Text></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <pre style={{ flex: 1, background: '#0f1115', color: '#a7f3d0', padding: '10px 12px', borderRadius: 8, fontSize: 12, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0 }}>{svcCurl}</pre>
                <Button size="small" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(svcCurl); antMsg.success('已复制'); }}>复制</Button>
              </div>
              <div style={{ fontSize: 12, color: '#5A5C6B', margin: '10px 0 4px' }}>② SSE 流式（协议2）→ <Text code style={{ fontSize: 11.5 }}>text/event-stream</Text>，事件 <Text code style={{ fontSize: 11.5 }}>delta/done/error</Text></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <pre style={{ flex: 1, background: '#0f1115', color: '#a7f3d0', padding: '10px 12px', borderRadius: 8, fontSize: 12, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0 }}>{svcCurlStream}</pre>
                <Button size="small" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(svcCurlStream); antMsg.success('已复制'); }}>复制</Button>
              </div>
            </div>
          )}
        </div>
      )}
      <Drawer title={`试跑 · ${agent.name}（v${ver}）`} width={440} open={play} onClose={() => setPlay(false)}
        styles={{ header: { borderBottom: '1px solid #F1F1F5' }, body: { display: 'flex', flexDirection: 'column' } }}>
        <div style={{ flex: 1, minHeight: 0 }}><DebugPanel cfg={vc} /></div>
      </Drawer>
      <div style={{ background: isLatest ? '#F5F5FE' : '#FFF8E6', border: '1px solid ' + (isLatest ? '#E3E3FA' : '#FCE2A0'), borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: isLatest ? '#4F46E5' : '#946C00' }}>
        {isLatest ? `正在查看最新版本 v${ver}` : `正在只读查看历史版本 v${ver}；点编辑将基于该版本生成新版本。`}
      </div>
      <div style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 14, padding: 24 }}>
        <Descriptions column={2} size="small" colon={false} labelStyle={{ color: '#8A8C99', fontSize: 13, width: 80 }} contentStyle={{ fontSize: 13.5 }}
          items={[
            { label: '描述', children: vc.desc || '—', span: 2 },
            { label: '模型', children: <Text code>{vc.model}</Text> },
            { label: '查看版本', children: `v${ver}` },
            { label: 'Temp', children: vc.params ? vc.params.temperature : '—' },
            { label: 'MaxTokens', children: vc.params ? vc.params.max_tokens : '—' },
            { label: '工具', span: 2, children: (vc.tools && vc.tools.length) ? vc.tools.map(id => <Tag key={id} bordered={false} style={{ background: '#EEF0FF', color: ACCENT }}>{(TOOLS.find(t => t.id === id) || {}).name}</Tag>) : '—' },
            { label: '技能', span: 2, children: (vc.skills && vc.skills.length) ? vc.skills.map(id => <Tag key={id} bordered={false} style={{ background: '#F1F1F4', color: '#4A4A55' }}>{(SKILLS.find(s => s.id === id) || {}).name}</Tag>) : '—' },
          ]} />
        <Divider style={{ margin: '18px 0' }} />
        <Text style={{ fontSize: 13, fontWeight: 650, color: '#33333C' }}>配置文件 · v{ver}</Text>
        <div style={{ marginTop: 12 }}>
          <Collapse activeKey={fileKeys} items={fileKeys.map(k => ({ key: k, label: k,
            children: <pre style={{ background: '#FAFAFC', border: '1px solid #F1F1F5', color: '#33333C', padding: 14, borderRadius: 10, fontSize: 12.5, lineHeight: 1.6, overflow: 'auto', fontFamily: 'ui-monospace, Menlo, monospace', margin: 0 }}>{vc.files[k]}</pre> }))} />
        </div>
      </div>
    </div>
  );
}

/* ================= 版本对比 (Spec F) ================= */
function lineDiff(a, b) {
  const A = (a || '').split('\n'), B = (b || '').split('\n');
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ t: 'eq', l: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: 'del', l: A[i] }); i++; }
    else { out.push({ t: 'add', l: B[j] }); j++; }
  }
  while (i < n) out.push({ t: 'del', l: A[i++] });
  while (j < m) out.push({ t: 'add', l: B[j++] });
  return out;
}
const nameOf = (arr, id) => (arr.find(x => x.id === id) || {}).name || id;

function VersionDiff({ agent, onBack }) {
  const vers = agent.versions;
  const [lv, setLv] = useState(vers.length >= 2 ? vers[vers.length - 2].version : vers[0].version);
  const [rv, setRv] = useState(vers[vers.length - 1].version);
  const L = (vers.find(v => v.version === lv) || vers[0]).config;
  const R = (vers.find(v => v.version === rv) || vers[0]).config;
  const opts = vers.slice().reverse().map(v => ({ value: v.version, label: `v${v.version}${v.version === agent.version ? ' · 最新' : ''} · ${v.createdAt.slice(5)}` }));

  const fieldRows = [];
  const cmp = (label, a, b) => { if (String(a) !== String(b)) fieldRows.push({ label, from: a, to: b }); };
  cmp('框架', fwName(L.framework), fwName(R.framework));
  cmp('模型', L.model, R.model);
  cmp('描述', L.desc || '—', R.desc || '—');
  cmp('Temperature', L.params.temperature, R.params.temperature);
  cmp('Max Tokens', L.params.max_tokens, R.params.max_tokens);
  const toolAdd = R.tools.filter(x => !L.tools.includes(x)), toolDel = L.tools.filter(x => !R.tools.includes(x));
  const skillAdd = R.skills.filter(x => !L.skills.includes(x)), skillDel = L.skills.filter(x => !R.skills.includes(x));

  const fileKeys = Array.from(new Set([...Object.keys(L.files), ...Object.keys(R.files)]));
  const same = lv === rv;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <Space size={12}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} />
          <span style={{ fontSize: 17, fontWeight: 700 }}>{agent.name} · 版本对比</span>
        </Space>
        <Space size={8}>
          <Select value={lv} style={{ width: 190 }} options={opts} onChange={setLv} />
          <span style={{ color: '#8A8C99', fontSize: 15 }}>→</span>
          <Select value={rv} style={{ width: 190 }} options={opts} onChange={setRv} />
        </Space>
      </div>

      {same ? <div style={{ background: '#FFF8E6', border: '1px solid #FCE2A0', borderRadius: 10, padding: '12px 16px', color: '#946C00' }}>请选择两个不同的版本进行对比。</div> : (
        <div>
          <div style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 14, padding: 20, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: 650, color: '#33333C' }}>字段变化</Text>
            <div style={{ marginTop: 12 }}>
              {fieldRows.length === 0 && toolAdd.length === 0 && toolDel.length === 0 && skillAdd.length === 0 && skillDel.length === 0
                ? <Text style={{ color: '#8A8C99' }}>无字段差异</Text>
                : (
                <div>
                  {fieldRows.map(r => (
                    <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', fontSize: 13.5 }}>
                      <span style={{ width: 110, color: '#5A5C6B' }}>{r.label}</span>
                      <span style={diffChip('#FDECEC', '#C0392B')}>{String(r.from)}</span>
                      <span style={{ color: '#C4C4CE', fontSize: 12 }}>→</span>
                      <span style={diffChip('#E9F7EF', '#1E8449')}>{String(r.to)}</span>
                    </div>
                  ))}
                  {(toolAdd.length > 0 || toolDel.length > 0) && (
                    <div style={{ display: 'flex', gap: 10, padding: '7px 0', fontSize: 13.5 }}>
                      <span style={{ width: 110, color: '#5A5C6B' }}>工具</span>
                      <div>{toolDel.map(id => <Tag key={id} bordered={false} style={{ background: '#FDECEC', color: '#C0392B' }}>− {nameOf(TOOLS, id)}</Tag>)}
                        {toolAdd.map(id => <Tag key={id} bordered={false} style={{ background: '#E9F7EF', color: '#1E8449' }}>+ {nameOf(TOOLS, id)}</Tag>)}</div>
                    </div>
                  )}
                  {(skillAdd.length > 0 || skillDel.length > 0) && (
                    <div style={{ display: 'flex', gap: 10, padding: '7px 0', fontSize: 13.5 }}>
                      <span style={{ width: 110, color: '#5A5C6B' }}>技能</span>
                      <div>{skillDel.map(id => <Tag key={id} bordered={false} style={{ background: '#FDECEC', color: '#C0392B' }}>− {nameOf(SKILLS, id)}</Tag>)}
                        {skillAdd.map(id => <Tag key={id} bordered={false} style={{ background: '#E9F7EF', color: '#1E8449' }}>+ {nameOf(SKILLS, id)}</Tag>)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {fileKeys.map(fk => {
            const rows = lineDiff(L.files[fk], R.files[fk]);
            const changed = rows.some(r => r.t !== 'eq');
            return (
              <div key={fk} style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 14, padding: 0, marginBottom: 14, overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #F1F1F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontWeight: 650, fontSize: 13 }}>{fk}</Text>
                  {!changed && <Text style={{ color: '#8A8C99', fontSize: 12 }}>无变化</Text>}
                </div>
                <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, lineHeight: 1.7 }}>
                  {rows.map((r, i) => (
                    <div key={i} style={{
                      display: 'flex', padding: '0 12px',
                      background: r.t === 'add' ? '#EAF8F0' : r.t === 'del' ? '#FDECEC' : '#fff',
                      color: r.t === 'add' ? '#1E8449' : r.t === 'del' ? '#C0392B' : '#5A5A66',
                    }}>
                      <span style={{ width: 16, userSelect: 'none', color: '#A6A8B4' }}>{r.t === 'add' ? '+' : r.t === 'del' ? '−' : ''}</span>
                      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{r.l || ' '}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
const diffChip = (bg, color) => ({ background: bg, color, fontSize: 12.5, padding: '2px 10px', borderRadius: 6, fontWeight: 600 });

/* ================= 成员管理 (Spec J/K/H) ================= */
function MembersPanel({ ws, onUpdate }) {
  const [members, setMembers] = useState(ws.members);
  const [addName, setAddName] = useState('');
  React.useEffect(() => setMembers(ws.members), [ws.id]);
  const ownerCount = members.filter(m => m.role === 'owner').length;
  const sync = next => { setMembers(next); onUpdate({ ...ws, members: next }); };
  const changeRole = (id, role) => { const m = members.find(x => x.id === id); if (m.role === 'owner' && role === 'member' && ownerCount <= 1) return antMsg.error('空间至少保留一名 Owner'); sync(members.map(x => x.id === id ? { ...x, role } : x)); if (API_ON) apiCall(`/api/workspaces/${ws.id}/members/${id}`, { method: 'PUT', body: JSON.stringify({ name: m.name, role }) }).catch(() => {}); };
  const remove = id => { const m = members.find(x => x.id === id); if (m.role === 'owner' && ownerCount <= 1) return antMsg.error('空间至少保留一名 Owner'); sync(members.filter(x => x.id !== id)); antMsg.success('已移除'); if (API_ON) apiCall(`/api/workspaces/${ws.id}/members/${id}`, { method: 'DELETE' }).catch(() => {}); };
  const add = () => { const nm = addName.trim(); if (!nm) return; const id = 'u' + Date.now(); sync([...members, { id, name: nm, role: 'member' }]); setAddName(''); antMsg.success('已添加成员'); if (API_ON) apiCall(`/api/workspaces/${ws.id}/members/${id}`, { method: 'PUT', body: JSON.stringify({ name: nm, role: 'member' }) }).catch(() => {}); };
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>成员与权限</div>
        <Text style={{ color: '#8A8C99' }}>空间「{ws.name}」· {members.length} 名成员 · 一个空间可有多个 Owner（至少一名）</Text>
      </div>
      <div style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 14, padding: 24 }}>
        <Space style={{ marginBottom: 18 }}>
          <Input placeholder="输入成员姓名/账号" value={addName} onChange={e => setAddName(e.target.value)} onPressEnter={add} style={{ width: 260 }} prefix={<UserOutlined style={{ color: '#bbb' }} />} />
          <Button type="primary" icon={<PlusOutlined />} onClick={add}>添加成员</Button>
        </Space>
        <Table rowKey="id" pagination={false} dataSource={members}
          columns={[
            { title: '成员', dataIndex: 'name', render: (t, r) => <Space><Avatar size="small" style={{ background: r.role === 'owner' ? ACCENT : '#C4C4CE', fontSize: 12 }}>{t[0]}</Avatar>{t}</Space> },
            { title: '角色', dataIndex: 'role', width: 220, render: (role, r) => <Select size="small" value={role} style={{ width: 150 }} onChange={v => changeRole(r.id, v)} options={[{ value: 'owner', label: 'Owner · 项目管理员' }, { value: 'member', label: 'Member · 成员' }]} /> },
            { title: '', width: 60, render: (_, r) => <Popconfirm title="移出该成员？" onConfirm={() => remove(r.id)}><Button size="small" danger type="text" icon={<DeleteOutlined />} /></Popconfirm> },
          ]} />
      </div>
    </div>
  );
}

let antMsg = { success: () => {}, error: () => {}, info: () => {} };

/* ================= Playground：与已发布 agent 对话 ================= */
function Playground({ agents }) {
  const [list, setList] = useState(API_ON ? [] : agents.map(a => ({ id: a.id, name: a.name, framework: a.framework, model: a.model, version: a.version })));
  const [sel, setSel] = useState(null);
  const [cfg, setCfg] = useState(null);
  const pick = async item => {
    setSel(item);
    if (API_ON) {
      try { const full = await apiCall(`/api/agents/${item.id}`); const v = (full.versions || []).find(x => x.version === item.version); setCfg({ ...(v ? v.config : full), id: full.id }); }
      catch (e) { antMsg.error('加载失败：' + e.message); }
    } else { const a = agents.find(x => x.id === item.id); setCfg(a ? { ...a } : null); }
  };
  React.useEffect(() => {
    if (API_ON) apiCall('/api/published').then(d => { setList(d); if (d[0]) pick(d[0]); }).catch(() => {});
    else if (agents[0]) pick({ id: agents[0].id, version: agents[0].version });
  }, []);
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 750, letterSpacing: -0.3, color: '#17171C' }}>Playground</div>
        <Text style={{ color: '#8A8C99', fontSize: 13.5 }}>与已发布的 Agent 对话{API_ON ? '' : '（未连后端 · 本地 mock）'}</Text>
      </div>
      {list.length === 0
        ? <div style={{ border: '1px dashed #DEDEE3', borderRadius: 8, padding: '56px 0', background: '#FCFCFD' }}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有已发布的 Agent —— 去详情或编辑页点「发布」" /></div>
        : <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {list.map(it => {
                const active = sel && sel.id === it.id;
                return (
                  <div key={it.id} onClick={() => pick(it)} style={{ padding: '10px 12px', border: '1px solid ' + (active ? ACCENT : '#EBEBF1'), background: active ? '#F5F5FE' : '#fff', borderRadius: 8, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 650, fontSize: 13.5, color: '#17171C' }}>{it.name}</span>
                      <span style={pill('#F1F1F4', '#5A5C6B')}>v{it.version}</span>
                      <span style={pill('#EEF0FF', '#4F46E5')}>{fwName(it.framework)}</span>
                    </div>
                    <div style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11.5, color: '#5A5C6B', marginTop: 4 }}>{it.model}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #EBEBF1', borderRadius: 12, padding: 16, height: 'calc(100vh - 170px)', display: 'flex', flexDirection: 'column' }}>
              {cfg ? <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 650, fontSize: 14, marginBottom: 10 }}>{cfg.name} <span style={pill('#EEF0FF', '#4F46E5')}>{fwName(cfg.framework)}</span></div>
                  <div style={{ flex: 1, minHeight: 0 }}><DebugPanel key={sel.id + '-' + sel.version} cfg={cfg} chatPath={`/api/agents/${sel.id}/service-chat`} streamPath={`/api/agents/${sel.id}/service-chat/stream`} /></div>
                </div>
                : <Empty description="选择左侧一个 Agent 开始对话" />}
            </div>
          </div>}
    </div>
  );
}

/* ================= Chat（统一入口：默认通用 agent + slash 选内置 skill）================= */
const GENERAL_INTRO = '通用助手 · 直接说需求即可执行：列出 Agent、创建 Agent 客服助手、创建项目空间 营销组、列出已发布。输入 / 选择内置技能。';
const CHAT_SKILLS = [
  { cmd: '/agent-creator', mode: 'agent', name: 'Agent Creator', intro: '描述名称 + 职责，我来创建 Agent。例：客服助手：负责一线答疑' },
  { cmd: '/skill-creator', mode: 'skill', name: 'Skill Creator', intro: '描述一个技能，我生成定义草稿（demo 不持久化）。' },
];

function ChatPanel({ curWs, isAdmin, onChanged }) {
  const [mode, setMode] = useState('general');
  const [msgs, setMsgs] = useState([{ role: 'sys', text: GENERAL_INTRO }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [slash, setSlash] = useState(false);
  const push = (role, text) => setMsgs(m => [...m, { role, text }]);

  const mkClaudeMd = (name, role) => `# ${name}\n\n## 角色\n${role || '<待完善>'}\n\n## 目标\n- <核心目标>\n`;
  const createAgent = async (name, role) => {
    const body = { ws_id: curWs, name, framework: 'CLAUDE_CODE', model: 'claude-opus-4-8', desc: role || '', params: { temperature: 0.7, max_tokens: 4096 }, files: { 'claude.md': mkClaudeMd(name, role) }, tools: [], skills: [] };
    const a = await apiCall('/api/agents', { method: 'POST', body: JSON.stringify(body) });
    onChanged && onChanged();
    return a;
  };

  const handleGeneral = async q => {
    if (/帮助|help|能(做|干)|怎么用|可以做/i.test(q)) return push('bot', '我能执行：\n· 列出 Agent\n· 创建 Agent <名称>\n· 列出已发布\n· 创建项目空间 <名称>（仅管理员）\n或输入 / 选择内置技能（/agent-creator、/skill-creator）。');
    if (/已发布/.test(q) && /列|查|有哪|看/.test(q)) { const d = await apiCall('/api/published'); return push('bot', d.length ? '已发布：\n' + d.map(x => `· ${x.name} v${x.version}`).join('\n') : '还没有已发布的 Agent。'); }
    if (/(列|查|有哪|看)/.test(q) && /agent|智能体/i.test(q)) { const d = await apiCall(`/api/agents?ws=${curWs}`); return push('bot', d.length ? '当前空间 Agent：\n' + d.map(x => `· ${x.name} v${x.version}${x.published ? '（已发布）' : ''}`).join('\n') : '当前空间还没有 Agent。'); }
    let m = q.match(/(?:创建|新建|建).*?空间\s*[:：]?\s*(.+)$/);
    if (m) { if (!isAdmin) return push('bot', '仅平台管理员可创建项目空间。'); const w = await apiCall('/api/workspaces', { method: 'POST', body: JSON.stringify({ name: m[1].trim() }) }); onChanged && onChanged(); return push('bot', `已创建项目空间「${w.name}」。`); }
    if (/(创建|新建|建|做).*(agent|智能体|助手|机器人)/i.test(q)) {
      const nm = (q.match(/(?:叫|名为|名称[:：]?)\s*([^\s，,。:：]+)/) || [])[1] || (q.split(/[:：]/)[0] || '').replace(/创建|新建|做一个|一个|建个?|agent|智能体|助手|机器人/gi, '').trim() || '新Agent';
      const role = (q.split(/[:：]/)[1] || q).trim();
      const a = await createAgent(nm, role);
      return push('bot', `已创建 Agent「${a.name}」(v${a.version})。去「Agents」可继续编辑完善。`);
    }
    return push('bot', '可以让我：列出 Agent、创建 Agent <名称>、列出已发布、创建项目空间 <名称>；或输入 / 选技能。');
  };
  const handleAgent = async q => {
    const parts = q.split(/[:：]/);
    let name = (q.match(/(?:叫|名为)\s*([^\s，,。:：]+)/) || [])[1];
    let role = q;
    if (parts.length >= 2 && !name) { name = parts[0].replace(/创建|新建|做一个|一个|建个?|agent/gi, '').trim(); role = parts.slice(1).join('：').trim(); }
    if (!name) name = '新Agent-' + Math.floor(Math.random() * 1000);
    const a = await createAgent(name, role);
    push('bot', `已为你创建 Agent「${a.name}」(v${a.version})，角色写入 claude.md。可去「Agents」编辑完善，或在详情页「发布」。`);
  };
  const handleSkill = async q => {
    const nm = (q.match(/(?:叫|名为)\s*([^\s，,。:：]+)/) || [])[1] || '新技能';
    push('bot', `技能草稿（demo 不持久化）：\n\n# ${nm}\n## 描述\n${q}\n## 触发场景\n- <何时使用>\n## 步骤\n1. <第一步>\n2. <…>\n\n要落库需补「技能注册」接口（见 Spec E，⬜后续）。`);
  };

  const route = async (m, q) => {
    if (!API_ON) { push('bot', '（需先在本机启动后端才能真正执行操作）'); return; }
    setBusy(true);
    try { m === 'general' ? await handleGeneral(q) : m === 'agent' ? await handleAgent(q) : await handleSkill(q); }
    catch (e) { push('bot', '出错：' + e.message); }
    finally { setBusy(false); }
  };
  const enterSkill = (s, rest) => { setMode(s.mode); push('sys', `已进入 ${s.name} · ${s.intro}`); if (rest) route(s.mode, rest); };
  const exitSkill = () => { setMode('general'); push('sys', '已退出技能，回到通用助手'); };
  const pickSlash = s => { setInput(''); setSlash(false); push('user', s.cmd); enterSkill(s, ''); };

  const send = async () => {
    const q = input.trim(); if (!q || busy) return;
    if (q.startsWith('/')) {
      const s = CHAT_SKILLS.find(x => q === x.cmd || q.startsWith(x.cmd + ' '));
      setInput(''); setSlash(false);
      if (s) { push('user', q); enterSkill(s, q.slice(s.cmd.length).trim()); }
      else push('bot', '未知命令。可用：/agent-creator、/skill-creator');
      return;
    }
    push('user', q); setInput('');
    route(mode, q);
  };
  const onInput = v => { setInput(v); setSlash(v.startsWith('/')); };
  const slashList = CHAT_SKILLS.filter(s => s.cmd.includes(input.toLowerCase()));
  const activeSkill = CHAT_SKILLS.find(s => s.mode === mode);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 750, letterSpacing: -0.3, color: '#17171C' }}>Chat</div>
        <Text style={{ color: '#8A8C99', fontSize: 13.5 }}>平台统一入口：默认通用助手，可执行平台操作；输入 / 唤起内置技能</Text>
      </div>
      <div style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 12, padding: 16, height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
          {msgs.map((m, i) => m.role === 'sys'
            ? <div key={i} style={{ textAlign: 'center', fontSize: 12, color: '#A6A8B4', margin: '6px 0 14px' }}>{m.text}</div>
            : <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                <div style={{ maxWidth: '82%', padding: '10px 13px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: m.role === 'user' ? ACCENT : '#F4F4F7', color: m.role === 'user' ? '#fff' : '#2A2A33', borderBottomRightRadius: m.role === 'user' ? 3 : 12, borderBottomLeftRadius: m.role === 'bot' ? 3 : 12 }}>{m.text}</div>
              </div>)}
        </div>
        {activeSkill && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={pill('#EEF0FF', '#4F46E5')}>技能：{activeSkill.name}</span>
            <a onClick={exitSkill} style={{ fontSize: 12, color: '#8A8C99' }}>× 退出</a>
          </div>
        )}
        <div style={{ position: 'relative' }}>
          {slash && slashList.length > 0 && (
            <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', border: '1px solid #E7E7EC', borderRadius: 10, boxShadow: '0 4px 16px rgba(20,20,45,0.10)', overflow: 'hidden', zIndex: 5 }}>
              {slashList.map(s => (
                <div key={s.cmd} onClick={() => pickSlash(s)} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #F6F6F9' }}>
                  <div><span style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontWeight: 600, color: ACCENT }}>{s.cmd}</span> <span style={{ fontWeight: 600 }}>{s.name}</span></div>
                  <div style={{ fontSize: 12, color: '#8A8C99', marginTop: 2 }}>{s.intro}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid #F1F1F5' }}>
            <Input placeholder={busy ? '执行中…' : '输入消息，或 / 选择技能'} value={input} disabled={busy} onChange={e => onInput(e.target.value)} onPressEnter={send} />
            <Button type="primary" icon={<SendOutlined />} onClick={send} loading={busy} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= 根组件 ================= */
function Root() {
  const { message } = AntApp.useApp();
  antMsg = message;
  const [workspaces, setWorkspaces] = useState(INIT_WORKSPACES);
  const [curWs, setCurWs] = useState('w1');
  const [agents, setAgents] = useState(INIT_AGENTS);
  const [nav, setNav] = useState('agents'); // agents | members
  const [view, setView] = useState({ name: 'list' });
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('updated');
  const [createWsOpen, setCreateWsOpen] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [apiMode, setApiMode] = useState(false);
  const [services, setServices] = useState([]);

  const loadWorkspaces = () => apiCall('/api/workspaces').then(d => { setWorkspaces(d); return d; }).catch(() => {});
  const loadAgents = wsId => apiCall(`/api/agents?ws=${wsId}`).then(setAgents).catch(() => {});
  const loadServices = () => apiCall('/api/services').then(setServices).catch(() => {});
  React.useEffect(() => {
    apiCall('/api/health').then(() => { API_ON = true; setApiMode(true); loadWorkspaces(); loadAgents(curWs); loadServices(); }).catch(() => { API_ON = false; });
  }, []);
  const svcMap = useMemo(() => { const m = {}; services.forEach(s => { m[s.agentId] = s; }); return m; }, [services]);
  const openAgent = a => {
    if (API_ON) apiCall(`/api/agents/${a.id}`).then(full => setView({ name: 'detail', agent: full })).catch(() => setView({ name: 'detail', agent: a }));
    else setView({ name: 'detail', agent: a });
  };

  const ws = workspaces.find(w => w.id === curWs);
  const myRole = (ws.members.find(m => m.id === 'u0') || {}).role || 'member';
  const isPlatformAdmin = true; // demo：当前 mock 用户为平台管理员；生产由 SSO/RBAC 决定

  const visibleAgents = useMemo(() => {
    let list = agents.filter(a => a.wsId === curWs && !a.deleted);
    if (search) list = list.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
    return list.slice().sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : b.updatedAt.localeCompare(a.updatedAt));
  }, [agents, curWs, search, sort]);

  const switchWs = id => { setCurWs(id); setView({ name: 'list' }); setNav('agents'); setSearch(''); if (API_ON) loadAgents(id); };
  const saveNew = data => {
    if (API_ON) { apiCall('/api/agents', { method: 'POST', body: JSON.stringify({ ...data, ws_id: curWs }) }).then(() => { message.success(`已创建「${data.name}」及初始版本 v1`); loadAgents(curWs); setView({ name: 'list' }); }).catch(e => message.error('创建失败：' + e.message)); return; }
    const id = 'a' + (++AGENT_SEQ); const ts = now(); setAgents([{ id, wsId: curWs, version: 1, updatedAt: ts, deleted: false, ...data, versions: [{ version: 1, createdAt: ts, config: { ...data } }] }, ...agents]); message.success(`已创建「${data.name}」及初始版本 v1`); setView({ name: 'list' });
  };
  const saveEdit = (orig, data) => {
    if (API_ON) { apiCall(`/api/agents/${orig.id}`, { method: 'PUT', body: JSON.stringify({ model: data.model, desc: data.desc, params: data.params, files: data.files, tools: data.tools, skills: data.skills }) }).then(() => { message.success(`已保存为新版本 v${orig.version + 1}`); loadAgents(curWs); setView({ name: 'list' }); }).catch(e => message.error('保存失败：' + e.message)); return; }
    const ts = now(); setAgents(agents.map(a => a.id === orig.id ? { ...a, ...data, version: a.version + 1, updatedAt: ts, versions: [...a.versions, { version: a.version + 1, createdAt: ts, config: { ...data } }] } : a)); message.success(`已保存为新版本 v${orig.version + 1}`); setView({ name: 'list' });
  };
  const softDelete = id => {
    if (API_ON) { apiCall(`/api/agents/${id}`, { method: 'DELETE' }).then(() => { message.success('已删除（软删除，记录保留）'); loadAgents(curWs); }).catch(() => {}); return; }
    setAgents(agents.map(a => a.id === id ? { ...a, deleted: true } : a)); message.success('已删除（软删除，记录保留）');
  };
  const createWs = () => {
    if (!newWsName.trim()) return;
    if (API_ON) { apiCall('/api/workspaces', { method: 'POST', body: JSON.stringify({ name: newWsName.trim() }) }).then(w => { setCreateWsOpen(false); setNewWsName(''); message.success('项目空间已创建'); loadWorkspaces().then(() => { setCurWs(w.id); loadAgents(w.id); }); }).catch(e => message.error('创建失败：' + e.message)); return; }
    const id = 'w' + Date.now(); setWorkspaces([...workspaces, { id, name: newWsName.trim(), members: [{ id: 'u0', name: 'Helena（我）', role: 'owner' }] }]); setCurWs(id); setCreateWsOpen(false); setNewWsName(''); message.success('项目空间已创建');
  };

  const columns = [
    { title: '名称', dataIndex: 'name', render: (t, r) => <a onClick={() => setView({ name: 'detail', agent: r })} style={{ fontWeight: 600, color: ACCENT }}>{t}</a> },
    { title: '框架', dataIndex: 'framework', render: f => <span style={pill('#EEF0FF', '#4F46E5')}>{fwName(f)}</span> },
    { title: '模型', dataIndex: 'model', render: m => <Text code style={{ fontSize: 12 }}>{m}</Text> },
    { title: '版本', dataIndex: 'version', width: 80, render: v => <span style={pill('#F1F1F4', '#5A5C6B')}>v{v}</span> },
    { title: '最后更新', dataIndex: 'updatedAt', width: 160, render: t => <Text style={{ color: '#8A909A', fontSize: 13 }}>{t}</Text> },
    { title: '操作', width: 150, render: (_, r) => (
      <div onClick={e => e.stopPropagation()}>
        <Space size={2}>
          <Button size="small" type="text" style={{ color: ACCENT }} onClick={() => setView({ name: 'detail', agent: r })}>详情</Button>
          <Tooltip title="编辑"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => setView({ name: 'edit', agent: r })} /></Tooltip>
          <Popconfirm title="删除该 Agent？" description="软删除，记录保留" onConfirm={() => softDelete(r.id)}>
            <Tooltip title="删除"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      </div>
    )},
  ];

  const inBuilder = view.name === 'create' || view.name === 'edit';
  const sectionLabel = nav === 'chat' ? 'Chat'
    : nav === 'playground' ? 'Playground'
    : nav === 'members' ? '成员与权限'
    : view.name === 'create' ? '创建 Agent'
    : view.name === 'edit' ? '编辑 · ' + (view.agent ? view.agent.name : '')
    : view.name === 'detail' ? '详情'
    : view.name === 'diff' ? '版本对比' : 'Agents';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={236} theme="light" style={{ background: '#FAFAFB', borderRight: '1px solid #EBEBF1', padding: '16px 14px', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', left: 0, top: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 6px 16px' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#4F46E5,#7A72ED)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, boxShadow: '0 2px 7px rgba(79,70,229,0.30)' }}>A</div>
          <span style={{ fontWeight: 750, fontSize: 16, letterSpacing: -0.2, color: '#17171C' }}>AISpace</span>
        </div>

        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#A6A8B4', letterSpacing: 0.6, padding: '0 6px 8px' }}>工作空间</div>
        <Dropdown trigger={['click']} menu={{
          items: [...workspaces.map(w => ({ key: w.id, label: w.name, icon: w.id === curWs ? <CheckOutlined style={{ color: ACCENT }} /> : <span style={{ display: 'inline-block', width: 14 }} /> })), ...(isPlatformAdmin ? [{ type: 'divider' }, { key: '__new', label: '新建项目空间', icon: <PlusOutlined /> }] : [])],
          onClick: ({ key }) => key === '__new' ? setCreateWsOpen(true) : switchWs(key),
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid #E7E7EC', borderRadius: 8, background: '#fff', cursor: 'pointer', marginBottom: 16 }}>
            <Space size={8}><AppstoreOutlined style={{ color: ACCENT }} /><span style={{ fontSize: 13.5, fontWeight: 600 }}>{ws.name}</span></Space>
            <DownOutlined style={{ fontSize: 10, color: '#A6A8B4' }} />
          </div>
        </Dropdown>

        <Menu mode="inline" selectedKeys={[nav]} style={{ background: 'transparent', border: 'none', flex: 1 }}
          onClick={({ key }) => { setNav(key); setView({ name: 'list' }); }}
          items={[
            { key: 'agents', icon: <RobotOutlined />, label: 'Agents' },
            { key: 'chat', icon: <MessageOutlined />, label: 'Chat' },
            { key: 'playground', icon: <ThunderboltOutlined />, label: 'Playground' },
            { key: 'members', icon: <TeamOutlined />, label: '成员与权限' },
          ]} />

        {apiMode && (
          <Popconfirm title="停止所有正在运行的 Agent 服务？" description="含后端重启遗留的孤儿进程" onConfirm={async () => { try { const r = await apiCall('/api/services/stop-all', { method: 'POST' }); message.success(`已停止 ${r.stopped} 个服务`); loadServices(); } catch (e) { message.error(e.message); } }}>
            <Button size="small" danger block style={{ marginBottom: 10 }}>停止所有 Agent 服务</Button>
          </Popconfirm>
        )}
        <div style={{ borderTop: '1px solid #EBEBF1', paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: '#A6A8B4' }}>
          <span>Demo · 免登录</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: apiMode ? '#34C759' : '#C9CAD6', display: 'inline-block' }} />{apiMode ? '后端已连接' : '本地 mock'}</span>
        </div>
      </Sider>

      <Layout style={{ marginLeft: 236, background: '#fff' }}>
        <div style={{ height: 56, borderBottom: '1px solid #EFEFF2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', position: 'sticky', top: 0, background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5 }}>
            <AppstoreOutlined style={{ color: '#A6A8B4', fontSize: 14 }} />
            <span style={{ color: '#8A8C99' }}>{ws.name}</span>
            <span style={{ color: '#D0D0D8' }}>/</span>
            <span style={{ color: '#17171C', fontWeight: 600 }}>{sectionLabel}</span>
          </div>
          <Dropdown trigger={['click']} menu={{ items: [{ key: 'role', disabled: true, label: (myRole === 'owner' ? 'Owner' : 'Member') + ' · 当前空间' }, { type: 'divider' }, { key: 'demo', disabled: true, label: 'Demo · 免登录模式' }] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '5px 9px 5px 5px', borderRadius: 10 }}>
              <Avatar size={28} style={{ background: ACCENT, fontSize: 13, fontWeight: 600 }}>H</Avatar>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Helena</span>
              <DownOutlined style={{ fontSize: 9, color: '#A6A8B4' }} />
            </div>
          </Dropdown>
        </div>

        <Content style={{ padding: inBuilder ? '18px 28px' : '20px 28px 36px', maxWidth: inBuilder ? 'none' : 1240, width: '100%', margin: inBuilder ? 0 : '0 auto', height: inBuilder ? 'calc(100vh - 56px)' : 'auto' }}>
          {nav === 'agents' && view.name === 'list' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 750, letterSpacing: -0.3, color: '#17171C' }}>Agents</div>
                  <Text style={{ color: '#8A8C99', fontSize: 13.5 }}>管理、调试与版本化你的智能体</Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setView({ name: 'create' })}>创建 Agent</Button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
                <Input allowClear prefix={<SearchOutlined style={{ color: '#B6B6BE' }} />} placeholder="搜索 Agent 名称" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 280 }} />
                <Select value={sort} style={{ width: 150 }} onChange={setSort} options={[{ value: 'updated', label: '最近编辑' }, { value: 'name', label: '名称 A–Z' }]} />
                <div style={{ flex: 1 }} />
                <Text style={{ color: '#A6A8B4', fontSize: 12.5 }}>共 {visibleAgents.length} 个</Text>
              </div>
              {visibleAgents.length === 0
                ? <div style={{ border: '1px dashed #DEDEE3', borderRadius: 8, padding: '56px 0', background: '#FCFCFD' }}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search ? '没有匹配的 Agent' : '该空间还没有 Agent'}>{!search && <Button type="primary" icon={<PlusOutlined />} onClick={() => setView({ name: 'create' })}>创建 Agent</Button>}</Empty></div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {visibleAgents.map(a => (
                      <div key={a.id} className="agent-card" onClick={() => openAgent(a)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', background: '#fff', border: '1px solid #EBEBF1', borderRadius: 8, cursor: 'pointer' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 6, background: '#EEF0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <RobotOutlined style={{ color: ACCENT, fontSize: 17 }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{ fontWeight: 650, fontSize: 14.5, color: '#17171C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                            <span style={pill('#F1F1F4', '#5A5C6B')}>v{a.version}</span>
                            {a.published
                              ? <><span style={pill('#E9F7EF', '#1E8449')}>已发布 v{a.publishedVersion}</span>
                                  {svcMap[a.id] ? <span style={pill('#E9F7EF', '#1E8449')}>● 运行中</span> : <span style={pill('#F1F1F4', '#A6A8B4')}>○ 已停止</span>}</>
                              : <span style={pill('#F1F1F4', '#A6A8B4')}>未发布</span>}
                          </div>
                          <div style={{ color: '#8A8C99', fontSize: 12.5, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.desc || '暂无描述'}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <span style={pill('#EEF0FF', '#4F46E5')}>{fwName(a.framework)}</span>
                          <span style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11.5, color: '#5A5C6B', background: '#FAFAFB', border: '1px solid #F1F1F5', borderRadius: 6, padding: '3px 8px' }}>{a.model}</span>
                        </div>
                        <div style={{ width: 92, flexShrink: 0, textAlign: 'right', color: '#A6A8B4', fontSize: 12 }}>{a.updatedAt.slice(5)}</div>
                        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                          <Tooltip title="编辑"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => setView({ name: 'edit', agent: a })} /></Tooltip>
                          <Popconfirm title="删除该 Agent？" description="软删除，记录保留" onConfirm={() => softDelete(a.id)}><Tooltip title="删除"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip></Popconfirm>
                        </div>
                      </div>
                    ))}
                  </div>}
            </div>
          )}
          {nav === 'agents' && view.name === 'create' && <AgentBuilder mode="create" onCancel={() => setView({ name: 'list' })} onSave={saveNew} />}
          {nav === 'agents' && view.name === 'edit' && <AgentBuilder mode="edit" agent={view.agent} onCancel={() => setView({ name: 'list' })} onSave={data => saveEdit(view.agent, data)} onPublished={() => { if (API_ON) { loadAgents(curWs); loadServices(); } }} />}
          {nav === 'agents' && view.name === 'detail' && <AgentDetail agent={agents.find(a => a.id === view.agent.id) || view.agent} service={svcMap[view.agent.id] || null} onServiceChanged={() => { if (API_ON) loadServices(); }} onBack={() => setView({ name: 'list' })} onEdit={a => setView({ name: 'edit', agent: a })} onDiff={a => setView({ name: 'diff', agent: a })} />}
          {nav === 'agents' && view.name === 'diff' && <VersionDiff agent={agents.find(a => a.id === view.agent.id) || view.agent} onBack={() => setView({ name: 'detail', agent: view.agent })} />}
          {nav === 'chat' && <ChatPanel curWs={curWs} isAdmin={isPlatformAdmin} onChanged={() => { if (API_ON) { loadWorkspaces(); loadAgents(curWs); } }} />}
          {nav === 'playground' && <Playground agents={visibleAgents} />}
          {nav === 'members' && <MembersPanel ws={ws} onUpdate={next => setWorkspaces(workspaces.map(w => w.id === next.id ? next : w))} />}
        </Content>
      </Layout>

      <Modal title="新建项目空间" open={createWsOpen} onOk={createWs} onCancel={() => setCreateWsOpen(false)} okText="创建" width={420}>
        <div style={{ margin: '16px 0 4px' }}>
          <div style={{ fontSize: 13, color: '#5A5C6B', marginBottom: 6 }}>空间名称</div>
          <Input placeholder="如：智能营销项目" value={newWsName} onChange={e => setNewWsName(e.target.value)} onPressEnter={createWs} />
          <div style={{ fontSize: 12, color: '#8A8C99', marginTop: 8 }}>创建后你将成为该空间的 Owner</div>
        </div>
      </Modal>
    </Layout>
  );
}

function App() {
  return React.createElement(ConfigProvider, {
    theme: {
      token: { colorPrimary: '#17171C', colorLink: ACCENT, colorLinkHover: '#6E66EA', borderRadius: 8, fontSize: 14, controlHeight: 34, colorBorder: '#E7E7EC', colorBorderSecondary: '#F1F1F5', colorText: '#17171C', colorTextSecondary: '#5A5C6B', fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", Segoe UI, Inter, sans-serif' },
      components: {
        Layout: { bodyBg: '#fff' },
        Menu: { itemBg: 'transparent', itemSelectedBg: '#EEF0FF', itemSelectedColor: ACCENT, itemHeight: 38, itemBorderRadius: 8, itemColor: '#5B5D6B', itemHoverBg: '#F4F4F7', iconSize: 16 },
        Table: { headerBg: '#FAFAFB', headerColor: '#8A8C99', headerSplitColor: 'transparent', borderColor: '#F1F1F5', rowHoverBg: '#FAFAFB', cellPaddingBlock: 9 },
        Button: { primaryShadow: 'none', defaultShadow: 'none', fontWeight: 500, controlHeight: 34, paddingInline: 16 },
        Input: { activeShadow: '0 0 0 3px rgba(79,70,229,0.10)' },
        Segmented: { itemSelectedBg: '#fff', trackBg: '#F1F1F4', itemSelectedColor: '#17171C', itemColor: '#5B5D6B' },
        Tabs: { inkBarColor: ACCENT, itemSelectedColor: ACCENT, itemColor: '#8A8C99' },
        Card: { borderRadiusLG: 8 },
      },
    },
  }, React.createElement(AntApp, null, React.createElement(Root)));
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
