import React, { useState, useMemo, useEffect } from "react";
import {
  ConfigProvider, App as AntApp, Layout, Menu, Button, Table, Input, Select, Card, Tabs,
  Drawer, Checkbox, Tag, Collapse, Descriptions, Modal, Tooltip, Avatar, Dropdown,
  Slider, InputNumber, Popconfirm, Popover, Space, Typography, Empty, Segmented, Divider, theme, message, Spin, Badge, Tree, Upload, Switch, Pagination, DatePicker,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined, SearchOutlined, AppstoreOutlined,
  UserOutlined, TeamOutlined, SendOutlined, ReloadOutlined, ArrowLeftOutlined, DownOutlined,
  RobotOutlined, ToolOutlined, BulbOutlined, CheckOutlined, MessageOutlined, FileTextOutlined,
  SettingOutlined, CloseOutlined, ThunderboltOutlined, SwapOutlined, BranchesOutlined,
  InboxOutlined, FolderOutlined, FileOutlined, EyeOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  ClockCircleOutlined, PlayCircleOutlined, HistoryOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
const { Sider, Content } = Layout;
const { Text } = Typography;
import { ACCENT, FRAMEWORKS, PROVIDERS, MODEL_PARAMS, TOOLS, SKILLS, TEMPLATES, fwName, ISOLATIONS, isoName, TENANT_NOTE, INIT_WORKSPACES, td, now, mkAgent, INIT_AGENTS } from "./config";
import { apiCall, API_BASE, API_ON } from "./api";

export function Section({ title, extra, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: 650, color: '#33333C', letterSpacing: 0.2 }}>{title}</Text>
        {extra}
      </div>
      {children}
    </div>
  );
}
export function Field({ label, required, hint, error, children }) {
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
export function CodeEditor({ value, onChange, rows = 12 }) {
  return (
    <Input.TextArea value={value} onChange={e => onChange(e.target.value)} autoSize={{ minRows: rows, maxRows: 22 }}
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.6, background: '#FCFCFD', color: '#2A2A33' }} />
  );
}

/* ================= 发布结果弹窗（详情/Builder 共用）================= */
export function PublishChooser({ open, agentName, versions, defaultVersion, defaultIso, curIso, onCancel, onConfirm }) {
  const [iso, setIso] = useState(defaultIso || 'L1');
  const [ver, setVer] = useState(defaultVersion);
  // 每次打开时重置为「当前版本 / 当前运行环境」，迁移/回滚时一眼看出从哪改到哪
  React.useEffect(() => { if (open) { setIso(defaultIso || 'L1'); setVer(defaultVersion); } }, [open, defaultIso, defaultVersion]);
  const migrating = curIso && iso !== curIso;
  const hasVers = versions && versions.length > 1;
  const latestVer = hasVers ? Math.max(...versions.map(z => z.version)) : defaultVersion;
  return (
    <Modal title={`发布 Live 版本${agentName ? ' · ' + agentName : ''}`} open={open} onCancel={onCancel}
      okText={migrating ? '迁移并发布' : '发布'} onOk={() => onConfirm(iso, ver)} width={520} destroyOnHidden>
      {hasVers && (
        <div style={{ margin: '4px 0 14px' }}>
          <div style={{ fontSize: 13, color: '#5A5C6B', marginBottom: 6 }}>Live 指向版本</div>
          <Select value={ver} style={{ width: '100%' }} onChange={setVer}
            options={versions.slice().reverse().map(x => ({ value: x.version, label: `v${x.version}${x.version === latestVer ? ' · 最新' : ''} · ${(x.createdAt || '').slice(5)}` }))} />
        </div>
      )}
      <div style={{ fontSize: 13, color: '#5A5C6B', margin: '4px 0 12px' }}>选择运行环境（发布后会启动或替换该 Live 版本的服务实例）{curIso ? <>；当前 <span style={pill('#F1F1F4', '#5A5C6B')}>{isoName(curIso)} · {curIso}</span></> : ''}：</div>
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

export function PublishModal({ pub, agentName, onClose }) {
  // 对外用稳定地址（按 id 经网关路由）；裸端口会变，仅本机调试
  const stable = pub && pub.stable_url ? pub.stable_url : '';
  const internal = pub && (pub.internal_url || pub.service_url) ? (pub.internal_url || pub.service_url) : '';
  const curl = `curl -X POST ${stable} \\\n  -H "Content-Type: application/json" \\\n  -d '{"message":"你好"}'`;
  const curlStream = `curl -N -X POST ${stable}/stream \\\n  -H "Content-Type: application/json" \\\n  -d '{"message":"你好"}'`;
  return (
    <Modal title="已发布" open={!!pub} onCancel={onClose} footer={null} width={560}>
      {pub && (
        <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
          <p>已把 <b>{agentName}</b>（v{pub.version}{pub.isolation ? ' · ' + isoName(pub.isolation) : ''}）写入本机 Claude Code 工作目录：</p>
          <div style={{ background: '#FAFAFB', border: '1px solid #F1F1F5', borderRadius: 6, padding: '8px 12px', fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12.5, marginBottom: 12, wordBreak: 'break-all' }}>{pub.path}</div>
          {internal && (
            <div style={{ background: '#E9F7EF', border: '1px solid #Bfe6cf', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#1E8449' }}>
              ✓ 已作为服务运行。可在 Playground 直接对话，或通过下方稳定 API 调用。
            </div>
          )}
          {stable && (
            <>
              <p style={{ margin: '0 0 6px' }}>通过 API 调用该服务（请求 <Text code style={{ fontSize: 12 }}>{'{message, session_id?}'}</Text>；多轮把返回的 <Text code style={{ fontSize: 12 }}>session_id</Text> 带回）：</p>
              <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#3730A3', marginBottom: 8 }}>
                ⓘ 下面用的是<b>稳定地址</b>（按 id 经网关路由）。重启 / 换版本端口会变，但此地址不变——<b>上游请绑这个，别直连裸端口</b> <Text code style={{ fontSize: 11 }}>{internal}</Text>（仅本机调试）。
              </div>
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
              <div style={{ marginTop: 8, color: '#8A8C99', fontSize: 12 }}>稳定契约：<Text code style={{ fontSize: 12 }}>/api/agents/{'{id}'}/service-chat[/stream]</Text>（按 id 路由，端口是内部细节）</div>
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
export function AssetDrawer({ open, type, selected, onClose, onConfirm, wsId }) {
  const [installed, setInstalled] = useState([]);
  // 本空间「加入平台/注册」的工具/技能：合并进内置清单一起选
  React.useEffect(() => {
    if (!open || !API_ON || !wsId) return;
    apiCall((type === 'tool' ? '/api/tools' : '/api/skills') + '?ws=' + wsId)
      .then(rows => setInstalled((rows || []).map(r => type === 'tool'
        ? { id: r.id, name: r.name, desc: r.summary, cat: r.source === 'custom' ? '本空间 · 自定义 MCP' : '本空间 · MCP', mcp: r.transport === 'http' ? 'Streamable HTTP' : r.transport === 'sse' ? 'SSE' : r.command, ver: '', locked: false }
        : { id: r.id, name: r.name, desc: r.summary, cat: r.source === 'custom' ? '本空间 · 自定义技能' : '本空间 · 技能', locked: false })))
      .catch(() => setInstalled([]));
  }, [open, type, wsId]);
  // 技能与工具都只用「本空间用户注册」的，不再混入内置 mock（mock SKILLS / TOOLS 已弃用）
  const data = useMemo(() => [...installed], [installed]);
  const [sel, setSel] = useState(selected);
  const [kw, setKw] = useState('');
  React.useEffect(() => { setSel(selected); setKw(''); }, [open, selected]);
  const cats = useMemo(() => {
    const map = {};
    data.filter(i => i.name.toLowerCase().includes(kw.toLowerCase())).forEach(i => { (map[i.cat] = map[i.cat] || []).push(i); });
    return map;
  }, [kw, data]);
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
                  borderRadius: 8, marginBottom: 6, cursor: it.locked ? 'not-allowed' : 'pointer', opacity: it.locked ? 0.65 : 1, transition: 'all .15s',
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
export const pill = (bg, color) => ({ background: bg, color, fontSize: 11, padding: '1px 8px', borderRadius: 6, fontWeight: 600 });
// 会话消息的时间戳（后端/前端均以 now() = 'YYYY-MM-DD HH:mm' 落库）→ QA 气泡下只显示 HH:mm
export const msgTime = ts => (ts || '').slice(11, 16);

// AI 回复按 Markdown（GFM：表格/列表/代码/链接 + 软换行）渲染，样式见 .md-body（agent-redesign.css）
// 生 HTML 不解析（未启用 rehype-raw）→ 安全；链接新窗口打开
const MD_REMARK = [remarkGfm, remarkBreaks];
const MD_COMPONENTS = { a: ({ node, ...p }) => <a {...p} target="_blank" rel="noreferrer" /> };
export function Md({ text }) {
  return <div className="md-body"><ReactMarkdown remarkPlugins={MD_REMARK} components={MD_COMPONENTS}>{text || ''}</ReactMarkdown></div>;
}

/* ================= 调试面板 (Spec I · mock) ================= */
// 执行链路通用展示：steps = [{type:'think',text} | {type:'tool',name,input,output,is_error,running} | {type:'info',text}]
// 原生 <details> 折叠，零额外状态；流式与历史回放共用同一结构。
// 工具步骤按名称识别语义：mcp__<server>__<tool> → MCP 徽标；Task → 子代理。
function TraceSteps({ steps }) {
  if (!steps || !steps.length) return null;
  const fmtIn = v => { try { return typeof v === 'string' ? v : JSON.stringify(v, null, 2); } catch { return String(v); } };
  return (
    <div className="trace-block">
      {steps.map((s, i) => {
        if (s.type === 'info') return <div key={i} className="trace-info">{s.text}</div>;
        if (s.type === 'think') return (
          <details key={i} className="trace-step">
            <summary className="trace-summary">
              <span className="trace-caret">▸</span>
              <BulbOutlined style={{ color: '#B45309', fontSize: 12 }} />
              <span className="trace-kind">思考</span>
              <span className="trace-preview">{(s.text || '').replace(/\s+/g, ' ').slice(0, 80)}</span>
            </summary>
            <div className="trace-think-body">{s.text}</div>
          </details>
        );
        // 工具步骤：识别 MCP / 子代理
        const mcp = /^mcp__/.test(s.name || '') ? (s.name || '').split('__') : null; // [mcp, server, tool...]
        const isTask = s.name === 'Task';
        const label = isTask ? '子代理' : mcp ? 'MCP' : '工具';
        const icon = isTask
          ? <RobotOutlined style={{ color: '#2563EB', fontSize: 12 }} />
          : <ToolOutlined style={{ color: '#4F46E5', fontSize: 12 }} />;
        const nameEl = mcp
          ? <><span className="trace-badge trace-badge--mcp">{mcp[1]}</span><span className="trace-tool-name">{mcp.slice(2).join('__')}</span></>
          : <span className="trace-tool-name">{s.name || 'tool'}</span>;
        const taskPreview = isTask && s.input ? String(s.input.description || s.input.prompt || '').replace(/\s+/g, ' ').slice(0, 60) : '';
        return (
          <details key={i} className="trace-step">
            <summary className="trace-summary">
              <span className="trace-caret">▸</span>
              {icon}
              <span className="trace-kind">{label}</span>
              {nameEl}
              {taskPreview && <span className="trace-preview">{taskPreview}</span>}
              {s.running
                ? <span className="trace-status trace-status--run"><Spin size="small" /> 执行中</span>
                : s.is_error
                  ? <span className="trace-status trace-status--err">✕ 失败</span>
                  : s.output != null ? <span className="trace-status trace-status--ok">✓ 完成</span> : null}
            </summary>
            {s.input != null && Object.keys(s.input || {}).length > 0 && (
              <div className="trace-io"><div className="trace-io-label">入参</div><pre>{fmtIn(s.input)}</pre></div>
            )}
            {s.output != null && s.output !== '' && (
              <div className="trace-io"><div className="trace-io-label">结果</div><pre>{s.output}</pre></div>
            )}
          </details>
        );
      })}
    </div>
  );
}

// 用量脚注：↑输入 ↓输出 tokens · 成本 · 耗时 · 模型（有什么显什么）
const fmtTok = n => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));
function UsageLine({ usage, model, stop }) {
  if (!usage && !model && !stop) return null;
  const u = usage || {};
  const parts = [];
  if (u.input_tokens != null || u.output_tokens != null)
    parts.push(`↑${fmtTok(u.input_tokens || 0)} ↓${fmtTok(u.output_tokens || 0)} tok`);
  if (u.cache_read_input_tokens) parts.push(`缓存 ${fmtTok(u.cache_read_input_tokens)}`);
  if (u.cost_usd != null) parts.push(`$${Number(u.cost_usd).toFixed(4)}`);
  if (u.duration_ms != null) parts.push(`${(u.duration_ms / 1000).toFixed(1)}s`);
  if (u.num_turns) parts.push(`${u.num_turns} 轮`);
  if (model) parts.push(model);
  return (
    <span>
      {parts.length > 0 && <span style={{ fontFamily: 'ui-monospace,Menlo,monospace' }}> · {parts.join(' · ')}</span>}
      {stop && <span style={{ color: '#B45309', fontWeight: 600 }}> · ⚠ {stop}</span>}
    </span>
  );
}

export function DebugPanel({ cfg, chatPath, streamPath, initialMsgs, onTurn }) {
  const sysText = API_ON
    ? `调试 · 模型 ${cfg.model || '未选'} · 本机 ${cfg.framework === 'OPENCLAW' ? 'OpenClaw Gateway' : 'Claude Code'} 运行`
    : `调试 · 模型 ${cfg.model || '未选'} · 本地 mock（未连后端）`;
  const [msgs, setMsgs] = useState(initialMsgs && initialMsgs.length ? initialMsgs : [{ role: 'sys', text: sysText }]);
  // cfg 异步加载后刷新自动生成的首条 sys 文案（框架/模型）；不动恢复的历史会话
  useEffect(() => {
    if (initialMsgs && initialMsgs.length) return;
    setMsgs(m => (m.length && m[0].role === 'sys') ? [{ ...m[0], text: sysText }, ...m.slice(1)] : m);
  }, [sysText]);
  const [input, setInput] = useState('');
  const [sid, setSid] = useState(null);
  const [busy, setBusy] = useState(false);
  const composingRef = React.useRef(false);  // 输入法组合中 → Enter 不发送
  const setBot = (text, extra) => setMsgs(m => { const c = [...m]; for (let i = c.length - 1; i >= 0; i--) { if (c[i].role === 'bot') { c[i] = { ...c[i], text, ...(extra || {}) }; break; } } return c; });
  // 更新最后一条 bot 消息的执行链路（fn 原地改 steps 数组副本）
  const upSteps = fn => setMsgs(m => { const c = [...m]; for (let i = c.length - 1; i >= 0; i--) { if (c[i].role === 'bot') { const steps = (c[i].steps || []).map(s => ({ ...s })); fn(steps); c[i] = { ...c[i], steps }; break; } } return c; });
  const finishSteps = () => upSteps(steps => steps.forEach(s => { if (s.running) s.running = false; }));
  const send = async () => {
    if (!input.trim() || busy) return;
    const q = input.trim();
    setMsgs(m => [...m, { role: 'user', text: q, ts: now() }]);
    setInput('');
    if (!API_ON) {
      const toolNote = (cfg.tools && cfg.tools.length) ? `（可调用 ${cfg.tools.length} 个工具）` : '';
      setMsgs(m => [...m, { role: 'bot', text: `「${cfg.name || '未命名 Agent'}」${toolNote}收到：${q}\n\n这是基于当前配置的模拟回复（连上后端即真实运行）。`, ts: now() }]);
      return;
    }
    setBusy(true);
    if (streamPath) {
      // 协议2：SSE 流式
      setMsgs(m => [...m, { role: 'bot', text: '', pending: true, ts: now() }]);
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
            else if (ev === 'think') upSteps(steps => { const last = steps[steps.length - 1]; if (last && last.type === 'think' && !last.done) last.text = (last.text || '') + (d.text || ''); else steps.push({ type: 'think', text: d.text || '' }); });
            else if (ev === 'tool') upSteps(steps => { steps.forEach(s => { if (s.type === 'think') s.done = true; }); steps.push({ type: 'tool', id: d.id, name: d.name, input: d.input, running: true }); });
            else if (ev === 'tool_result') upSteps(steps => { for (let j = steps.length - 1; j >= 0; j--) { if (steps[j].type === 'tool' && steps[j].id === d.id) { steps[j] = { ...steps[j], output: d.output, is_error: !!d.is_error, running: false }; break; } } });
            else if (ev === 'info') upSteps(steps => steps.push({ type: 'info', text: d.text || '' }));
            else if (ev === 'done') { if (d.session_id) setSid(d.session_id); acc = d.reply || acc; finishSteps(); setBot(acc, { pending: false, ...(d.usage ? { usage: d.usage } : {}), ...(d.model ? { model: d.model } : {}), ...(d.stop ? { stop: d.stop } : {}) }); }
            else if (ev === 'error') { finishSteps(); setBot('错误：' + (d.reply || ''), { pending: false, err: true }); }
          }
        }
        if (!acc) setBot('(空响应)', { pending: false });
      } catch (e) { finishSteps(); setBot('调用失败：' + e.message, { pending: false, err: true }); }
      finally { setBusy(false); onTurn && onTurn(); }
      return;
    }
    // 协议1：一次性 JSON
    setMsgs(m => [...m, { role: 'bot', text: '运行中…', pending: true, ts: now() }]);
    try {
      const d = await apiCall(chatPath || `/api/agents/${cfg.id || 'new'}/chat`, { method: 'POST', body: JSON.stringify({ message: q, config: cfg, session_id: sid }) });
      if (d.session_id) setSid(d.session_id);
      setMsgs(m => m.filter(x => !x.pending).concat({ role: 'bot', text: d.reply || '(空响应)', err: d.engine === 'error', ...(d.steps && d.steps.length ? { steps: d.steps } : {}), ...(d.usage ? { usage: d.usage } : {}), ...(d.model ? { model: d.model } : {}), ...(d.stop ? { stop: d.stop } : {}), ts: now() }));
    } catch (e) {
      setMsgs(m => m.filter(x => !x.pending).concat({ role: 'bot', text: '调用失败：' + e.message, err: true, ts: now() }));
    } finally { setBusy(false); onTurn && onTurn(); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`@keyframes pgBlink{0%,100%{opacity:1}50%{opacity:0}}@keyframes pgBounce{0%,80%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-4px);opacity:1}}.pg-caret{animation:pgBlink 1s steps(1) infinite;color:#8A8C99;margin-left:1px}.pg-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#9A9CAA;margin:0 2px;animation:pgBounce 1.2s infinite}`}</style>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 2px' }}>
        {msgs.map((m, i) => m.role === 'sys' ? (
          <div key={i} style={{ textAlign: 'center', fontSize: 12, color: '#8A8C99', margin: '8px 0 16px' }}>{m.text}</div>
        ) : (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            {m.role === 'bot' && <TraceSteps steps={m.steps} />}
            <div style={{
              maxWidth: '82%', padding: '10px 13px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6,
              background: m.role === 'user' ? ACCENT : '#F4F4F7', color: m.role === 'user' ? '#fff' : (m.err ? '#D4380D' : '#2A2A33'),
              borderBottomRightRadius: m.role === 'user' ? 3 : 12, borderBottomLeftRadius: m.role === 'bot' ? 3 : 12,
            }}>
              {m.role === 'bot' && m.pending && !m.text
                ? ((m.steps || []).length
                    ? <span style={{ color: '#8A8C99', fontSize: 12.5 }}>执行中…（上方为实时链路）</span>
                    : <span style={{ display: 'inline-flex', alignItems: 'center' }} aria-label="正在回复"><span className="pg-dot" style={{ animationDelay: '0s' }} /><span className="pg-dot" style={{ animationDelay: '.18s' }} /><span className="pg-dot" style={{ animationDelay: '.36s' }} /></span>)
                : m.role === 'bot'
                    ? <><Md text={m.text} />{m.pending ? <span className="pg-caret">▋</span> : null}</>
                    : <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>}
            </div>
            {(msgTime(m.ts) || m.usage || m.model || m.stop) && (
              <div style={{ fontSize: 11, color: '#94A3B8', margin: '4px 2px 0' }}>
                {msgTime(m.ts)}
                {m.role === 'bot' && <UsageLine usage={m.usage} model={m.model} stop={m.stop} />}
              </div>
            )}
          </div>
        ))}
      </div>
      {busy && <div style={{ fontSize: 12, color: '#8A8C99', padding: '0 2px 8px', display: 'flex', alignItems: 'center', gap: 6 }}><Spin size="small" /> Agent 正在回复…（请等本轮结束）</div>}
      <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid #F1F1F5' }}>
        <Input placeholder={busy ? '回复中，请稍候…' : '输入消息，试跑当前 Agent…'} value={input} disabled={busy}
          onChange={e => setInput(e.target.value)}
          onCompositionStart={() => (composingRef.current = true)}
          onCompositionEnd={() => (composingRef.current = false)}
          onPressEnter={e => { if (composingRef.current || e.nativeEvent?.isComposing || e.keyCode === 229) return; send(); }} />
        <Button type="primary" icon={<SendOutlined />} loading={busy} disabled={busy} onClick={send} />
      </div>
    </div>
  );
}

/* ================= Builder：创建/编辑 (Spec A/B/C + I) ================= */
export function AgentBuilder({ mode, agent, onCancel, onSave, onCreate, onPublished, wsId }) {
  const isEdit = mode === 'edit';
  const init = agent || {};
  const ws = wsId || init.wsId;
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
  const [createdAgent, setCreatedAgent] = useState(null); // 「创建并发布」时先创建得到的 agent
  const pubTarget = agent || createdAgent;                 // 编辑态=既有 agent；创建态=刚创建的 agent
  const askPublish = () => { if (!API_ON) { message.info('发布需先在本机启动后端'); return; } setChoose(true); };
  const doPublish = async (iso) => {
    setChoose(false);
    if (!pubTarget) return;
    try {
      // 发布 = 把当前配置存为新版本(有改动才升版本)并发布；iso=运行环境/隔离级别
      const r = await apiCall(`/api/agents/${pubTarget.id}/publish?isolation=${iso || 'L1'}`, { method: 'POST', body: JSON.stringify({ config: cfg }) });
      setPub(r);
      if (onPublished) onPublished();
    } catch (e) { message.error('发布失败：' + e.message); }
  };
  // 「创建并发布」：先创建 v1（停留在 Builder）拿到 id，再选运行环境发布
  const createAndPublish = async () => {
    if (!canSave) return;
    if (!API_ON) { message.info('发布需先在本机启动后端，已仅创建草稿'); onSave(cfg); return; }
    const a = await onCreate(cfg);
    if (!a) return;
    setCreatedAgent(a);
    setChoose(true);
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
      {/* 顶栏：返回 + 名称/描述 ……… 预览/调试 + 主操作（拆分按钮，永不换行） */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: '1px solid #F1F1F5', marginBottom: 12 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onCancel} />
        <div style={{ minWidth: 0, maxWidth: 480 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Input variant="borderless" value={name} disabled={isEdit} maxLength={50} placeholder="未命名 Agent"
              onChange={e => setName(e.target.value)} style={{ fontSize: 18, fontWeight: 750, padding: 0, width: 300, color: '#17171C' }} />
            {isEdit && <span style={pill('#F1F1F4', '#5A5C6B')}>v{agent.version}</span>}
            {nameErr && <span style={{ fontSize: 12, color: '#E5484D' }}>{nameErr}</span>}
          </div>
          <Input variant="borderless" value={desc} placeholder="添加描述…" onChange={e => setDesc(e.target.value)}
            style={{ fontSize: 12.5, padding: 0, color: '#8A8C99' }} />
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <Tooltip title="配置预览"><Button icon={<FileTextOutlined />} type={panel === 'preview' ? 'primary' : 'default'} onClick={() => togglePanel('preview')} /></Tooltip>
          <Button icon={<MessageOutlined />} type={panel === 'debug' ? 'primary' : 'default'} onClick={() => togglePanel('debug')}>调试</Button>
          {isEdit
            ? <Dropdown.Button type="primary" disabled={!canSave} icon={<DownOutlined />} onClick={() => onSave(cfg)}
                menu={{ items: [{ key: 'pub', label: '保存并发布', onClick: askPublish }] }}>保存为新版本</Dropdown.Button>
            : <Dropdown.Button type="primary" disabled={!canSave} icon={<DownOutlined />} onClick={createAndPublish}
                menu={{ items: [{ key: 'draft', label: '仅创建草稿（暂不上线）', onClick: () => onSave(cfg) }] }}>创建并发布</Dropdown.Button>}
        </div>
      </div>

      {/* 元信息条：框架 / 模型 / 参数 —— 与编辑器分区，腾出顶栏空间 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, paddingBottom: 12, borderBottom: '1px solid #F1F1F5', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, color: '#8A8C99' }}>框架</span>
          <Segmented size="small" value={framework} onChange={pickFramework} disabled={isEdit}
            options={FRAMEWORKS.map(f => ({ value: f.key, disabled: !f.enabled,
              label: <Tooltip title={f.enabled ? '' : (f.tip || '未开放')}><span>{f.name}</span></Tooltip> }))} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, color: '#8A8C99' }}>模型</span>
          <Select value={model} placeholder="选择模型 *" style={{ width: 200 }} options={PROVIDERS} onChange={setModel}
            showSearch optionFilterProp="label" status={!model ? 'warning' : ''} />
        </div>
        <Popover trigger="click" placement="bottomLeft" title="模型参数" content={paramsContent}>
          <Button icon={<SettingOutlined />} disabled={!model}>参数</Button>
        </Popover>
      </div>

      {/* 主区：配置编辑器为重点 + 可收起的右侧面板 */}
      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
        <div style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
          <div style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 8, padding: 20, marginBottom: 16 }}>
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

          <div style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 8, padding: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: 650, color: '#33333C' }}>能力</Text>
            <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ color: '#5A5C6B', fontSize: 13 }}><ToolOutlined /> 工具</span>
                  <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => setDrawer('tool')}>添加</Button>
                </div>
                <div>{tools.length === 0 ? <Text style={{ color: '#A6A8B4', fontSize: 12 }}>未选择</Text> :
                  tools.map(id => { const t = TOOLS.find(x => x.id === id); return <Tag key={id} closable bordered={false} onClose={() => setTools(tools.filter(x => x !== id))} style={{ marginBottom: 6, background: '#EEF0FF', color: ACCENT }}>{(t && t.name) || id}</Tag>; })}</div>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ color: '#5A5C6B', fontSize: 13 }}><BulbOutlined /> 技能</span>
                  <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => setDrawer('skill')}>添加</Button>
                </div>
                <div>{skills.length === 0 ? <Text style={{ color: '#A6A8B4', fontSize: 12 }}>未选择</Text> :
                  skills.map(id => { const s = SKILLS.find(x => x.id === id); return <Tag key={id} closable bordered={false} onClose={() => setSkills(skills.filter(x => x !== id))} style={{ marginBottom: 6, background: '#F1F1F4', color: '#4A4A55' }}>{(s && s.name) || id}</Tag>; })}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧面板：默认收起，按需展开 */}
        {panel && (
          <div style={{ width: 400, background: '#fff', border: '1px solid #EBEBF1', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontWeight: 650, fontSize: 14 }}>{panel === 'debug' ? '调试 · 试跑当前配置' : '配置预览'}</Text>
              <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setPanel(null)} />
            </div>
            {panel === 'debug'
              ? <div style={{ flex: 1, minHeight: 0, height: 'calc(100vh - 220px)' }}><DebugPanel cfg={cfg} /></div>
              : <div>
                  <Segmented size="small" options={['JSON', 'YAML']} value={previewFmt} onChange={setPreviewFmt} style={{ marginBottom: 10 }} />
                  <pre style={{ background: '#FAFAFC', border: '1px solid #F1F1F5', color: '#33333C', padding: 14, borderRadius: 8, fontSize: 12.5, lineHeight: 1.6, maxHeight: 'calc(100vh - 280px)', overflow: 'auto', fontFamily: 'ui-monospace, Menlo, monospace' }}>{previewText}</pre>
                </div>}
          </div>
        )}
      </div>

      <AssetDrawer open={drawer === 'tool'} type="tool" wsId={ws} selected={tools} onClose={() => setDrawer(null)} onConfirm={s => { setTools(s); setDrawer(null); }} />
      <AssetDrawer open={drawer === 'skill'} type="skill" wsId={ws} selected={skills} onClose={() => setDrawer(null)} onConfirm={s => { setSkills(s); setDrawer(null); }} />
      {/* 创建态取消环境选择：v1 已建为草稿，回列表即可看到（未发布） */}
      <PublishChooser open={choose} agentName={name} onCancel={() => { setChoose(false); if (!isEdit && createdAgent) onCancel(); }} onConfirm={doPublish} />
      {/* 创建态发布完成后关闭弹窗即回列表 */}
      <PublishModal pub={pub} agentName={name} onClose={() => { setPub(null); if (!isEdit && createdAgent) onCancel(); }} />
    </div>
  );
}

/* ================= 详情 (Spec A) ================= */
export function AgentDetail({ agent, service, onServiceChanged, onBack, onEdit, onDiff }) {
  const [viewVer, setViewVer] = useState(agent.version);  // 配置卡查看的版本（默认最新）
  const [play, setPlay] = useState(false);
  const [pub, setPub] = useState(null);
  const [choose, setChoose] = useState(false);
  const [pubVer, setPubVer] = useState(agent.version);    // 发布弹窗预选版本
  const [showApi, setShowApi] = useState(false);          // 调用示例默认折叠
  // —— 两个层次：发布(哪份配置上线) / 启动·停服(实例开不开) ——
  const deploying = service && service.status === 'deploying';
  const failed = service && service.status === 'failed';
  const running = service && !deploying && !failed;
  const liveIso = (service && service.isolation) || agent.publishedIsolation || 'L1';
  const liveVer = running ? service.version : agent.publishedVersion;

  const askPublish = (v) => { if (!API_ON) { antMsg.info('发布需先在本机启动后端'); return; } setPubVer(v || agent.publishedVersion || agent.version); setChoose(true); };
  const doPublish = async (iso, version) => {
    setChoose(false);
    try { setPub(await apiCall(`/api/agents/${agent.id}/publish?version=${version}&isolation=${iso || 'L1'}`, { method: 'POST' })); onServiceChanged && onServiceChanged(); }
    catch (e) { antMsg.error('发布失败：' + e.message); }
  };
  // 启动 = 用「已发布版本 + 原隔离级别」一键拉起实例（不重新发布、不弹弹窗）
  const startPublished = async () => {
    if (!API_ON) { antMsg.info('启动需先在本机启动后端'); return; }
    try { await apiCall(`/api/agents/${agent.id}/publish?version=${agent.publishedVersion}&isolation=${agent.publishedIsolation || 'L1'}`, { method: 'POST' }); antMsg.success(`已启动（v${agent.publishedVersion} · ${isoName(agent.publishedIsolation || 'L1')}）`); onServiceChanged && onServiceChanged(); }
    catch (e) { antMsg.error('启动失败：' + e.message); }
  };
  const stopService = async () => {
    try { await apiCall(`/api/agents/${agent.id}/service/stop`, { method: 'POST' }); antMsg.success('已停服（已发布配置保留，稳定地址不变）'); onServiceChanged && onServiceChanged(); }
    catch (e) { antMsg.error('停服失败：' + e.message); }
  };
  const copy = x => { navigator.clipboard && navigator.clipboard.writeText(x); antMsg.success('已复制'); };

  const stablePath = `/api/agents/${agent.id}/service-chat`;
  const stableBase = service ? (service.stable_url || (location.origin + stablePath)) : '';
  const svcCurl = `curl -X POST ${stableBase} \\\n  -H "Content-Type: application/json" \\\n  -d '{"message":"你好"}'`;
  const svcCurlStream = `curl -N -X POST ${stableBase}/stream \\\n  -H "Content-Type: application/json" \\\n  -d '{"message":"你好"}'`;
  // 兼容：列表项可能不带 versions，缺省用自身配置兜底
  const versions = (agent.versions && agent.versions.length) ? agent.versions
    : [{ version: agent.version || 1, createdAt: agent.updatedAt || '', config: agent }];
  const isLatest = viewVer === agent.version;
  const vc = (versions.find(v => v.version === viewVer) || {}).config || agent;
  const fileKeys = Object.keys(vc.files || {});
  // 顶部单一状态徽章
  const statusPill = !agent.published && !service ? <span style={pill('#F1F1F4', '#A6A8B4')}>○ 未发布</span>
    : deploying ? <span style={pill('#FFF8E6', '#946C00')}>◌ 部署中</span>
    : failed ? <Tooltip title={service.error || ''}><span style={pill('#FDECEC', '#C0392B')}>✕ 部署失败</span></Tooltip>
    : running ? <span style={pill('#E9F7EF', '#1E8449')}>● 运行中</span>
    : <span style={pill('#F1F1F4', '#A6A8B4')}>○ 已停止</span>;
  const codeBlock = { flex: 1, background: '#0f1115', color: '#a7f3d0', padding: '10px 12px', borderRadius: 8, fontSize: 12, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0 };
  return (
    <div style={{ maxWidth: 920 }}>
      {/* 顶栏：名称 + 框架 + 单一状态 + 试跑/编辑 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Space size={10}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} />
          <span style={{ fontSize: 18, fontWeight: 750 }}>{agent.name}</span>
          <span style={pill('#EEF0FF', '#4F46E5')}>{fwName(agent.framework)}</span>
          {statusPill}
        </Space>
        <Space>
          <Button icon={<ThunderboltOutlined />} onClick={() => setPlay(true)}>试跑</Button>
          <Button type="primary" icon={<EditOutlined />} onClick={() => onEdit(agent)}>编辑</Button>
        </Space>
      </div>

      <PublishChooser open={choose} agentName={agent.name}
        versions={versions} defaultVersion={pubVer}
        defaultIso={liveIso} curIso={agent.published ? liveIso : null}
        onCancel={() => setChoose(false)} onConfirm={doPublish} />
      <PublishModal pub={pub} agentName={agent.name} onClose={() => setPub(null)} />

      {/* ① 运行卡片：状态 + 操作 + 调用方式 */}
      <div style={{ background: '#fff', border: '1px solid #ECECEF', borderRadius: 10, padding: '14px 18px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13.5 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>运行</span>
            {!agent.published && !service
              ? <span style={{ color: '#8A8C99' }}>未发布 —— 发布后即可通过稳定 API 调用</span>
              : <>
                  <span style={pill('#F1F1F4', '#5A5C6B')}>v{liveVer}</span>
                  <span style={pill('#F1F1F4', '#5A5C6B')}>{isoName(liveIso)} · {liveIso}</span>
                  {service && (service.location === 'cloud'
                    ? <span style={pill('#EEF0FF', '#4F46E5')}>☁ 云端</span>
                    : <span style={pill('#F1F1F4', '#5A5C6B')}>本地</span>)}
                  {deploying && <span style={{ color: '#946C00', fontSize: 12.5 }}>部署中…（云端约 1–2 分钟）</span>}
                </>}
          </div>
          <Space>
            {!agent.published && !service
              ? <Button type="primary" onClick={() => askPublish()}>发布</Button>
              : deploying
                ? <Button loading disabled>部署中</Button>
                : failed
                  ? <Button type="primary" onClick={() => askPublish()}>重新发布</Button>
                  : running
                    ? <>
                        <Tooltip title="换版本 / 换运行环境（本地↔云端）重新发布"><Button onClick={() => askPublish()}>更改发布…</Button></Tooltip>
                        <Popconfirm title="停止该 Agent 服务？" description="仅停实例，已发布配置与稳定地址保留" onConfirm={stopService}><Button danger>停服</Button></Popconfirm>
                      </>
                    : <>
                        <Tooltip title={`用已发布的 v${agent.publishedVersion} · ${isoName(agent.publishedIsolation || 'L1')} 原样拉起`}><Button type="primary" onClick={startPublished}>启动</Button></Tooltip>
                        <Tooltip title="换版本 / 换运行环境（本地↔云端）重新发布"><Button onClick={() => askPublish()}>更改发布…</Button></Tooltip>
                      </>}
          </Space>
        </div>

        {running && (
          <div style={{ marginTop: 12, borderTop: '1px solid #F4F4F7', paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, color: '#8A8C99' }}>调用地址</span>
              <Text code style={{ fontSize: 12 }}>{stablePath}</Text>
              <a onClick={() => copy(stableBase)} style={{ fontSize: 12, color: ACCENT }}>复制</a>
              <span style={{ flex: 1 }} />
              <a onClick={() => setShowApi(s => !s)} style={{ fontSize: 12, color: ACCENT }}>{showApi ? '收起调用示例' : '查看调用示例'}</a>
            </div>
            {showApi && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: '#8A8C99', marginBottom: 8 }}>请求 <Text code style={{ fontSize: 11.5 }}>{'{message, session_id?}'}</Text>；多轮把返回的 session_id 带回。按 id 路由的<b>稳定地址</b>，端口是内部细节、勿直连。</div>
                <div style={{ fontSize: 12, color: '#5A5C6B', margin: '4px 0' }}>① 一次性 → <Text code style={{ fontSize: 11.5 }}>{'{reply, session_id}'}</Text></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <pre style={codeBlock}>{svcCurl}</pre>
                  <Button size="small" onClick={() => copy(svcCurl)}>复制</Button>
                </div>
                <div style={{ fontSize: 12, color: '#5A5C6B', margin: '10px 0 4px' }}>② SSE 流式 → <Text code style={{ fontSize: 11.5 }}>text/event-stream</Text>（delta/done/error）</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <pre style={codeBlock}>{svcCurlStream}</pre>
                  <Button size="small" onClick={() => copy(svcCurlStream)}>复制</Button>
                </div>
              </div>
            )}
          </div>
        )}
        {agent.framework === 'OPENCLAW' && agent.published && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#4F46E5', background: '#EEF0FF', border: '1px solid #C7CBF5', borderRadius: 6, padding: '6px 10px' }}>
            OpenClaw 由平台共享 Gateway 托管（按 agentId 路由）；本机未装 openclaw 时回退 mock。
          </div>
        )}
      </div>

      {/* ② 配置卡片：默认看最新，历史版本可在此切换 */}
      <div style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
          <Space size={8}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>配置</span>
            <span style={pill(isLatest ? '#EEF0FF' : '#FFF3DC', isLatest ? '#4F46E5' : '#946C00')}>v{viewVer}{isLatest ? ' · 最新' : ' · 历史·只读'}</span>
            {liveVer === viewVer && agent.published && <span style={pill('#E9F7EF', '#1E8449')}>当前发布</span>}
          </Space>
          <Space size={6}>
            {!isLatest && <Button size="small" onClick={() => askPublish(viewVer)}>以此版本发布</Button>}
            {versions.length > 1 && <Button size="small" onClick={() => onDiff(agent)}>对比版本</Button>}
            {versions.length > 1 && <Select size="small" value={viewVer} style={{ width: 160 }} onChange={setViewVer}
              options={versions.slice().reverse().map(v => ({ value: v.version, label: `v${v.version}${v.version === agent.version ? ' · 最新' : ''} · ${(v.createdAt || '').slice(5)}` }))} />}
          </Space>
        </div>
        <Descriptions column={2} size="small" colon={false} labelStyle={{ color: '#8A8C99', fontSize: 13, width: 56 }} contentStyle={{ fontSize: 13.5 }}
          items={[
            { label: '描述', children: vc.desc || '—', span: 2 },
            { label: '模型', children: <Text code>{vc.model}</Text> },
            { label: '参数', children: `温度 ${vc.params ? vc.params.temperature : '—'} · MaxTokens ${vc.params ? vc.params.max_tokens : '—'}` },
            { label: '工具', span: 2, children: (vc.tools && vc.tools.length) ? vc.tools.map(id => <Tag key={id} bordered={false} style={{ background: '#EEF0FF', color: ACCENT }}>{(TOOLS.find(t => t.id === id) || {}).name || id}</Tag>) : '—' },
            { label: '技能', span: 2, children: (vc.skills && vc.skills.length) ? vc.skills.map(id => <Tag key={id} bordered={false} style={{ background: '#F1F1F4', color: '#4A4A55' }}>{(SKILLS.find(s => s.id === id) || {}).name || id}</Tag>) : '—' },
          ]} />
        <Divider style={{ margin: '14px 0 12px' }} />
        <Text style={{ fontSize: 13, fontWeight: 650, color: '#33333C' }}>配置文件</Text>
        <div style={{ marginTop: 12 }}>
          <Collapse activeKey={fileKeys} items={fileKeys.map(k => ({ key: k, label: k,
            children: <pre style={{ background: '#FAFAFC', border: '1px solid #F1F1F5', color: '#33333C', padding: 14, borderRadius: 8, fontSize: 12.5, lineHeight: 1.6, overflow: 'auto', fontFamily: 'ui-monospace, Menlo, monospace', margin: 0 }}>{vc.files[k]}</pre> }))} />
        </div>
      </div>

      <Drawer title={`试跑 · ${agent.name}（v${viewVer}）`} width={440} open={play} onClose={() => setPlay(false)}
        styles={{ header: { borderBottom: '1px solid #F1F1F5' }, body: { display: 'flex', flexDirection: 'column' } }}>
        <div style={{ flex: 1, minHeight: 0 }}><DebugPanel cfg={vc} /></div>
      </Drawer>
    </div>
  );
}

/* ================= 工作台（方案A：创作+查看+运维+试跑 合一） ================= */
export function AgentWorkbench({ mode, agent: agentProp, services, wsId, onBack, onCreate, onSaveStay, onChanged, onDiff }) {
  const [savedAgent, setSavedAgent] = useState(agentProp || null); // 已保存的完整 agent（含 versions）
  const isCreate = !savedAgent;
  const ws = wsId || (agentProp && agentProp.wsId);
  // —— 可编辑配置态 ——
  const base = agentProp || {};
  const [framework, setFramework] = useState(base.framework || 'CLAUDE_CODE');
  const [name, setName] = useState(base.name || '');
  const [desc, setDesc] = useState(base.desc || '');
  const [model, setModel] = useState(base.model);
  const [params, setParams] = useState(base.params || { temperature: 0.7, max_tokens: 4096 });
  const [files, setFiles] = useState(base.files ? { ...base.files } : { ...TEMPLATES['CLAUDE_CODE'] });
  const [tools, setTools] = useState(base.tools || []);
  const [skills, setSkills] = useState(base.skills || []);
  const [activeFile, setActiveFile] = useState(Object.keys(base.files || TEMPLATES['CLAUDE_CODE'])[0]);
  const [drawer, setDrawer] = useState(null);
  const [pub, setPub] = useState(null);
  const [choose, setChoose] = useState(false);
  const [pubVer, setPubVer] = useState(base.version || 1);
  const [showApi, setShowApi] = useState(false);
  const [testTarget, setTestTarget] = useState('draft'); // draft（试当前配置）| live（试线上服务）
  const [histOpen, setHistOpen] = useState(false);       // 版本历史抽屉
  const cfg = { name, desc, framework, model, params, files, tools, skills };
  const fileKeys = Object.keys(TEMPLATES[framework]);

  // 拉取完整 agent（含 versions）兜底
  React.useEffect(() => {
    if (!savedAgent || !API_ON || savedAgent.versions) return;
    apiCall(`/api/agents/${savedAgent.id}`).then(full => setSavedAgent(s => ({ ...s, ...full }))).catch(() => {});
  }, [savedAgent && savedAgent.id]);
  const refetch = () => { if (savedAgent && API_ON) apiCall(`/api/agents/${savedAgent.id}`).then(full => setSavedAgent(s => ({ ...s, ...full }))).catch(() => {}); };

  // —— 运行态机 ——
  // 按当前 savedAgent.id 实时解析运行服务：创建页发布后也能立刻显示「运行中」（修复创建页 service 被写死为 null 的 bug）
  const service = (savedAgent && services) ? (services.find(s => s.agentId === savedAgent.id) || null) : null;
  const deploying = service && service.status === 'deploying';
  const failed = service && service.status === 'failed';
  const running = service && !deploying && !failed;
  const published = savedAgent && savedAgent.published;
  const liveIso = (service && service.isolation) || (savedAgent && savedAgent.publishedIsolation) || 'L1';
  const liveVer = running ? service.version : (savedAgent && savedAgent.publishedVersion);
  const versions = (savedAgent && savedAgent.versions && savedAgent.versions.length) ? savedAgent.versions : (savedAgent ? [{ version: savedAgent.version || 1, createdAt: savedAgent.updatedAt || '', config: savedAgent }] : []);

  const baseline = savedAgent ? { name: savedAgent.name, desc: savedAgent.desc, framework: savedAgent.framework, model: savedAgent.model, params: savedAgent.params, files: savedAgent.files, tools: savedAgent.tools, skills: savedAgent.skills } : null;
  const nameErr = name && (name.length < 2 || name.length > 50) ? '名称需 2-50 字符' : '';
  const dirty = isCreate || JSON.stringify(cfg) !== JSON.stringify(baseline);
  const canSave = name && !nameErr && model && dirty;

  const pickFramework = key => { setFramework(key); if (isCreate) { setFiles({ ...TEMPLATES[key] }); setActiveFile(Object.keys(TEMPLATES[key])[0]); } };
  // 把某历史版本载入编辑器（head）：编辑后保存即生成新版本（= 回滚为新版本）
  const loadVersion = v => { const vc = (versions.find(x => x.version === v) || {}).config; if (!vc) return; setModel(vc.model); setDesc(vc.desc || ''); setParams(vc.params || params); setFiles({ ...vc.files }); setTools(vc.tools || []); setSkills(vc.skills || []); setActiveFile(Object.keys(vc.files || {})[0]); };

  // —— 保存 / 创建 / 发布 / 启停 ——
  const saveVersion = async () => { const a = await onSaveStay(savedAgent, cfg); if (a) setSavedAgent(a); return a; };
  const createDraft = async () => { const a = await onCreate(cfg); if (a) { setSavedAgent(a); onChanged && onChanged(); } return a; };
  const primarySave = async () => { if (isCreate) { const a = await createDraft(); if (a) askPublish(a.version, a); } else { const a = await saveVersion(); if (a) askPublish(a.version, a); } };
  const askPublish = (v, a) => { if (!API_ON) { antMsg.info('发布需先在本机启动后端'); return; } setPubVer(v || liveVer || (savedAgent && savedAgent.version) || 1); setChoose(true); };
  const doPublish = async (iso, version) => {
    setChoose(false); const tgt = savedAgent; if (!tgt) return;
    try { setPub(await apiCall(`/api/agents/${tgt.id}/publish?version=${version}&isolation=${iso || 'L1'}`, { method: 'POST', body: '{}' })); onChanged && onChanged(); refetch(); }
    catch (e) { antMsg.error('发布失败：' + e.message); }
  };
  const startPublished = async () => { if (!API_ON || !savedAgent) return; try { await apiCall(`/api/agents/${savedAgent.id}/publish?version=${savedAgent.publishedVersion}&isolation=${savedAgent.publishedIsolation || 'L1'}`, { method: 'POST', body: '{}' }); antMsg.success(`已启动（v${savedAgent.publishedVersion} · ${isoName(savedAgent.publishedIsolation || 'L1')}）`); onChanged && onChanged(); refetch(); } catch (e) { antMsg.error('启动失败：' + e.message); } };
  const stopService = async () => { if (!savedAgent) return; try { await apiCall(`/api/agents/${savedAgent.id}/service/stop`, { method: 'POST' }); antMsg.success('已停服（已发布配置保留，稳定地址不变）'); onChanged && onChanged(); refetch(); } catch (e) { antMsg.error('停服失败：' + e.message); } };

  const stablePath = savedAgent ? `/api/agents/${savedAgent.id}/service-chat` : '';
  const stableBase = service ? (service.stable_url || (location.origin + stablePath)) : '';
  const copy = x => { navigator.clipboard && navigator.clipboard.writeText(x); antMsg.success('已复制'); };
  const codeBlock = { flex: 1, background: '#0f1115', color: '#a7f3d0', padding: '9px 11px', borderRadius: 7, fontSize: 11.5, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0 };

  const statusPill = !published && !service ? <span style={pill('#F1F1F4', '#A6A8B4')}>○ 未发布</span>
    : deploying ? <span style={pill('#FFF8E6', '#946C00')}>◌ 部署中</span>
    : failed ? <Tooltip title={service.error || ''}><span style={pill('#FDECEC', '#C0392B')}>✕ 失败</span></Tooltip>
    : running ? <span style={pill('#E9F7EF', '#1E8449')}>● 运行中</span>
    : <span style={pill('#F1F1F4', '#A6A8B4')}>○ 已停止</span>;

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
    </div>
  );

  const svcCurl = `curl -X POST ${stableBase} \\\n  -H "Content-Type: application/json" \\\n  -d '{"message":"你好"}'`;
  const svcCurlStream = `curl -N -X POST ${stableBase}/stream \\\n  -H "Content-Type: application/json" \\\n  -d '{"message":"你好"}'`;
  const testCfg = { ...cfg, id: savedAgent && savedAgent.id };

  return (
    <div className="agent-workbench" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 顶栏：名称 + 状态 ……… 版本 + 保存 */}
      <div className="agent-workbench-top" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: '1px solid #F1F1F5', marginBottom: 12 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} />
        <Input className="agent-workbench-title" variant="borderless" value={name} disabled={!isCreate} maxLength={50} placeholder="未命名 Agent"
          onChange={e => setName(e.target.value)} style={{ fontSize: 18, fontWeight: 750, padding: 0, width: 240, color: '#17171C', flexShrink: 0 }} />
        <span style={pill('#EEF0FF', '#4F46E5')}>{fwName(framework)}</span>
        {!isCreate && statusPill}
        {nameErr && <span style={{ fontSize: 12, color: '#E5484D' }}>{nameErr}</span>}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {!isCreate && (
            <>
              <span style={pill('#F1F1F4', '#5A5C6B')}>Head v{savedAgent.version}</span>
              <Button size="small" icon={<BranchesOutlined />} onClick={() => setHistOpen(true)}>版本与回滚{versions.length > 1 ? ` · ${versions.length}` : ''}</Button>
            </>
          )}
          {isCreate
            ? <Button type="primary" disabled={!canSave} onClick={createDraft}>创建 Agent</Button>
            : <Button type="primary" disabled={!canSave} onClick={saveVersion}>保存为新版本</Button>}
        </div>
      </div>

      {/* 主体：中（配置编辑）+ 右（运行 & 试跑） */}
      <div className="agent-workbench-body" style={{ flex: 1, display: 'flex', gap: 14, minHeight: 0 }}>
        {/* 中：配置 */}
        <div className="agent-config-scroll" style={{ flex: 1, overflow: 'auto', minWidth: 0, paddingRight: 2 }}>
          {/* 元信息条：描述 + 框架/模型/参数 同一行；控件自带含义，去掉冗余文字标签以容纳一行；窄屏时整组控件换行而不拆分 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
            <Input variant="borderless" value={desc} placeholder="添加描述…" onChange={e => setDesc(e.target.value)} style={{ fontSize: 13, padding: 0, color: '#8A8C99', flex: '1 1 160px', minWidth: 130 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
              {/* 框架只在创建时可选；打开已有 agent 时框架只读，顶栏已有框架标记，这里不再重复占位 */}
              {isCreate && <Segmented size="small" value={framework} onChange={pickFramework}
                options={FRAMEWORKS.map(f => ({ value: f.key, disabled: !f.enabled, label: <Tooltip title={f.enabled ? '' : (f.tip || '未开放')}><span>{f.name}</span></Tooltip> }))} />}
              <Select value={model} placeholder="选择模型 *" style={{ width: 170 }} options={PROVIDERS} onChange={setModel} showSearch optionFilterProp="label" status={!model ? 'warning' : ''} />
              <Popover trigger="click" placement="bottomRight" title="模型参数" content={paramsContent}>
                <Button icon={<SettingOutlined />} disabled={!model}>参数</Button>
              </Popover>
            </div>
          </div>

          <div className="agent-panel agent-panel--pad" style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 8, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text className="agent-section-title" style={{ fontSize: 13, fontWeight: 650, color: '#33333C' }}>指令文件 · {fwName(framework)}</Text>
              <Button size="small" type="text" style={{ color: ACCENT }} onClick={() => setFiles({ ...TEMPLATES[framework] })}>重置为模板</Button>
            </div>
            {fileKeys.length > 1 ? (
              <Tabs activeKey={activeFile} onChange={setActiveFile} size="small"
                items={fileKeys.map(k => ({ key: k, label: <span>{k}{files[k] && files[k].trim() ? <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: ACCENT, marginLeft: 6, verticalAlign: 'middle' }} /> : null}</span>,
                  children: <CodeEditor value={files[k] || ''} onChange={v => setFiles({ ...files, [k]: v })} rows={16} /> }))} />
            ) : <CodeEditor value={files[fileKeys[0]] || ''} onChange={v => setFiles({ ...files, [fileKeys[0]]: v })} rows={16} />}
          </div>

          <div className="agent-panel agent-panel--pad" style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 8, padding: 16 }}>
            <Text className="agent-section-title" style={{ fontSize: 13, fontWeight: 650, color: '#33333C' }}>能力绑定</Text>
            <div className="agent-bindings" style={{ marginTop: 12 }}>
              <div className="agent-binding-box" style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ color: '#5A5C6B', fontSize: 13 }}><ToolOutlined /> 工具</span>
                  <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => setDrawer('tool')}>添加</Button>
                </div>
                <div>{tools.length === 0 ? <Text style={{ color: '#A6A8B4', fontSize: 12 }}>未选择</Text> :
                  tools.map(id => { const t = TOOLS.find(x => x.id === id); return <Tag key={id} closable bordered={false} onClose={() => setTools(tools.filter(x => x !== id))} style={{ marginBottom: 6, background: '#EEF0FF', color: ACCENT }}>{(t && t.name) || id}</Tag>; })}</div>
              </div>
              <div className="agent-binding-box" style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ color: '#5A5C6B', fontSize: 13 }}><BulbOutlined /> 技能</span>
                  <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => setDrawer('skill')}>添加</Button>
                </div>
                <div>{skills.length === 0 ? <Text style={{ color: '#A6A8B4', fontSize: 12 }}>未选择</Text> :
                  skills.map(id => { const s = SKILLS.find(x => x.id === id); return <Tag key={id} closable bordered={false} onClose={() => setSkills(skills.filter(x => x !== id))} style={{ marginBottom: 6, background: '#F1F1F4', color: '#4A4A55' }}>{(s && s.name) || id}</Tag>; })}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 右：运行 & 试跑 —— 常驻 */}
        <div className="agent-side-panel" style={{ width: 400, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          {/* 线上发布与运行面板：版本发布 != 服务实例运行 */}
          <div className="agent-panel agent-panel--pad" style={{ background: '#fff', border: '1px solid #ECECEF', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5 }}>
                  <span style={{ fontWeight: 760, fontSize: 13.5, color: '#0f172a' }}>线上发布与运行</span>
                  {!isCreate && statusPill}
                </div>
                <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '72px minmax(0,1fr)', rowGap: 4, columnGap: 8, fontSize: 11.5 }}>
                  <span style={{ color: '#94A3B8' }}>Head</span>
                  <span style={{ color: '#475569' }}>{isCreate ? '未创建' : `v${savedAgent.version}${dirty ? '（有未保存改动）' : ''}`}</span>
                  <span style={{ color: '#94A3B8' }}>Live</span>
                  <span style={{ color: '#475569' }}>{published ? `v${savedAgent.publishedVersion} · ${isoName(liveIso)}(${liveIso})` : '未发布'}</span>
                  <span style={{ color: '#94A3B8' }}>Runtime</span>
                  <span style={{ color: '#475569' }}>{isCreate ? '保存后可发布' : running ? `${service.location === 'cloud' ? '云端' : '本地'}服务运行中` : deploying ? '部署中' : failed ? '部署失败' : published ? '服务已停止' : '无实例'}</span>
                </div>
                {!isCreate && published && savedAgent.publishedVersion !== savedAgent.version && !dirty && (
                  <div style={{ marginTop: 6, color: '#B45309', fontSize: 11.5 }}>Head v{savedAgent.version} 尚未发布，线上仍是 v{savedAgent.publishedVersion}。</div>
                )}
                {!isCreate && dirty && (
                  <div style={{ marginTop: 6, color: '#64748B', fontSize: 11.5 }}>先保存为新版本，再选择是否发布。</div>
                )}
              </div>
              {!isCreate && <Space size={6} style={{ flexShrink: 0 }}>
                {dirty ? <Button size="small" disabled>先保存</Button>
                  : !published && !service ? <Button size="small" type="primary" onClick={() => askPublish(savedAgent.version)}>发布 v{savedAgent.version}</Button>
                  : deploying ? <Button size="small" loading disabled>部署中</Button>
                  : failed ? <Button size="small" type="primary" onClick={() => askPublish(savedAgent.version)}>重新发布</Button>
                  : running ? <><Tooltip title="选择要发布的版本 / 运行环境，发布后替换当前实例"><Button size="small" onClick={() => askPublish(savedAgent.version)}>重新发布…</Button></Tooltip><Popconfirm title="停止该服务？" description="仅停实例，已发布配置保留" onConfirm={stopService}><Button size="small" danger>停服</Button></Popconfirm></>
                  : <><Tooltip title={`用已发布 v${savedAgent.publishedVersion} · ${isoName(liveIso)} 原样拉起服务实例`}><Button size="small" type="primary" onClick={startPublished}>启动 Live</Button></Tooltip><Button size="small" onClick={() => askPublish(savedAgent.version)}>发布其他版本…</Button></>}
              </Space>}
            </div>
            {!isCreate && versions.length > 1 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: '#64748B', fontSize: 11.5 }}>需要回滚时，从历史版本选择“直接发布此版本”或“回滚为新版本”。</span>
                <Button size="small" icon={<BranchesOutlined />} onClick={() => setHistOpen(true)}>回滚 / 历史</Button>
              </div>
            )}
            {running && (
              <div style={{ marginTop: 10, borderTop: '1px solid #F4F4F7', paddingTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text code style={{ fontSize: 11.5 }}>{stablePath}</Text>
                  <a onClick={() => copy(stableBase)} style={{ fontSize: 11.5, color: ACCENT }}>复制</a>
                  <span style={{ flex: 1 }} />
                  <a onClick={() => setShowApi(s => !s)} style={{ fontSize: 11.5, color: ACCENT }}>{showApi ? '收起示例' : '调用示例'}</a>
                </div>
                {showApi && <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11.5, color: '#5A5C6B', margin: '2px 0' }}>① 一次性</div>
                  <div style={{ display: 'flex', gap: 6 }}><pre style={codeBlock}>{svcCurl}</pre><Button size="small" onClick={() => copy(svcCurl)}>复制</Button></div>
                  <div style={{ fontSize: 11.5, color: '#5A5C6B', margin: '8px 0 2px' }}>② SSE 流式</div>
                  <div style={{ display: 'flex', gap: 6 }}><pre style={codeBlock}>{svcCurlStream}</pre><Button size="small" onClick={() => copy(svcCurlStream)}>复制</Button></div>
                </div>}
              </div>
            )}
          </div>
          {/* 试跑控制台 */}
          <div className="agent-panel agent-panel--pad" style={{ flex: 1, minHeight: 0, background: '#fff', border: '1px solid #EBEBF1', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: 650 }}>试跑</Text>
              {running
                ? <Segmented size="small" value={testTarget} onChange={setTestTarget} options={[{ value: 'draft', label: '当前配置' }, { value: 'live', label: '线上服务' }]} />
                : <span style={{ fontSize: 11.5, color: '#A6A8B4' }}>试当前配置</span>}
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {testTarget === 'live' && running
                ? <DebugPanel key="live" cfg={testCfg} streamPath={`/api/agents/${savedAgent.id}/service-chat/stream`} />
                : <DebugPanel key="draft" cfg={testCfg} />}
            </div>
          </div>
        </div>
      </div>

      <AssetDrawer open={drawer === 'tool'} type="tool" wsId={ws} selected={tools} onClose={() => setDrawer(null)} onConfirm={s => { setTools(s); setDrawer(null); }} />
      <AssetDrawer open={drawer === 'skill'} type="skill" wsId={ws} selected={skills} onClose={() => setDrawer(null)} onConfirm={s => { setSkills(s); setDrawer(null); }} />
      <PublishChooser open={choose} agentName={name} versions={versions} defaultVersion={pubVer}
        defaultIso={liveIso} curIso={published ? liveIso : null}
        onCancel={() => setChoose(false)} onConfirm={doPublish} />
      <PublishModal pub={pub} agentName={name} onClose={() => setPub(null)} />
      {!isCreate && <VersionHistory open={histOpen} agentName={name} versions={versions} headVer={savedAgent.version} liveVer={liveVer}
        onClose={() => setHistOpen(false)}
        onPublish={v => { setHistOpen(false); askPublish(v); }}
        onEditFrom={v => { loadVersion(v); setHistOpen(false); antMsg.info(`已载入 v${v} 到编辑器，改完保存即生成新版本`); }} />}
    </div>
  );
}

/* ================= 版本对比 (Spec F) ================= */
export function lineDiff(a, b) {
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
export const nameOf = (arr, id) => (arr.find(x => x.id === id) || {}).name || id;

export function VersionDiff({ agent, onBack }) {
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
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

      {same ? <div style={{ background: '#FFF8E6', border: '1px solid #FCE2A0', borderRadius: 8, padding: '10px 14px', color: '#946C00' }}>请选择两个不同的版本进行对比。</div> : (
        <div>
          <div style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 8, padding: 20, marginBottom: 16 }}>
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
              <div key={fk} style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 8, padding: 0, marginBottom: 14, overflow: 'hidden' }}>
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
export const diffChip = (bg, color) => ({ background: bg, color, fontSize: 12.5, padding: '2px 10px', borderRadius: 6, fontWeight: 600 });

/* ================= 版本与回滚抽屉（列表 + 只读明细 + 对比 + 发布某版本） ================= */
export function VersionHistory({ open, agentName, versions, headVer, liveVer, onClose, onPublish, onEditFrom }) {
  const sorted = versions.slice().sort((a, b) => b.version - a.version);
  const [tab, setTab] = useState('detail');
  const [sel, setSel] = useState(headVer);
  const [lv, setLv] = useState(versions.length >= 2 ? versions[versions.length - 2].version : headVer);
  const [rv, setRv] = useState(headVer);
  React.useEffect(() => { if (open) { setTab('detail'); setSel(headVer); setRv(headVer); setLv(versions.length >= 2 ? versions[versions.length - 2].version : headVer); } }, [open, headVer]);
  const opts = sorted.map(v => ({ value: v.version, label: `v${v.version}${v.version === headVer ? ' · 最新' : ''}${v.version === liveVer ? ' · 线上' : ''} · ${(v.createdAt || '').slice(5)}` }));
  const cfgOf = v => (versions.find(x => x.version === v) || {}).config || {};
  const vc = cfgOf(sel), L = cfgOf(lv), R = cfgOf(rv);
  const badges = v => <>{v === headVer && <span style={pill('#EEF0FF', '#4F46E5')}>最新</span>}{v === liveVer && <span style={pill('#E9F7EF', '#1E8449')}>已发布</span>}</>;

  const ConfigDetail = () => {
    const fk = Object.keys(vc.files || {});
    return (
      <>
        <Descriptions column={2} size="small" colon={false} styles={{ label: { color: '#8A8C99', fontSize: 13, width: 56 }, content: { fontSize: 13.5 } }}
          items={[
            { label: '描述', span: 2, children: vc.desc || '—' },
            { label: '模型', children: <Text code>{vc.model}</Text> },
            { label: '参数', children: `温度 ${vc.params ? vc.params.temperature : '—'} · MaxTokens ${vc.params ? vc.params.max_tokens : '—'}` },
            { label: '工具', span: 2, children: (vc.tools && vc.tools.length) ? vc.tools.map(id => <Tag key={id} bordered={false} style={{ background: '#EEF0FF', color: ACCENT }}>{nameOf(TOOLS, id)}</Tag>) : '—' },
            { label: '技能', span: 2, children: (vc.skills && vc.skills.length) ? vc.skills.map(id => <Tag key={id} bordered={false} style={{ background: '#F1F1F4', color: '#4A4A55' }}>{nameOf(SKILLS, id)}</Tag>) : '—' },
          ]} />
        <Divider style={{ margin: '14px 0 12px' }} />
        <Text style={{ fontSize: 13, fontWeight: 650 }}>指令文件 · v{sel}</Text>
        <div style={{ marginTop: 10 }}>
          <Collapse activeKey={fk} items={fk.map(k => ({ key: k, label: k, children: <pre style={{ background: '#FAFAFC', border: '1px solid #F1F1F5', color: '#33333C', padding: 14, borderRadius: 8, fontSize: 12.5, lineHeight: 1.6, overflow: 'auto', fontFamily: 'ui-monospace,Menlo,monospace', margin: 0 }}>{vc.files[k]}</pre> }))} />
        </div>
      </>
    );
  };

  const DiffBody = () => {
    if (lv === rv) return <div style={{ background: '#FFF8E6', border: '1px solid #FCE2A0', borderRadius: 8, padding: '10px 14px', color: '#946C00' }}>选择两个不同版本进行对比。</div>;
    const rows = []; const cmp = (label, a, b) => { if (String(a) !== String(b)) rows.push({ label, from: a, to: b }); };
    cmp('框架', fwName(L.framework), fwName(R.framework)); cmp('模型', L.model, R.model); cmp('描述', L.desc || '—', R.desc || '—');
    cmp('Temperature', L.params && L.params.temperature, R.params && R.params.temperature); cmp('Max Tokens', L.params && L.params.max_tokens, R.params && R.params.max_tokens);
    const tA = (R.tools || []).filter(x => !(L.tools || []).includes(x)), tD = (L.tools || []).filter(x => !(R.tools || []).includes(x));
    const sA = (R.skills || []).filter(x => !(L.skills || []).includes(x)), sD = (L.skills || []).filter(x => !(R.skills || []).includes(x));
    const fk = Array.from(new Set([...Object.keys(L.files || {}), ...Object.keys(R.files || {})]));
    return (
      <div>
        <div style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 8, padding: 16, marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: 650 }}>字段变化（v{lv} → v{rv}）</Text>
          <div style={{ marginTop: 10 }}>
            {rows.length === 0 && !tA.length && !tD.length && !sA.length && !sD.length ? <Text style={{ color: '#8A8C99' }}>无字段差异</Text> : <>
              {rows.map(r => <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13.5 }}><span style={{ width: 100, color: '#5A5C6B' }}>{r.label}</span><span style={diffChip('#FDECEC', '#C0392B')}>{String(r.from)}</span><span style={{ color: '#C4C4CE' }}>→</span><span style={diffChip('#E9F7EF', '#1E8449')}>{String(r.to)}</span></div>)}
              {(tA.length || tD.length) ? <div style={{ display: 'flex', gap: 10, padding: '6px 0' }}><span style={{ width: 100, color: '#5A5C6B' }}>工具</span><div>{tD.map(id => <Tag key={id} bordered={false} style={{ background: '#FDECEC', color: '#C0392B' }}>− {nameOf(TOOLS, id)}</Tag>)}{tA.map(id => <Tag key={id} bordered={false} style={{ background: '#E9F7EF', color: '#1E8449' }}>+ {nameOf(TOOLS, id)}</Tag>)}</div></div> : null}
              {(sA.length || sD.length) ? <div style={{ display: 'flex', gap: 10, padding: '6px 0' }}><span style={{ width: 100, color: '#5A5C6B' }}>技能</span><div>{sD.map(id => <Tag key={id} bordered={false} style={{ background: '#FDECEC', color: '#C0392B' }}>− {nameOf(SKILLS, id)}</Tag>)}{sA.map(id => <Tag key={id} bordered={false} style={{ background: '#E9F7EF', color: '#1E8449' }}>+ {nameOf(SKILLS, id)}</Tag>)}</div></div> : null}
            </>}
          </div>
        </div>
        {fk.map(k => { const dr = lineDiff((L.files || {})[k], (R.files || {})[k]); const changed = dr.some(r => r.t !== 'eq'); return (
          <div key={k} style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 8, marginBottom: 14, overflow: 'hidden' }}>
            <div style={{ padding: '9px 14px', borderBottom: '1px solid #F1F1F5', display: 'flex', justifyContent: 'space-between' }}><Text style={{ fontWeight: 650, fontSize: 13 }}>{k}</Text>{!changed && <Text style={{ color: '#8A8C99', fontSize: 12 }}>无变化</Text>}</div>
            <div style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12.5, lineHeight: 1.7 }}>{dr.map((r, i) => <div key={i} style={{ display: 'flex', padding: '0 12px', background: r.t === 'add' ? '#EAF8F0' : r.t === 'del' ? '#FDECEC' : '#fff', color: r.t === 'add' ? '#1E8449' : r.t === 'del' ? '#C0392B' : '#5A5A66' }}><span style={{ width: 16, color: '#A6A8B4' }}>{r.t === 'add' ? '+' : r.t === 'del' ? '−' : ''}</span><span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{r.l || ' '}</span></div>)}</div>
          </div>
        ); })}
      </div>
    );
  };

  return (
    <Drawer title={`版本与回滚 · ${agentName}`} width={940} open={open} onClose={onClose} styles={{ body: { padding: 0 } }}>
      <div style={{ display: 'flex', height: '100%' }}>
        <div style={{ width: 230, borderRight: '1px solid #F1F1F5', overflow: 'auto', flexShrink: 0, padding: '8px 0' }}>
          {sorted.map(v => { const on = tab === 'detail' && v.version === sel; return (
            <div key={v.version} onClick={() => { setSel(v.version); setTab('detail'); }}
              style={{ padding: '10px 16px', cursor: 'pointer', background: on ? '#F5F5FE' : 'transparent', borderLeft: '2px solid ' + (on ? ACCENT : 'transparent') }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontWeight: 650, fontSize: 13.5 }}>v{v.version}</span>{badges(v.version)}</div>
              <div style={{ fontSize: 11.5, color: '#A6A8B4', marginTop: 2 }}>{(v.createdAt || '').slice(5) || '—'}</div>
            </div>
          ); })}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #F1F1F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <Segmented value={tab} onChange={setTab} options={[{ value: 'detail', label: '版本明细 / 回滚' }, { value: 'diff', label: '版本对比' }]} />
            {tab === 'detail'
              ? <Space size={8}>
                  <Tooltip title="把这个历史版本载入编辑器，保存后生成一个新的 Head 版本">
                    <Button onClick={() => onEditFrom(sel)}>回滚为新版本</Button>
                  </Tooltip>
                  <Tooltip title={sel === liveVer ? '该版本已是线上发布版本' : '不生成新版本，直接把此历史版本设为线上 Live 版本'}>
                    <Button type="primary" disabled={sel === liveVer} onClick={() => onPublish(sel)}>{sel === liveVer ? '当前已发布' : `直接发布 v${sel}`}</Button>
                  </Tooltip>
                </Space>
              : <Space size={6}><Select size="small" value={lv} style={{ width: 168 }} options={opts} onChange={setLv} /><span style={{ color: '#8A8C99' }}>→</span><Select size="small" value={rv} style={{ width: 168 }} options={opts} onChange={setRv} /></Space>}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
            {tab === 'detail' && (
              <div style={{ marginBottom: 12, padding: '9px 11px', border: '1px solid #E2E8F0', borderRadius: 6, background: '#F8FAFC', color: '#64748B', fontSize: 12 }}>
                回滚有两种：`直接发布 vN` 会让线上 Live 指向历史版本；`回滚为新版本` 会把历史配置载入编辑器，保存后生成新的 Head。
              </div>
            )}
            {tab === 'detail' ? <ConfigDetail /> : <DiffBody />}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

/* ================= 成员管理 (Spec J/K/H) ================= */
export function MembersPanel({ ws, onUpdate }) {
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
      <div style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 8, padding: 20 }}>
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

export let antMsg: any = { success: () => {}, error: () => {}, info: () => {} };
export function setAntMsg(m: any) { antMsg = m; }

/* ================= Playground：与已发布 agent 对话 ================= */
export function Playground({ agents, embedded }) {
  const [list, setList] = useState(API_ON ? [] : agents.map(a => ({ id: a.id, name: a.name, framework: a.framework, model: a.model, version: a.version })));
  const [sel, setSel] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [psid, setPsid] = useState(null);       // 当前会话（我方 sid）；L3 即按它在云端粘一个专属沙箱
  const [pgSessions, setPgSessions] = useState([]); // 选中 agent 名下的会话列表
  const [pgMsgs, setPgMsgs] = useState([]);      // 当前会话历史（喂给 DebugPanel 回显）
  const [pgRailCollapsed, setPgRailCollapsed] = useState(false); // 会话列表收起态
  const [svcMap, setSvcMap] = useState({});      // agentId → 运行态（隔离级别 / local|cloud / status）
  const loadSvc = () => { if (API_ON) apiCall('/api/services').then(d => setSvcMap(Object.fromEntries((d || []).map(s => [s.agentId || s.id, s])))).catch(() => {}); };
  // 会话管理（统一 /api/sessions，按 agent 过滤）——切 tab 回来即由此重载、回显
  // Playground 只展示交互式会话；定时任务产生的会话（source=schedule）不在此列出，仅在「会话」tab 可见
  const loadPgSessions = async (aid) => { try { const l = await apiCall(`/api/sessions?agent=${aid}&exclude_source=schedule`); setPgSessions(l || []); return l || []; } catch { return []; } };
  const switchPgSession = async (sid) => { try { const s = await apiCall(`/api/sessions/${sid}`); setPsid(sid); setPgMsgs(s.messages || []); } catch (e) { antMsg.error(e.message); } };
  const pgSessionsRef = React.useRef([]);
  pgSessionsRef.current = pgSessions;
  const creatingRef = React.useRef(null);           // 正在为某 agent 建会话 → 防并发重复创建
  const newPgSession = async (aid, { reuseEmpty = false } = {}) => {
    // 已存在空会话（count 0）则复用，避免「进入新 agent / 连点新会话」出现多个空会话
    if (reuseEmpty) { const empty = pgSessionsRef.current.find(x => !x.count); if (empty) return switchPgSession(empty.id); }
    if (creatingRef.current === aid) return;          // StrictMode 双跑 / 连点：同一 agent 只建一条
    creatingRef.current = aid;
    try { const s = await apiCall('/api/sessions', { method: 'POST', body: JSON.stringify({ agent: aid }) });
      setPsid(s.id); setPgMsgs([]); setPgSessions(p => [{ id: s.id, title: s.title, updatedAt: s.updatedAt, count: 0 }, ...p.filter(x => x.id !== s.id)]); }
    catch (e) { antMsg.error(e.message); }
    finally { creatingRef.current = null; }
  };
  const delPgSession = async (sid) => {
    try { await apiCall(`/api/sessions/${sid}`, { method: 'DELETE' });
      const rest = pgSessions.filter(x => x.id !== sid); setPgSessions(rest);
      if (sid === psid) { if (rest.length) switchPgSession(rest[0].id); else if (sel) newPgSession(sel.id); else { setPsid(null); setPgMsgs([]); } } }
    catch (e) { antMsg.error(e.message); }
  };
  const pick = async item => {
    setSel(item); setPsid(null); setPgMsgs([]); setPgSessions([]); loadSvc();
    if (API_ON) {
      try {
        const full = await apiCall(`/api/agents/${item.id}`); const v = (full.versions || []).find(x => x.version === item.version);
        setCfg({ ...(v ? v.config : full), id: full.id });
        // 载入该 agent 名下会话：有则打开最近一条（回显历史），没有则开一条新的（create session 即确保云端沙箱就绪）
        const l = await loadPgSessions(item.id);
        if (l.length) await switchPgSession(l[0].id); else await newPgSession(item.id);
      }
      catch (e) { antMsg.error('加载失败：' + e.message); }
    } else { const a = agents.find(x => x.id === item.id); setCfg(a ? { ...a } : null); }
  };
  const initedRef = React.useRef(false);
  React.useEffect(() => {                              // 进入页面一次（防 StrictMode 双跑导致两个空会话）
    if (initedRef.current) return;
    initedRef.current = true;
    if (API_ON) { loadSvc(); apiCall('/api/published').then(d => { setList(d); if (d[0]) pick(d[0]); }).catch(() => {}); }
    else if (agents[0]) pick({ id: agents[0].id, version: agents[0].version });
  }, []);
  // 视觉规范：模型名/参数/版本号 → 等宽字体码片（#FAFAFB 底 + 发丝描边），框架/状态才用 Tag
  const codeChip = { fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11.5, color: '#5A5C6B', background: '#FAFAFB', border: '1px solid #F1F1F5', borderRadius: 6, padding: '0 6px', lineHeight: '18px', display: 'inline-flex', alignItems: 'center', flexShrink: 0 };
  const agentSelect = list.length > 0 ? (
    <ConfigProvider theme={{ components: { Select: { activeBorderColor: ACCENT, hoverBorderColor: '#B9BBF5', activeOutlineColor: 'rgba(79,70,229,0.10)', optionSelectedBg: '#F0F1FE', optionSelectedColor: '#17171C' } } }}>
      <Select
        value={sel ? sel.id : undefined}
        placeholder="选择 Agent"
        style={{ width: 280 }}
        popupMatchSelectWidth={false}
        optionLabelProp="label"
        onChange={id => { const it = list.find(x => x.id === id); if (it) pick(it); }}
        options={list.map(it => ({
          value: it.id,
          title: it.name,
          label: (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%' }}>
              <span style={{ fontWeight: 600, color: '#17171C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
              <span style={codeChip}>v{it.version}</span>
            </span>
          ),
          children: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 2px', minWidth: 320 }}>
              <span style={{ fontWeight: 600, color: '#17171C' }}>{it.name}</span>
              <span style={codeChip}>v{it.version}</span>
              <span style={pill('#EEF0FF', '#4F46E5')}>{fwName(it.framework)}</span>
              <span style={{ ...codeChip, marginLeft: 'auto', color: '#8A8C99' }}>{it.model}</span>
            </div>
          ),
        }))}
        optionRender={opt => opt.data.children}
      />
    </ConfigProvider>
  ) : null;
  const agentPicker = agentSelect && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <span style={{ fontSize: 13, color: '#8A8C99' }}>Agent</span>{agentSelect}
    </div>
  );
  return (
    <div className={embedded ? 'playground-shell playground-shell--embedded' : 'playground-shell'}>
      {!embedded
        ? (
          <div className="playground-header" style={{ flexWrap: 'wrap' }}>
            <div>
              <div className="playground-title">Playground</div>
              <div className="playground-subtitle">与已发布的 Agent 对话{API_ON ? '' : '（未连后端 · 本地 mock）'}</div>
            </div>
            {agentPicker}
          </div>
        )
        : (agentPicker && <div style={{ marginBottom: 12 }}>{agentPicker}</div>)}
      {list.length === 0
        ? <div className="playground-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有已发布的 Agent —— 去详情或编辑页点「发布」" /></div>
        : <div className="playground-frame" style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
            {cfg && (
              <div className={'playground-session-rail' + (pgRailCollapsed ? ' is-collapsed' : '')}>
                {pgRailCollapsed ? (
                  <div className="session-rail-collapsed">
                    <Tooltip title="展开会话列表" placement="right"><Button type="text" size="small" icon={<MenuUnfoldOutlined />} onClick={() => setPgRailCollapsed(false)} /></Tooltip>
                    <Tooltip title="新建会话" placement="right"><Button type="text" size="small" icon={<PlusOutlined />} onClick={() => sel && newPgSession(sel.id, { reuseEmpty: true })} /></Tooltip>
                  </div>
                ) : (
                  <>
                    <div className="playground-session-toolbar">
                      <div className="session-toolbar-row">
                        <div>
                          <div className="playground-session-label">会话</div>
                          <div className="playground-session-count">{pgSessions.length} 条</div>
                        </div>
                        <div className="session-toolbar-actions">
                          <Button size="small" icon={<PlusOutlined />} onClick={() => sel && newPgSession(sel.id, { reuseEmpty: true })}>新建</Button>
                          <Tooltip title="收起会话列表"><Button type="text" size="small" icon={<MenuFoldOutlined />} onClick={() => setPgRailCollapsed(true)} /></Tooltip>
                        </div>
                      </div>
                    </div>
                    <div className="playground-session-list">
                      {pgSessions.length === 0
                        ? <div style={{ textAlign: 'center', color: '#C2C4CE', fontSize: 12, padding: '16px 0' }}>暂无会话</div>
                        : pgSessions.map(s => (
                          <div key={s.id} className={'playground-session-item' + (s.id === psid ? ' is-active' : '')} onClick={() => switchPgSession(s.id)}>
                            <div className="session-item-title">{s.title || '新对话'}</div>
                            <div className="session-item-meta">{s.updatedAt ? s.updatedAt + ' · ' : ''}{s.count || 0} 条</div>
                            <div className="session-item-actions">
                              <Popconfirm title="删除该会话？" okText="删除" okButtonProps={{ danger: true }} cancelText="取消" onConfirm={() => delPgSession(s.id)}>
                                <DeleteOutlined onClick={e => e.stopPropagation()} />
                              </Popconfirm>
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="playground-main" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {cfg ? <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div className="playground-main-head" style={{ fontWeight: 650, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {cfg.name} <span style={pill('#EEF0FF', '#4F46E5')}>{fwName(cfg.framework)}</span>
                    {(() => { const s = svcMap[sel && sel.id]; if (!s) return null; const cloud = s.location === 'cloud';
                      return <Badge status={s.status === 'running' ? 'success' : (s.status === 'failed' ? 'error' : 'processing')}
                        text={<span style={{ fontSize: 12, color: '#8A8C99', fontWeight: 400 }}>{s.isolation ? isoName(s.isolation) + ' · ' + s.isolation : ''}{cloud ? ' · 云端沙箱' : ' · 本地'}{s.status && s.status !== 'running' ? ' · ' + s.status : ''}</span>} />; })()}
                  </div>
                  <div className="playground-debug-body" style={{ flex: 1, minHeight: 0 }}><DebugPanel key={sel.id + '-' + sel.version + '-' + (psid || 'x')} cfg={cfg}
                    initialMsgs={pgMsgs} onTurn={() => sel && loadPgSessions(sel.id)}
                    chatPath={psid ? `/api/sessions/${psid}/events` : `/api/agents/${sel.id}/service-chat`}
                    streamPath={psid ? `/api/sessions/${psid}/events/stream` : `/api/agents/${sel.id}/service-chat/stream`} /></div>
                </div>
                : <Empty description="在上方选择一个 Agent 开始对话" />}
            </div>
          </div>}
    </div>
  );
}

/* ================= Chat（统一入口：默认通用 agent + slash 选内置 skill）================= */
export const GENERAL_INTRO = '通用助手（后端常驻 Agent）· 直接说需求即可执行：列出/创建/发布 Agent、创建项目空间、提交需求等，由它经平台工具真正完成。输入 / 选择内置技能。';
export const CHAT_SKILLS = [
  { cmd: '/agent-creator', mode: 'agent', name: 'Agent Creator', intro: '描述名称 + 职责，我来创建 Agent。例：客服助手：负责一线答疑' },
  { cmd: '/skill-creator', mode: 'skill', name: 'Skill Creator', intro: '描述一个技能，我生成定义草稿（demo 不持久化）。' },
];

export function ChatPanel({ curWs, isAdmin, onChanged }) {
  const [mode, setMode] = useState('general');
  const [msgs, setMsgs] = useState([{ role: 'sys', text: GENERAL_INTRO }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [slash, setSlash] = useState(false);
  const [copilot, setCopilot] = useState(true);    // 默认走后端常驻通用 agent（Claude Code + MCP/skill）；关掉=前端轻量回退
  const [conn, setConn] = useState(null);            // 通用 agent 连接态：{running, claude_code} | null
  const [sessions, setSessions] = useState([]);      // 会话历史（按用户）
  const [curSid, setCurSid] = useState(null);        // 当前会话 id（我方）；claude 续接 token 由后端持有
  const [renaming, setRenaming] = useState(null);    // 重命名中：{id, title}
  const [railCollapsed, setRailCollapsed] = useState(false); // 会话列表收起态
  const composingRef = React.useRef(false);  // 输入法组合(拼音等)中 → Enter 不触发发送，避免半截拼音被发出
  const push = (role, text, extra) => setMsgs(m => [...m, { role, text, ts: now(), ...(extra || {}) }]);
  // 增量更新最后一条 bot 气泡（流式）
  const setBot = (text, extra) => setMsgs(m => { const c = [...m]; for (let i = c.length - 1; i >= 0; i--) { if (c[i].role === 'bot') { c[i] = { ...c[i], text, ...(extra || {}) }; break; } } return c; });
  // 更新最后一条 bot 的执行链路（think/tool/info），与 DebugPanel 同构
  const upSteps = fn => setMsgs(m => { const c = [...m]; for (let i = c.length - 1; i >= 0; i--) { if (c[i].role === 'bot') { const steps = (c[i].steps || []).map(s => ({ ...s })); fn(steps); c[i] = { ...c[i], steps }; break; } } return c; });
  const finishSteps = () => upSteps(steps => steps.forEach(s => { if (s.running) s.running = false; }));

  // 连接态轮询（通用 agent 按用户、与空间无关；ws 仅作回显）
  React.useEffect(() => {
    if (!API_ON) { setConn(null); return; }
    let alive = true;
    const check = () => apiCall(`/api/copilot/status?ws=${curWs}`)
      .then(d => { if (alive) setConn(d); }).catch(() => { if (alive) setConn(null); });
    check();
    const id = setInterval(check, 4000);
    return () => { alive = false; clearInterval(id); };
  }, [curWs]);

  // ----- 多会话（按用户持久化，与空间无关）-----
  const loadSessions = async () => { try { const l = await apiCall('/api/copilot/sessions'); setSessions(l || []); return l || []; } catch { return []; } };
  const newSession = async () => {
    try {
      const s = await apiCall('/api/copilot/sessions', { method: 'POST' });
      setCurSid(s.id); setMode('general'); setMsgs([{ role: 'sys', text: GENERAL_INTRO }]);
      setSessions(p => [{ id: s.id, title: s.title, updatedAt: s.updatedAt, count: 0 }, ...p.filter(x => x.id !== s.id)]);
    } catch (e) { antMsg.error(e.message); }
  };
  const switchSession = async (sid) => {
    if (sid === curSid) return;
    try {
      const s = await apiCall(`/api/copilot/sessions/${sid}`);
      setCurSid(sid); setMode('general');
      setMsgs(s.messages && s.messages.length ? s.messages : [{ role: 'sys', text: GENERAL_INTRO }]);
    } catch (e) { antMsg.error(e.message); }
  };
  const delSession = async (sid) => {
    try {
      await apiCall(`/api/copilot/sessions/${sid}`, { method: 'DELETE' });
      const rest = sessions.filter(x => x.id !== sid); setSessions(rest);
      if (sid === curSid) { if (rest.length) switchSession(rest[0].id); else newSession(); }
    } catch (e) { antMsg.error(e.message); }
  };
  const renameSession = async () => {
    if (!renaming) return;
    const t = (renaming.title || '').trim() || '新对话';
    try {
      await apiCall(`/api/copilot/sessions/${renaming.id}`, { method: 'PUT', body: JSON.stringify({ title: t }) });
      setSessions(p => p.map(s => s.id === renaming.id ? { ...s, title: t } : s));
      setRenaming(null);
    } catch (e) { antMsg.error(e.message); }
  };
  const initedRef = React.useRef(false);
  React.useEffect(() => {   // 进入页面一次：载入会话历史，打开最近的；没有则建一个（防 StrictMode 双跑）
    if (!API_ON || initedRef.current) return;
    initedRef.current = true;
    (async () => { const l = await loadSessions(); if (l.length) await switchSession(l[0].id); else await newSession(); })();
  }, []);

  // 通用 Agent 路径由**后端**每轮落库；仅「轻量模式(关掉开关)」的消息由前端兜底保存。
  const titleOf = (m) => { const u = (m || []).find(x => x.role === 'user'); return u ? (u.text || '').slice(0, 24) : '新对话'; };
  const liveRef = React.useRef({});
  liveRef.current = { msgs, curSid };
  React.useEffect(() => {
    if (busy || !API_ON || copilot) return;   // copilot 路径后端已落库，跳过
    const { msgs: lm, curSid: ls } = liveRef.current;
    if (ls && (lm || []).some(x => x.role === 'user')) {
      apiCall(`/api/copilot/sessions/${ls}`, { method: 'PUT', body: JSON.stringify({ messages: lm, title: titleOf(lm) }) })
        .then(loadSessions).catch(() => {});
    }
  }, [busy]);

  // 走后端通用 agent（copilot）：SSE 流式（事件 delta/done/error），真正用 MCP 工具/内置 skill 编排。
  // 首条消息会懒启动服务（故首个 token 前可能有几秒空窗）。
  const handleCopilot = async q => {
    push('bot', '', { pending: true });
    let acc = '';
    // 兜底：确保有一条受前端跟踪的会话。curSid 为空时若直接发，后端会新建一条而前端不追踪 → 表现为"历史丢失 + 不自动改名"。
    let sid = curSid;
    if (!sid) {
      try { const s = await apiCall('/api/copilot/sessions', { method: 'POST' });
        sid = s.id; setCurSid(s.id);
        setSessions(p => [{ id: s.id, title: s.title, updatedAt: s.updatedAt, count: 0 }, ...p.filter(x => x.id !== s.id)]);
      } catch (e) {}
    }
    try {
      const resp = await fetch(API_BASE + `/api/copilot/chat/stream?ws=${curWs}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, session_id: sid }),   // 我方会话 id；续接 token 由后端持有/落库
      });
      const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = '';
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
          else if (ev === 'think') upSteps(steps => { const last = steps[steps.length - 1]; if (last && last.type === 'think' && !last.done) last.text = (last.text || '') + (d.text || ''); else steps.push({ type: 'think', text: d.text || '' }); });
          else if (ev === 'tool') upSteps(steps => { steps.forEach(s => { if (s.type === 'think') s.done = true; }); steps.push({ type: 'tool', id: d.id, name: d.name, input: d.input, running: true }); });
          else if (ev === 'tool_result') upSteps(steps => { for (let j = steps.length - 1; j >= 0; j--) { if (steps[j].type === 'tool' && steps[j].id === d.id) { steps[j] = { ...steps[j], output: d.output, is_error: !!d.is_error, running: false }; break; } } });
          else if (ev === 'info') upSteps(steps => steps.push({ type: 'info', text: d.text || '' }));
          else if (ev === 'done') { acc = d.reply || acc; finishSteps(); setBot(acc, { pending: false, ...(d.usage ? { usage: d.usage } : {}), ...(d.model ? { model: d.model } : {}), ...(d.stop ? { stop: d.stop } : {}) }); }
          else if (ev === 'error') { acc = d.reply || acc || '出错'; finishSteps(); setBot(acc, { pending: false, err: true }); }
        }
      }
      if (!acc.trim()) setBot('（通用助手无回复）', { pending: false });
    } catch (e) { setBot('调用失败：' + e.message, { pending: false, err: true }); }
    setConn(c => ({ ...(c || {}), running: true }));
    loadSessions();             // 这一轮已由后端落库，刷新列表（标题/顺序）
    onChanged && onChanged();   // 可能创建/发布了 agent，刷新列表
  };

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
    try {
      // 默认：所有消息交给后端通用 agent（它自带 general 编排 + agent-creator/skill-creator/requirement-clarify 技能）
      if (copilot) await handleCopilot(q);
      else if (m === 'general') await handleGeneral(q);             // 轻量回退：前端正则
      else if (m === 'agent') await handleAgent(q);
      else await handleSkill(q);
    }
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
  const hasConversation = msgs.some(m => m.role === 'user' || m.role === 'bot');
  const suggestions = [
    '列出当前空间的 Agent',
    '创建 Agent：需求分析助手，负责把对话整理成 EARS 需求',
    '列出已发布 Agent',
    '提交一个平台改进需求',
  ];

  return (
    <div className="chat-shell">
      <div className="chat-header" style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="chat-title-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Chat
            {copilot && (conn
              ? <Badge status={conn.running ? 'success' : 'default'} text={<span style={{ fontSize: 12, color: '#8A8C99', fontWeight: 400 }}>{conn.running ? '通用 Agent 已连接' : '通用 Agent 待启动'}</span>} />
              : <Badge status="default" text={<span style={{ fontSize: 12, color: '#A6A8B4', fontWeight: 400 }}>未连后端</span>} />)}
          </div>
          <div className="chat-subtitle">平台统一入口：默认连后端通用 Agent，经平台工具真正执行；输入 / 唤起内置技能</div>
        </div>
        <Tooltip title={copilot ? '已连后端常驻通用 Agent（Claude Code + platform-ops MCP + 内置 skill）。关掉=前端轻量意图匹配' : '当前为前端轻量匹配。打开以连接真正的通用 Agent'}>
          <Space size={6} style={{ flexShrink: 0, paddingTop: 4 }}>
            <Text style={{ fontSize: 12.5, color: copilot ? ACCENT : '#8A8C99' }}>通用 Agent</Text>
            <Switch size="small" checked={copilot} onChange={v => { setCopilot(v); push('sys', v ? '已连通用 Agent（首条消息会自动启动，约数秒）' : '已切回前端轻量模式'); }} />
          </Space>
        </Tooltip>
      </div>
      <div className="chat-frame" style={{ background: '#fff', border: '1px solid #dfe3ea', borderRadius: 6, display: 'flex', overflow: 'hidden' }}>
        {/* 会话侧栏：新建 / 切换 / 删除 / 历史 */}
        <div className={'chat-session-rail' + (railCollapsed ? ' is-collapsed' : '')}>
          {railCollapsed ? (
            <div className="session-rail-collapsed">
              <Tooltip title="展开会话列表" placement="right"><Button type="text" size="small" icon={<MenuUnfoldOutlined />} onClick={() => setRailCollapsed(false)} /></Tooltip>
              <Tooltip title="新建会话" placement="right"><Button type="text" size="small" icon={<PlusOutlined />} onClick={newSession} /></Tooltip>
            </div>
          ) : (
            <>
              <div className="chat-session-toolbar">
                <div className="session-toolbar-row">
                  <div>
                    <div className="chat-session-label">会话</div>
                    <div className="chat-session-count">{sessions.length} 条</div>
                  </div>
                  <div className="session-toolbar-actions">
                    <Button size="small" icon={<PlusOutlined />} onClick={newSession}>新建</Button>
                    <Tooltip title="收起会话列表"><Button type="text" size="small" icon={<MenuFoldOutlined />} onClick={() => setRailCollapsed(true)} /></Tooltip>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '6px 6px 8px' }}>
                {sessions.length === 0
                  ? <div style={{ textAlign: 'center', color: '#C2C4CE', fontSize: 12, padding: '24px 0' }}>暂无会话</div>
                  : sessions.map(s => (
                    <div key={s.id} className={'chat-session-item' + (s.id === curSid ? ' is-active' : '')} onClick={() => switchSession(s.id)}>
                      <div className="session-item-title">{s.title || '新对话'}</div>
                      <div className="session-item-meta">{s.updatedAt ? s.updatedAt + ' · ' : ''}{s.count || 0} 条</div>
                      <div className="session-item-actions">
                        <Tooltip title="重命名"><EditOutlined onClick={e => { e.stopPropagation(); setRenaming({ id: s.id, title: s.title || '' }); }} /></Tooltip>
                        <Popconfirm title="删除该会话？" okText="删除" okButtonProps={{ danger: true }} cancelText="取消" onConfirm={() => delSession(s.id)}>
                          <DeleteOutlined onClick={e => e.stopPropagation()} />
                        </Popconfirm>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
        {/* 对话区 */}
        <div className="chat-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div className="chat-messages" style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
            {!hasConversation && (
              <div className="chat-empty">
                <div className="chat-empty-title">从一个明确动作开始</div>
                <div className="chat-empty-copy">这里不是闲聊页，更像平台操作入口。你可以让通用 Agent 查询、创建、发布 Agent，或把模糊诉求收敛成需求。</div>
                <div className="chat-suggestion-grid">
                  {suggestions.map(x => <div key={x} className="chat-suggestion" onClick={() => setInput(x)}>{x}</div>)}
                </div>
              </div>
            )}
            {msgs.map((m, i) => m.role === 'sys'
              ? <div key={i} style={{ textAlign: 'center', fontSize: 12, color: '#A6A8B4', margin: '6px 0 14px' }}>{m.text}</div>
              : <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                  {m.role === 'bot' && <TraceSteps steps={m.steps} />}
                  <div style={{ maxWidth: '82%', padding: '10px 13px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, background: m.role === 'user' ? ACCENT : (m.err ? '#FDECEC' : '#F4F4F7'), color: m.role === 'user' ? '#fff' : (m.err ? '#B42318' : '#2A2A33'), borderBottomRightRadius: m.role === 'user' ? 3 : 12, borderBottomLeftRadius: m.role === 'bot' ? 3 : 12 }}>
                    {m.text
                      ? (m.role === 'bot'
                          ? <><Md text={m.text} />{m.pending ? <span className="pg-caret">▋</span> : null}</>
                          : <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>)
                      : (m.pending
                          ? ((m.steps || []).length
                              ? <span style={{ color: '#8A8C99', fontSize: 12.5 }}>执行中…（上方为实时链路）</span>
                              : <span style={{ color: '#8A8C99' }}><Spin size="small" style={{ marginRight: 8 }} />通用 Agent 思考中…</span>)
                          : '')}
                  </div>
                  {(msgTime(m.ts) || m.usage || m.model || m.stop) && (
                    <div style={{ fontSize: 11, color: '#94A3B8', margin: '4px 2px 0' }}>
                      {msgTime(m.ts)}
                      {m.role === 'bot' && <UsageLine usage={m.usage} model={m.model} stop={m.stop} />}
                    </div>
                  )}
                </div>)}
          </div>
          <div className="chat-composer" style={{ position: 'relative' }}>
            {activeSkill && (
              <div className="chat-skill-row" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={pill('#EEF0FF', '#4F46E5')}>技能：{activeSkill.name}</span>
                <a onClick={exitSkill} style={{ fontSize: 12, color: '#8A8C99' }}>× 退出</a>
              </div>
            )}
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
            <div style={{ display: 'flex', gap: 8 }}>
              <Input placeholder={busy ? '执行中…' : '输入消息，或 / 选择技能'} value={input} disabled={busy}
                onChange={e => onInput(e.target.value)}
                onCompositionStart={() => (composingRef.current = true)}
                onCompositionEnd={() => (composingRef.current = false)}
                onPressEnter={e => { if (composingRef.current || e.nativeEvent?.isComposing || e.keyCode === 229) return; send(); }} />
              <Button type="primary" icon={<SendOutlined />} onClick={send} loading={busy} />
            </div>
          </div>
        </div>
      </div>
      <Modal title="重命名会话" open={!!renaming} onCancel={() => setRenaming(null)} onOk={renameSession} okText="保存" cancelText="取消" width={420} destroyOnHidden>
        <Input value={(renaming && renaming.title) || ''} maxLength={60} placeholder="会话名称" autoFocus
          onChange={e => setRenaming(r => ({ ...r, title: e.target.value }))} onPressEnter={renameSession} />
      </Modal>
    </div>
  );
}

/* ================= 市场（技能市场 + MCP 市场） (Spec D/E) ================= */
function MarketCard({ title, badge, sub, desc, meta, info, installed, onAdd, onRemove, onView, removeLabel, removeConfirm, actionEl }) {
  // 删除/移出按钮：有「详情」主操作时退化为小图标（危险色），避免铺满整行喧宾夺主
  const compactRemove = installed && onView;
  let removeEl;
  if (installed && onRemove) {
    const iconBtn = <Tooltip title={removeLabel || '移出本空间'}><Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={removeConfirm ? undefined : onRemove} /></Tooltip>;
    const fullBtn = <Button size="small" danger ghost onClick={removeConfirm ? undefined : onRemove} style={{ flex: 1 }}>{removeLabel || '移出本空间'}</Button>;
    const el = compactRemove ? iconBtn : fullBtn;
    removeEl = removeConfirm
      ? <Popconfirm title={removeConfirm} okText="删除" okButtonProps={{ danger: true }} cancelText="取消" onConfirm={onRemove}>{el}</Popconfirm>
      : el;
  }
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 6, padding: 14, background: '#fff', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 140 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {sub && <div style={{ fontSize: 11.5, color: '#94A3B8', fontFamily: 'ui-monospace,Menlo,monospace', marginTop: 1 }}>{sub}</div>}
        </div>
        {badge}
      </div>
      <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.55, flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{desc || '—'}</div>
      {meta}
      {info && <div style={{ fontSize: 11.5, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}>{info}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 2, alignItems: 'center' }}>
        {installed
          ? (actionEl
              ? <>{onView && <Button size="small" onClick={onView} style={{ flex: 1 }}>详情</Button>}{actionEl}</>
              : compactRemove
                ? <><Button size="small" onClick={onView} style={{ flex: 1 }}>详情</Button>{removeEl}</>
                : removeEl)
          : <>{onAdd && <Button size="small" type="primary" icon={<PlusOutlined />} onClick={onAdd} style={{ flex: 1 }}>加入本空间</Button>}
             {onView && <Button size="small" onClick={onView} style={{ flex: onAdd ? 'none' : 1 }}>详情</Button>}</>}
      </div>
    </div>
  );
}

/* 已启用清单（本空间） */
function EnabledStrip({ title, rows, onRemove, render, onItemClick, emptyHint }) {
  return (
    <div style={{ background: '#FAFAFB', border: '1px solid #EBEBF1', borderRadius: 8, padding: 14, marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 650, color: '#33333C', marginBottom: rows.length ? 10 : 0 }}>{title}（{rows.length}）</div>
      {rows.length === 0 ? <div style={{ fontSize: 12, color: '#A6A8B4' }}>{emptyHint || '本空间还没有启用'}</div>
        : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {rows.map(r => (
              <div key={r.id} onClick={onItemClick ? () => onItemClick(r) : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #EBEBF1', borderRadius: 6, padding: '6px 10px', cursor: onItemClick ? 'pointer' : 'default' }}>
                {render(r)}
                <CloseOutlined onClick={e => { e.stopPropagation(); onRemove(r); }} style={{ fontSize: 11, color: '#A6A8B4', cursor: 'pointer' }} />
              </div>
            ))}
          </div>}
    </div>
  );
}

/* 把扁平文件清单 [{path,size,dir}] 转成 antd Tree 的 treeData */
function buildTree(entries) {
  const root = {};
  (entries || []).forEach(e => {
    const parts = e.path.replace(/\/$/, '').split('/').filter(Boolean);
    let cur = root;
    parts.forEach((part, i) => {
      const full = parts.slice(0, i + 1).join('/');
      cur[part] = cur[part] || { __node: { title: part, key: full, isLeaf: i === parts.length - 1 && !e.dir, size: e.size }, __children: {} };
      cur = cur[part].__children;
    });
  });
  const toArr = (obj) => Object.values(obj).sort((a, b) => {
    const al = a.__node.isLeaf, bl = b.__node.isLeaf;
    if (al !== bl) return al ? 1 : -1;            // 目录在前
    return a.__node.title.localeCompare(b.__node.title);
  }).map(n => {
    const kids = toArr(n.__children);
    return {
      key: n.__node.key, isLeaf: n.__node.isLeaf,
      icon: n.__node.isLeaf ? <FileOutlined /> : <FolderOutlined />,
      title: <span>{n.__node.title}{n.__node.isLeaf && n.__node.size != null && <span style={{ color: '#A6A8B4', fontSize: 11, marginLeft: 8 }}>{n.__node.size}B</span>}</span>,
      ...(kids.length ? { children: kids } : {}),
    };
  });
  return toArr(root);
}

/* 技能详情页（独立页面）：左侧目录树 + 右侧文件内容 / SKILL.md */
function SkillTreePage({ skill, wsId, onBack }) {
  const [sel, setSel] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  React.useEffect(() => { setSel(null); setContent(''); }, [skill && skill.id]);
  if (!skill) return null;
  const treeData = buildTree(skill.tree);
  const openFile = async (key) => {
    setSel(key); setLoading(true);
    try { const d = await apiCall(`/api/skills/${encodeURIComponent(skill.id)}/file?ws=${wsId}&path=${encodeURIComponent(key)}`); setContent(d.content || ''); }
    catch (e) { setContent('（无法读取该文件：' + e.message + '）'); }
    finally { setLoading(false); }
  };
  return (
    <div>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ paddingLeft: 0, marginBottom: 12, color: '#475569' }}>返回技能列表</Button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{ width: 34, height: 34, borderRadius: 6, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, fontSize: 17 }}><BulbOutlined /></div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 760, color: '#0F172A', letterSpacing: -0.2 }}>{skill.name}
            <Tag bordered={false} style={{ marginLeft: 8, fontSize: 11, background: '#F1F5F9', color: '#475569' }}>{skill.source === 'upload' ? '上传包' : skill.source === 'custom' ? '自定义' : skill.source}</Tag></div>
          <div style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'ui-monospace,Menlo,monospace' }}>{skill.id}</div>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.65, margin: '10px 0 18px', maxWidth: 760 }}>{skill.description}</div>

      <div style={{ fontSize: 12.5, fontWeight: 760, color: '#0F172A', marginBottom: 10 }}>技能文件</div>
      {treeData.length > 0 ? (
        <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 320px)', minHeight: 340 }}>
          <div style={{ width: 300, border: '1px solid #DFE3EA', borderRadius: 6, padding: 8, overflow: 'auto', background: '#F8FAFC' }}>
            <Tree.DirectoryTree treeData={treeData} showIcon defaultExpandAll selectedKeys={sel ? [sel] : []}
              onSelect={(keys, { node }) => { if (node.isLeaf) openFile(node.key); }} />
          </div>
          <div style={{ flex: 1, minWidth: 0, border: '1px solid #DFE3EA', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11.5, color: '#94A3B8', padding: '8px 12px', borderBottom: '1px solid #EDF0F4', background: '#F8FAFC', fontFamily: 'ui-monospace,Menlo,monospace' }}>{sel || '← 点击左侧文件查看内容'}</div>
            {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
              : <pre style={{ margin: 0, padding: 14, fontSize: 12.5, lineHeight: 1.6, color: '#334155', background: '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'auto', flex: 1, fontFamily: 'ui-monospace, Menlo, monospace' }}>{content}</pre>}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>该技能无上传包文件，展示其 SKILL.md：</div>
          <pre style={{ margin: 0, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#334155', borderRadius: 6, padding: 14, fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 'calc(100vh - 360px)', overflow: 'auto', fontFamily: 'ui-monospace, Menlo, monospace' }}>{skill.skill_md}</pre>
        </div>
      )}
    </div>
  );
}

/* MCP 详情：展示标准 mcpServers 配置（MCP 协议形态） */
/* ===== MCP 视觉 token（对齐「产品文档/视觉规范.dc.html」）===== */
const MT = {
  ink900: '#0f172a', ink700: '#334155', ink650: '#475569', ink500: '#64748b', ink350: '#94a3b8',
  lineStrong: '#dfe3ea', line: '#e2e8f0', lineSoft: '#edf0f4', rail: '#f8fafc', muted: '#f1f5f9',
  accent: '#2563eb', indigo: '#4f46e5', accentSoft: '#eef0ff',
  success: '#047857', successSoft: '#ecfdf5', warning: '#b45309', warningSoft: '#fffbeb', danger: '#dc2626',
};
const mtag = (bg, color) => ({ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 7px', borderRadius: 4, fontSize: 11.5, fontWeight: 700, lineHeight: 1, background: bg, color, whiteSpace: 'nowrap' });
const transportTag = (t) => t === 'sse'
  ? <span style={mtag('#eef0ff', '#4f46e5')}>SSE</span>
  : t === 'http'
    ? <span style={mtag('#eef0ff', '#4f46e5')}>Streamable HTTP</span>
    : <span style={mtag(MT.muted, MT.ink650)}>本地 stdio</span>;
const scopeTag = (isPlat, disabled) => isPlat
  ? <span style={mtag(disabled ? MT.muted : MT.successSoft, disabled ? MT.ink500 : MT.success)}>{disabled ? '公开·已禁用' : '公开'}</span>
  : <span style={mtag(MT.muted, MT.ink650)}>本空间</span>;

function McpDetailModal({ open, mcp, wsId, onClose }) {
  const [probe, setProbe] = React.useState({ state: 'idle', tools: [], err: '' });
  React.useEffect(() => { setProbe({ state: 'idle', tools: [], err: '' }); }, [mcp && mcp.id]);
  if (!mcp) return null;
  const desc = mcp.desc || mcp.summary || '';
  const env = mcp.env || [];
  const isRemote = mcp.transport === 'http' || mcp.transport === 'sse';
  const isPlat = mcp.scope === 'platform';
  let server;
  if (isRemote) {
    server = { type: mcp.transport, url: mcp.url || '' };
    if (mcp.headers && Object.keys(mcp.headers).length) server.headers = mcp.headers;
  } else {
    server = { type: 'stdio', command: mcp.command, args: mcp.args || [] };
    if (env.length) server.env = Object.fromEntries(env.map(k => [k, '<在运行环境配置>']));
  }
  const cfg = JSON.stringify({ mcpServers: { [mcp.id]: server } }, null, 2);
  const runProbe = async () => {
    setProbe({ state: 'loading', tools: [], err: '' });
    try {
      const r = await apiCall(`/api/tools/${encodeURIComponent(mcp.id)}/probe?ws=${wsId}`, { method: 'POST' });
      setProbe({ state: 'done', tools: r.tools || [], err: '' });
    } catch (e) { setProbe({ state: 'error', tools: [], err: (e.message || '').replace(/^\d+\s*/, '') || '连接失败' }); }
  };
  const secLabel = { fontSize: 11, fontWeight: 760, letterSpacing: '.04em', textTransform: 'uppercase', color: MT.ink350 };
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={640} styles={{ body: { paddingTop: 4 } }}
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 760, color: MT.ink900 }}>{mcp.name}</span>
        {scopeTag(isPlat, mcp.disabled)}{transportTag(mcp.transport)}
      </span>}>
      <div style={{ fontSize: 12.5, color: MT.ink500, lineHeight: 1.65, margin: '2px 0 14px' }}>{desc || '—'}</div>

      {isRemote && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ ...mtag(MT.rail, MT.ink650), height: 24, fontWeight: 600, fontFamily: 'ui-monospace,Menlo,monospace', maxWidth: 440, overflow: 'hidden', textOverflow: 'ellipsis', border: '1px solid ' + MT.line }}>{mcp.url}</span>
        {Object.keys(mcp.headers || {}).map(h => <span key={h} style={mtag(MT.warningSoft, MT.warning)}>头 {h}</span>)}
      </div>}

      {/* 接口列表：连接远程 MCP 探测其 tools */}
      {isRemote && <div style={{ border: '1px solid ' + MT.lineStrong, borderRadius: 6, marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: MT.rail, borderBottom: '1px solid ' + MT.lineSoft }}>
          <span style={secLabel}>提供的接口{probe.state === 'done' ? ` · ${probe.tools.length}` : ''}</span>
          <Button size="small" icon={<ReloadOutlined />} loading={probe.state === 'loading'} onClick={runProbe}>
            {probe.state === 'idle' ? '获取接口列表' : '重新探测'}
          </Button>
        </div>
        <div style={{ padding: probe.state === 'idle' ? '14px 12px' : 0 }}>
          {probe.state === 'idle' && <div style={{ fontSize: 12, color: MT.ink350 }}>点击「获取接口列表」实时连接该 MCP，列出它暴露的工具接口。</div>}
          {probe.state === 'loading' && <div style={{ padding: 18, textAlign: 'center' }}><Spin size="small" /></div>}
          {probe.state === 'error' && <div style={{ padding: '14px 12px', fontSize: 12, color: MT.danger }}>探测失败：{probe.err}<div style={{ color: MT.ink350, marginTop: 4 }}>请检查地址、请求头凭证或该服务是否可达。</div></div>}
          {probe.state === 'done' && (probe.tools.length === 0
            ? <div style={{ padding: '14px 12px', fontSize: 12, color: MT.ink350 }}>该 MCP 未暴露任何工具接口。</div>
            : probe.tools.map((t, i) => (
                <div key={i} style={{ padding: '9px 12px', borderBottom: i < probe.tools.length - 1 ? '1px solid ' + MT.lineSoft : 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: MT.ink900, fontFamily: 'ui-monospace,Menlo,monospace' }}>{t.name}</div>
                  {t.description && <div style={{ fontSize: 12, color: MT.ink500, lineHeight: 1.55, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.description}</div>}
                </div>
              )))}
        </div>
      </div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={secLabel}>标准 mcpServers 配置</span>
        <Button size="small" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(cfg); antMsg.success('已复制'); }}>复制</Button>
      </div>
      <pre style={{ margin: 0, background: MT.rail, border: '1px solid ' + MT.line, color: MT.ink700, borderRadius: 6, padding: 12, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 260, overflow: 'auto', fontFamily: 'ui-monospace, Menlo, monospace' }}>{cfg}</pre>
    </Modal>
  );
}

/* MCP 高密度行（对齐视觉规范：紧凑行 + 语义标签 + 轻操作） */
function McpRow({ m, onView, onRemove, onToggle }) {
  const isPlat = m.scope === 'platform';
  const isRemote = m.transport === 'http' || m.transport === 'sse';
  const dim = m.disabled ? 0.5 : 1;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,1.7fr) 132px minmax(0,1.5fr) 92px 128px', gap: 12, alignItems: 'center', minHeight: 52, padding: '9px 14px', borderBottom: '1px solid ' + MT.lineSoft }}
      onMouseEnter={e => (e.currentTarget.style.background = MT.rail)} onMouseLeave={e => (e.currentTarget.style.background = '')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, opacity: dim }}>
        <div style={{ width: 28, height: 28, flexShrink: 0, border: '1px solid ' + MT.line, borderRadius: 6, background: MT.rail, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MT.ink500 }}><ToolOutlined /></div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: MT.ink900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
          <div style={{ fontSize: 11.5, color: MT.ink500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.summary || m.desc || '—'}</div>
        </div>
      </div>
      <div style={{ opacity: dim }}>{transportTag(m.transport)}</div>
      <div style={{ opacity: dim, fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11.5, color: MT.ink500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {isRemote ? m.url : `${m.command || ''} ${(m.args || []).slice(0, 2).join(' ')}`.trim()}
      </div>
      <div style={{ opacity: dim }}>{scopeTag(isPlat, m.disabled)}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
        <Button size="small" type="text" style={{ color: MT.accent, padding: '0 6px' }} onClick={() => onView(m)}>详情</Button>
        {isPlat
          ? <Button size="small" type="text" style={{ padding: '0 6px', color: m.disabled ? MT.accent : MT.ink500 }} onClick={() => onToggle(m)}>{m.disabled ? '启用' : '禁用'}</Button>
          : <Popconfirm title="删除该 MCP？" okText="删除" okButtonProps={{ danger: true }} cancelText="取消" onConfirm={() => onRemove(m)}>
              <Tooltip title="删除"><Button size="small" type="text" danger icon={<DeleteOutlined />} style={{ padding: '0 6px' }} /></Tooltip>
            </Popconfirm>}
      </div>
    </div>
  );
}

// 可注册来源提示（需求 2.2）
const MCP_SOURCES_HINT = '可接入 Aone 开放市场、Zetta、灵境 等平台上的 MCP Server —— 复制其 Streamable HTTP / SSE 地址即可注册。';

export function McpMarket({ wsId }) {
  const [installed, setInstalled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reg, setReg] = useState(null);          // 注册 MCP 表单
  const [mdetail, setMdetail] = useState(null);  // 点行看详情
  const loadInstalled = () => { setLoading(true); return apiCall('/api/tools?ws=' + wsId).then(rows => setInstalled(rows || [])).catch(() => {}).finally(() => setLoading(false)); };
  React.useEffect(() => { loadInstalled(); }, [wsId]);
  const remove = async (m) => { try { await apiCall(`/api/tools/${encodeURIComponent(m.id)}?ws=${wsId}`, { method: 'DELETE' }); antMsg.success('已删除 MCP'); loadInstalled(); } catch (e) { antMsg.error(e.message); } };
  // 平台全局项：本空间不可删，只能禁用/启用（不影响其他空间与平台定义）
  const toggleScope = async (m) => { try { await apiCall(`/api/scope/mcp/${encodeURIComponent(m.id)}/${m.disabled ? 'enable' : 'disable'}?ws=${wsId}`, { method: 'POST' }); antMsg.success(m.disabled ? '已在本空间启用' : '已在本空间禁用'); loadInstalled(); } catch (e) { antMsg.error(e.message); } };
  const submitReg = async () => {
    try {
      const toPlatform = reg.scope === 'platform';
      if (reg.mode === 'json') {
        let cfg;
        try { cfg = JSON.parse(reg.json || ''); } catch { antMsg.error('JSON 解析失败，请检查格式'); return; }
        const path = toPlatform ? '/api/platform/mcp/register-json' : `/api/market/mcp/register-json?ws=${wsId}`;
        const r = await apiCall(path, { method: 'POST', body: JSON.stringify({ config: cfg, desc: reg.desc || '' }) });
        antMsg.success(`已${toPlatform ? '公开发布' : '注册'} ${r.count} 个 MCP`);
      } else {
        const t = reg.transport || 'http';
        if (!reg.name) { antMsg.error('服务器名称必填'); return; }
        if (!reg.url) { antMsg.error('服务器地址必填'); return; }
        const body: any = {
          name: reg.name, desc: reg.desc || '', transport: t, url: reg.url,
          headers: Object.fromEntries((reg.headers || []).filter(h => (h.k || '').trim()).map(h => [h.k.trim(), h.v || ''])),
        };
        const path = toPlatform ? '/api/platform/mcp/register' : `/api/market/mcp/register?ws=${wsId}`;
        await apiCall(path, { method: 'POST', body: JSON.stringify(body) });
        antMsg.success(`已${toPlatform ? '公开发布' : '注册'} MCP「${reg.name}」`);
      }
      setReg(null); loadInstalled();
    } catch (e) { antMsg.error(e.message); }
  };
  const openReg = () => setReg({ mode: 'form', transport: 'http', scope: 'workspace', headers: [] });
  const HeaderBtn = <Button type="primary" icon={<PlusOutlined />} onClick={openReg} style={{ background: MT.ink900, borderColor: MT.ink900 }}>注册 MCP</Button>;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12.5, color: MT.ink500 }}>本空间可用 MCP <b style={{ color: MT.ink900 }}>{installed.length}</b> · 含<span style={{ color: MT.success }}>公开</span>（全平台共享）+ 本空间私有</div>
          <div style={{ fontSize: 11.5, color: MT.ink350, marginTop: 3 }}>{MCP_SOURCES_HINT}</div>
        </div>
        {HeaderBtn}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        : installed.length === 0
          ? <div style={{ border: '1px dashed ' + MT.lineStrong, borderRadius: 6, padding: '40px 0', background: MT.rail }}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本空间还没有 MCP">{HeaderBtn}</Empty>
            </div>
          : <div style={{ border: '1px solid ' + MT.lineStrong, borderRadius: 6, background: '#fff', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,1.7fr) 132px minmax(0,1.5fr) 92px 128px', gap: 12, padding: '8px 14px', background: MT.rail, borderBottom: '1px solid ' + MT.lineStrong, fontSize: 11, fontWeight: 760, letterSpacing: '.04em', color: MT.ink500, textTransform: 'uppercase' }}>
                <span>MCP</span><span>类型</span><span>接入地址</span><span>范围</span><span style={{ textAlign: 'right' }}>操作</span>
              </div>
              {installed.map(m => <McpRow key={m.id} m={m} onView={setMdetail} onRemove={remove} onToggle={toggleScope} />)}
            </div>}

      <McpDetailModal open={!!mdetail} mcp={mdetail} wsId={wsId} onClose={() => setMdetail(null)} />
      <Modal open={!!reg} onCancel={() => setReg(null)} onOk={submitReg}
        okText={reg && reg.scope === 'platform' ? '公开发布' : '注册到本空间'} title="注册 MCP" width={560} destroyOnClose>
        {reg && <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8, padding: '9px 11px', background: MT.rail, border: '1px solid ' + MT.line, borderRadius: 6, marginBottom: 14, fontSize: 12, color: MT.ink650, lineHeight: 1.55 }}>
            <span style={{ color: MT.accent, fontWeight: 700 }}>ⓘ</span><span>{MCP_SOURCES_HINT}</span>
          </div>

          <Segmented block value={reg.mode} onChange={mode => setReg({ ...reg, mode })}
            options={[{ label: '表单', value: 'form' }, { label: 'JSON', value: 'json' }]} style={{ marginBottom: 16 }} />

          {reg.mode === 'json'
            ? <Field label="MCP 注册 JSON" required hint="粘贴标准 mcpServers 配置（仅支持 http/sse 远程类型）；可一次注册多个 server">
                <Input.TextArea rows={10} value={reg.json} onChange={e => setReg({ ...reg, json: e.target.value })}
                  placeholder={'{\n  "mcpServers": {\n    "my-server": {\n      "type": "http",\n      "url": "https://example.com/mcp",\n      "headers": { "Authorization": "Bearer xxx" }\n    }\n  }\n}'}
                  style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12 }} />
              </Field>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="服务器类型" required>
                  <Segmented value={reg.transport} onChange={transport => setReg({ ...reg, transport })}
                    options={[{ label: 'Streamable HTTP', value: 'http' }, { label: 'SSE', value: 'sse' }]} />
                </Field>
                <Field label="服务器名称" required><Input value={reg.name} onChange={e => setReg({ ...reg, name: e.target.value })} placeholder="如：内部工单系统" /></Field>
                <Field label="用途简介"><Input value={reg.desc} onChange={e => setReg({ ...reg, desc: e.target.value })} placeholder="一句话说明这个 MCP 能做什么" /></Field>
                <Field label="服务器地址" required><Input value={reg.url} onChange={e => setReg({ ...reg, url: e.target.value })} placeholder="https://example.com/mcp" /></Field>
                <Field label="请求头 Header" hint="可选，逐条添加（如 Authorization: Bearer xxx）">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(reg.headers || []).map((h, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8 }}>
                        <Input placeholder="名（如 Authorization）" value={h.k} onChange={e => { const hs = [...reg.headers]; hs[i] = { ...hs[i], k: e.target.value }; setReg({ ...reg, headers: hs }); }} />
                        <Input placeholder="值（如 Bearer xxx）" value={h.v} onChange={e => { const hs = [...reg.headers]; hs[i] = { ...hs[i], v: e.target.value }; setReg({ ...reg, headers: hs }); }} />
                        <Button onClick={() => setReg({ ...reg, headers: reg.headers.filter((_, j) => j !== i) })}>删除</Button>
                      </div>
                    ))}
                    <Button size="small" icon={<PlusOutlined />} onClick={() => setReg({ ...reg, headers: [...(reg.headers || []), { k: '', v: '' }] })} style={{ alignSelf: 'flex-start' }}>添加 Header</Button>
                  </div>
                </Field>
              </div>}

          <div style={{ borderTop: '1px solid ' + MT.lineSoft, margin: '16px 0 12px' }} />
          <Field label="发布范围" required hint={reg.scope === 'platform' ? '公开：作为全平台可引用的公共工具，所有用户可见。' : '仅本项目空间可见，其他空间不可引用。'}>
            <Segmented block value={reg.scope} onChange={scope => setReg({ ...reg, scope })}
              options={[{ label: '仅本项目空间', value: 'workspace' }, { label: '公开（全平台可见）', value: 'platform' }]} />
          </Field>
        </div>}
      </Modal>
    </div>
  );
}

export function SkillMarket({ wsId, me }) {
  const [installed, setInstalled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);      // 进入「详情页」的技能
  const [newOpen, setNewOpen] = useState(false);   // 新建技能弹窗
  const [uploading, setUploading] = useState(false);
  const loadInstalled = () => { setLoading(true); return apiCall('/api/skills?ws=' + wsId).then(rows => setInstalled(rows || [])).catch(() => {}).finally(() => setLoading(false)); };
  React.useEffect(() => { loadInstalled(); }, [wsId]);
  const remove = async (s) => { try { await apiCall(`/api/skills/${encodeURIComponent(s.id)}?ws=${wsId}`, { method: 'DELETE' }); antMsg.success('已删除技能'); loadInstalled(); } catch (e) { antMsg.error(e.message); } };
  const uploadProps = {
    name: 'file', accept: '.zip,.tar,.tar.gz,.tgz', showUploadList: false, multiple: false,
    customRequest: async ({ file, onSuccess, onError }) => {
      setUploading(true);
      const fd = new FormData(); fd.append('file', file); fd.append('creator', me || '我');
      try {
        const r = await fetch(`/api/market/skills/upload?ws=${wsId}`, { method: 'POST', body: fd });
        if (!r.ok) { const t = await r.text(); let m = t; try { m = JSON.parse(t).detail || t; } catch {} throw new Error(m); }
        const d = await r.json();
        antMsg.success(`已新建技能「${d.name}」（${d.files} 个文件，SKILL.md：${d.skill_path}）`);
        onSuccess && onSuccess(d); setNewOpen(false); loadInstalled();
      } catch (e) { antMsg.error('上传失败：' + (e.message || e)); onError && onError(e); }
      finally { setUploading(false); }
    },
  };

  // 详情：独立页面
  if (detail) return <SkillTreePage skill={detail} wsId={wsId} onBack={() => { setDetail(null); loadInstalled(); }} />;

  const platCount = installed.filter(s => s.scope === 'platform').length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748B' }}>Skill Library</div>
          <div style={{ marginTop: 2, fontSize: 22, fontWeight: 760, lineHeight: 1.15, color: '#0F172A' }}>技能</div>
          <div style={{ marginTop: 5, fontSize: 12.5, color: '#64748B' }}>本空间可用的 Agent Skill：打包上传含 <code>SKILL.md</code> 的目录，在创建 / 编辑 Agent 时绑定。</div>
        </div>
        <Space size={8}>
          <Button icon={<ReloadOutlined />} onClick={() => { loadInstalled(); antMsg.success('已刷新'); }}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewOpen(true)}>新建技能</Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 18, marginBottom: 14, fontSize: 12.5, color: '#475569' }}>
        <span>可用技能 <b style={{ color: '#0F172A' }}>{installed.length}</b></span>
        <span>平台全局 <b style={{ color: '#2563EB' }}>{platCount}</b><span style={{ color: '#94A3B8' }}>（所有空间共享）</span></span>
        <span>本空间私有 <b style={{ color: '#0F172A' }}>{installed.length - platCount}</b></span>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        : installed.length === 0
          ? <div style={{ border: '1px dashed #DFE3EA', borderRadius: 6, padding: '40px 0', background: '#F8FAFC' }}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本空间还没有技能">
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewOpen(true)}>新建技能</Button>
              </Empty>
            </div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 12 }}>
              {installed.map(s => { const isPlat = s.scope === 'platform'; return (
                <MarketCard key={s.id} title={s.name} sub={s.id} desc={s.description} installed
                  removeLabel="删除" removeConfirm={isPlat ? undefined : `删除技能「${s.name}」？（软删除，可重新上传同名恢复）`}
                  badge={isPlat ? <Tag bordered={false} style={{ fontSize: 11, background: '#EEF2FF', color: '#2563EB' }}>全局</Tag>
                    : s.source === 'upload' ? <Tag bordered={false} style={{ fontSize: 11, background: '#F1F5F9', color: '#475569' }}>{(s.tree || []).filter(e => !e.dir).length} 文件</Tag>
                    : <Tag bordered={false} style={{ fontSize: 11, background: '#F1F5F9', color: '#475569' }}>{s.source === 'custom' ? '自定义' : s.source}</Tag>}
                  info={<><UserOutlined style={{ fontSize: 11 }} /> {s.creator || '—'} · {s.added_at || '—'}</>}
                  onRemove={isPlat ? undefined : () => remove(s)}
                  onView={() => setDetail(s)}
                  meta={(s.allowed_tools || []).length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {s.allowed_tools.map(t => <span key={t} style={pill('#F1F5F9', '#475569')}>{t}</span>)}</div> : null} />
              ); })}
            </div>}

      <Modal open={newOpen} onCancel={() => setNewOpen(false)} footer={null} title="新建技能" width={560} destroyOnClose>
        <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.6, margin: '4px 0 16px', background: '#F8FAFC', border: '1px solid #EDF0F4', borderRadius: 6, padding: '10px 12px' }}>
          技能 = 一个含 <code>SKILL.md</code> 的目录（Claude Agent Skill 规格）。把它打包成压缩包上传，系统会自动解析 <b>name</b> 与 <b>description</b>。
        </div>
        <Upload.Dragger {...uploadProps} disabled={uploading}>
          <p style={{ margin: '6px 0 10px' }}>{uploading ? <Spin /> : <InboxOutlined style={{ fontSize: 38, color: ACCENT }} />}</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', margin: 0 }}>点击或拖拽技能包到此处上传</p>
          <p style={{ fontSize: 12.5, color: '#94A3B8', margin: '6px 0 0' }}>支持 .zip / .tar / .tar.gz；包内（根目录或子目录）需含 SKILL.md</p>
        </Upload.Dragger>
      </Modal>
    </div>
  );
}

export function Market({ wsId, wsName, me }) {
  if (!API_ON) return <Empty description="市场需先在本机启动后端（技能与 MCP 均由本空间注册 / 上传）" />;
  return (
    <div>
      <div style={{ fontSize: 12.5, color: '#70727E', marginBottom: 14 }}>
        当前空间：<b style={{ color: '#33333C' }}>{wsName || wsId}</b> · 本空间的技能 / MCP <b>仅本空间可用</b>，在本空间创建 / 编辑 Agent 时可选
      </div>
      <Tabs defaultActiveKey="mcp" items={[
        { key: 'mcp', label: <span><ToolOutlined /> MCP 市场</span>, children: <McpMarket wsId={wsId} /> },
        { key: 'skill', label: <span><BulbOutlined /> 技能市场</span>, children: <SkillMarket wsId={wsId} me={me} /> },
      ]} />
    </div>
  );
}

/* ================= 部署（发布与运行控制台：发起部署 + 版本钉选 × 环境 tier + 稳定地址 + 运维）================= */
/* 抽屉左右拖拽调宽：返回受控 width + 拖拽起手；把手渲染在 Drawer 同级、用 fixed 定位，
   不受 Drawer 自身动画 transform 影响，拖左加宽、拖右变窄（右侧抽屉）。 */
function useDrawerResize(initial = 600) {
  const [width, setWidth] = useState(initial);
  const startResize = e => {
    e.preventDefault();
    const onMove = ev => setWidth(Math.min(window.innerWidth - 180, Math.max(360, window.innerWidth - ev.clientX)));
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.userSelect = ''; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.userSelect = 'none';
  };
  return { width, startResize };
}
function DrawerResizer({ open, width, onStart }) {
  if (!open) return null;
  return (
    <div onMouseDown={onStart} title="拖拽调整宽度"
      style={{ position: 'fixed', top: 0, bottom: 0, left: `calc(100vw - ${width}px - 4px)`, width: 10, cursor: 'col-resize', zIndex: 1002, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 4, height: 42, borderRadius: 3, background: '#C7C8D2' }} />
    </div>
  );
}

/* ================= 定时任务（deployment = 可触发的任务模板，对齐 Claude managed agents）================= */
// 每次触发（cron 到点 / 手动「立即运行」）= 后端创建一条 session（source=schedule）跑完整一轮 + 写 run 台账；
// 完整运行过程与结果 = 该 session 本身 → 「查看会话」深链到会话 tab（单一事实来源，不在此复制会话视图）。

const CRON_PRESETS = [
  { label: '每 5 分钟', value: '*/5 * * * *' },
  { label: '每小时整点', value: '0 * * * *' },
  { label: '每天 09:00', value: '0 9 * * *' },
  { label: '每周一 09:00', value: '0 9 * * 1' },
  { label: '每月 1 号 09:00', value: '0 9 1 * *' },
  { label: '自定义 cron…', value: '__custom' },
];
const _schedText = d => d.scheduleType === 'cron'
  ? ((CRON_PRESETS.find(p => p.value === d.cronExpr) || {}).label || d.cronExpr)
  : d.scheduleType === 'once' ? `一次性 · ${d.runAt || ''}` : '仅手动';
const _trigText = t => t === 'manual' ? '手动' : t === 'once' ? '一次性' : '定时';
const _durText = r => {
  if (!r || !r.startedAt || !r.finishedAt) return '';
  const s = Math.max(0, Math.round((new Date(r.finishedAt.replace(' ', 'T')) - new Date(r.startedAt.replace(' ', 'T'))) / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`;
};
// 视觉规范（产品文档/视觉规范.dc.html，authoritative）语义标签色
const _runPill = st => st === 'succeeded' ? <span style={pill('#ECFDF5', '#047857')}>✓ 成功</span>
  : st === 'failed' ? <span style={pill('#FEE2E2', '#DC2626')}>✕ 失败</span>
  : st === 'skipped' ? <span style={pill('#F1F5F9', '#64748B')}>⊘ 跳过</span>
  : <span style={pill('#FFFBEB', '#B45309')}>◌ 运行中</span>;
// 中性药丸（版本策略 / 环境 / 触发方式）——规范中性面 #F1F5F9 / ink-650 #475569
const _neuPill = txt => <span style={pill('#F1F5F9', '#475569')}>{txt}</span>;

export function SchedulePanel({ agents, onOpenSession }) {
  const [data, setData] = useState({ items: [], todayRuns: 0, todayFailed: 0 });
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');              // 按任务名 / Agent 搜索
  const [fEnabled, setFEnabled] = useState('ALL'); // 启用状态过滤
  const [dm, setDm] = useState(null);          // 新建/编辑表单 {id?, name, agentId, versionPolicy, isolation, prompt, scheduleType, cronExpr/preset, runAt}
  const [saving, setSaving] = useState(false);
  const [hist, setHist] = useState(null);      // 运行历史抽屉 {dep, runs}
  const load = () => { if (!API_ON) return; apiCall('/api/deployments').then(setData).catch(() => {}); };
  React.useEffect(() => { setLoading(true); Promise.resolve(load()).finally(() => setLoading(false)); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);
  // 历史抽屉打开期间 5s 轮询（手动触发是异步的，要看到 running→succeeded 流转）
  const loadRuns = async dep => { try { const rs = await apiCall(`/api/deployments/${dep.id}/runs`); setHist(h => h && h.dep.id === dep.id ? { ...h, runs: rs } : h); } catch {} };
  React.useEffect(() => { if (!hist) return; loadRuns(hist.dep); const t = setInterval(() => loadRuns(hist.dep), 5000); return () => clearInterval(t); }, [hist && hist.dep.id]);

  const dmAgent = dm && (agents || []).find(a => a.id === dm.agentId);
  const pubAgents = (agents || []).filter(a => a.published);   // 只有已发布 Agent 能建定时任务（环境/版本都来自发布）
  const openNew = () => setDm({ name: '', agentId: pubAgents[0] && pubAgents[0].id, versionPolicy: 'latest', prompt: '', scheduleType: 'cron', preset: '0 9 * * *', cronExpr: '0 9 * * *', runAt: null });
  const openEdit = d => setDm({ id: d.id, name: d.name, agentId: d.agentId, versionPolicy: d.versionPolicy, prompt: d.prompt, scheduleType: d.scheduleType, preset: CRON_PRESETS.some(p => p.value === d.cronExpr) ? d.cronExpr : '__custom', cronExpr: d.cronExpr || '', runAt: d.runAt });
  const save = async () => {
    if (!dm.name || !dm.name.trim()) { antMsg.warning('请填任务名'); return; }
    if (!dm.agentId) { antMsg.warning('请选 Agent'); return; }
    if (dm.scheduleType === 'cron' && !(dm.cronExpr || '').trim()) { antMsg.warning('请填 cron 表达式'); return; }
    if (dm.scheduleType === 'once' && !dm.runAt) { antMsg.warning('请选运行时刻'); return; }
    const body = JSON.stringify({ name: dm.name.trim(), agentId: dm.agentId, versionPolicy: dm.versionPolicy, prompt: dm.prompt || '', scheduleType: dm.scheduleType, cronExpr: dm.scheduleType === 'cron' ? dm.cronExpr.trim() : null, runAt: dm.scheduleType === 'once' ? dm.runAt : null });
    setSaving(true);
    try {
      await apiCall(dm.id ? `/api/deployments/${dm.id}` : '/api/deployments', { method: dm.id ? 'PATCH' : 'POST', body });
      antMsg.success(dm.id ? '已保存' : '已创建定时任务'); setDm(null); load();
    } catch (e) { antMsg.error(e.message); } finally { setSaving(false); }
  };
  const toggle = async d => { try { await apiCall(`/api/deployments/${d.id}`, { method: 'PATCH', body: JSON.stringify({ enabled: !d.enabled }) }); load(); } catch (e) { antMsg.error(e.message); } };
  const del = async d => { try { await apiCall(`/api/deployments/${d.id}`, { method: 'DELETE' }); antMsg.success('已删除（运行台账保留）'); load(); } catch (e) { antMsg.error(e.message); } };
  const runNow = async d => {
    try { await apiCall(`/api/deployments/${d.id}/run`, { method: 'POST' }); antMsg.success('已触发，正在运行…'); setHist({ dep: d, runs: null }); load(); }
    catch (e) { antMsg.error(e.message); }
  };

  const total = (data.items || []).length;
  const items = (data.items || []).filter(d =>
    (!q || (d.name || '').toLowerCase().includes(q.toLowerCase()) || (d.agentName || '').toLowerCase().includes(q.toLowerCase())) &&
    (fEnabled === 'ALL' || (fEnabled === 'on' ? d.enabled : !d.enabled)));
  const { width: histW, startResize: histResize } = useDrawerResize(620);
  return (
    <div>
      <style>{`.sched-row{transition:background .12s ease}.sched-row:hover{background:#F8FAFC}`}</style>

      {/* 页头 · 规范 §03/§08：22px/760 标题 + 12.5px 说明 + 单一主入口 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 760, letterSpacing: -0.2, color: '#0F172A', lineHeight: 1.15 }}>定时任务</div>
          <div style={{ marginTop: 5, color: '#64748B', fontSize: 12.5 }}>把 Agent 配置成按计划自动运行的任务：到点触发（或手动「立即运行」）都会产生一次运行与对应会话，全程可回看。</div>
        </div>
        <Tooltip title={API_ON && pubAgents.length === 0 ? '需先发布至少一个 Agent，才能为它建定时任务' : ''}>
          <Button type="primary" icon={<PlusOutlined />} disabled={!API_ON || pubAgents.length === 0} onClick={openNew}>新建定时任务</Button>
        </Tooltip>
      </div>
      {!API_ON ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未连后端 · 定时任务需先在本机启动后端" />
        : loading && total === 0 ? <div style={{ padding: '48px 0', textAlign: 'center' }}><Spin /></div>
        : total === 0
        ? <div style={{ border: '1px dashed #DFE3EA', borderRadius: 6, padding: '32px 24px', background: '#F8FAFC', textAlign: 'center' }}>
            <ClockCircleOutlined style={{ fontSize: 26, color: '#94A3B8', marginBottom: 10 }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>还没有定时任务</div>
            <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 16 }}>{pubAgents.length === 0
              ? '定时任务只能建在已发布的 Agent 上。请先去「Agent」发布一个，再回来创建。'
              : '三步：① 选已发布的 Agent + 版本 ② 写任务指令 ③ 定计划（每天 / 每周 / cron），到点自动运行'}</div>
            <Tooltip title={pubAgents.length === 0 ? '需先发布至少一个 Agent' : ''}>
              <Button type="primary" icon={<PlusOutlined />} disabled={pubAgents.length === 0} onClick={openNew}>新建定时任务</Button>
            </Tooltip>
          </div>
        : (<>
          {/* 工具栏 · 规范 §04/§05：搜索 + 过滤横排，右侧计数与刷新 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Input allowClear prefix={<SearchOutlined style={{ color: '#94A3B8' }} />} placeholder="搜索任务名 / Agent" value={q} onChange={e => setQ(e.target.value)} style={{ width: 240 }} />
            <Segmented value={fEnabled} onChange={setFEnabled}
              options={[{ label: '全部', value: 'ALL' }, { label: '启用中', value: 'on' }, { label: '已停用', value: 'off' }]} />
            <div style={{ flex: 1 }} />
            <Text style={{ color: '#94A3B8', fontSize: 12.5 }}>共 {items.length} 个</Text>
            <Tooltip title="刷新"><Button type="text" icon={<ReloadOutlined />} onClick={load} /></Tooltip>
          </div>

          {/* 任务表格 · 规范 §05：表头 #F8FAFC/11px、发丝分割、行内主信息加粗、操作列固定右侧 */}
          <div style={{ border: '1px solid #DFE3EA', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ display: 'flex', fontSize: 11, letterSpacing: 0.3, textTransform: 'uppercase', color: '#64748B', fontWeight: 700, background: '#F8FAFC', padding: '9px 14px', borderBottom: '1px solid #DFE3EA' }}>
              <div style={{ flex: 1 }}>任务 / Agent</div><div style={{ width: 130 }}>调度</div><div style={{ width: 100 }}>下次运行</div><div style={{ width: 150 }}>上次运行</div><div style={{ width: 54 }}>启用</div><div style={{ width: 190 }} />
            </div>
            {items.length === 0
              ? <div style={{ padding: '28px 0' }}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的任务" /></div>
              : items.map(d => (
                <div key={d.id} className="sched-row" style={{ display: 'flex', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid #EDF0F4', opacity: d.enabled ? 1 : 0.6 }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                    <div style={{ marginTop: 3, color: '#64748B', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ ..._MONO }}>{d.agentName}</span>
                      {_neuPill(d.versionPolicy === 'latest' ? '跟随最新' : `钉住 v${(d.versionPolicy || '').split(':')[1] || '?'}`)}
                      <Tooltip title={d.isolationPublished ? '运行环境跟随该 Agent 发布设置' : 'Agent 未发布，运行时默认用 共享 L1'}>{_neuPill(d.isolation)}</Tooltip>
                    </div>
                  </div>
                  <div style={{ width: 130, fontSize: 12, color: '#475569' }}>{_schedText(d)}</div>
                  <div style={{ width: 100, fontSize: 12, color: '#475569' }}>{d.enabled && d.nextRunAt ? d.nextRunAt.slice(5) : '—'}</div>
                  <div style={{ width: 150 }}>
                    {d.lastRun
                      ? <a onClick={() => setHist({ dep: d, runs: null })} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'inherit' }}>
                          {_runPill(d.lastRun.status)}<span style={{ fontSize: 11.5, color: '#94A3B8' }}>{_durText(d.lastRun) || (d.lastRun.startedAt || '').slice(5, 16)}</span>
                        </a>
                      : <span style={{ fontSize: 12, color: '#94A3B8' }}>未运行过</span>}
                  </div>
                  <div style={{ width: 54 }}><Tooltip title={d.enabled ? '已启用 · 点击停用' : '已停用 · 点击启用'}><Switch size="small" checked={!!d.enabled} onChange={() => toggle(d)} /></Tooltip></div>
                  <div style={{ width: 190, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <Button size="small" icon={<PlayCircleOutlined />} onClick={() => runNow(d)}>立即运行</Button>
                    <Tooltip title="运行历史"><Button size="small" icon={<HistoryOutlined />} onClick={() => setHist({ dep: d, runs: null })} /></Tooltip>
                    <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(d)} /></Tooltip>
                    <Popconfirm title="删除该任务？" description="运行台账与历史会话保留" okText="删除" okButtonProps={{ danger: true }} onConfirm={() => del(d)}>
                      <Tooltip title="删除"><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
                    </Popconfirm>
                  </div>
                </div>
              ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#94A3B8' }}>每次运行的完整过程与结果沉淀为一条会话（来源＝定时任务），在「会话」里可回看全部历史。</div>
        </>)}

      {/* 新建 / 编辑 · 规范 §05 Modal：圆角 6、标题短、正文直接进入控件 */}
      <Modal title={dm && dm.id ? `编辑任务 · ${dm.name || ''}` : '新建定时任务'} open={!!dm} onCancel={() => setDm(null)} width={520} destroyOnHidden
        footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={() => setDm(null)}>取消</Button>
          <Button type="primary" loading={saving} onClick={save}>{dm && dm.id ? '保存' : '创建'}</Button>
        </div>}>
        {dm && <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '12px 0 4px' }}>
          <div><div style={{ fontSize: 12.5, color: '#64748B', fontWeight: 650, marginBottom: 6 }}>任务名</div>
            <Input value={dm.name} placeholder="如：每日竞品简报" maxLength={40} onChange={e => setDm(v => ({ ...v, name: e.target.value }))} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, color: '#64748B', fontWeight: 650, marginBottom: 6 }}>Agent</div>
              <Select value={dm.agentId} style={{ width: '100%' }} placeholder="选择已发布的 Agent" disabled={!!dm.id}
                onChange={id => setDm(v => ({ ...v, agentId: id, versionPolicy: 'latest' }))}
                options={pubAgents.map(a => ({ value: a.id, label: `${a.name}（${fwName(a.framework)}）` }))} /></div>
            <div style={{ width: 170 }}><div style={{ fontSize: 12.5, color: '#64748B', fontWeight: 650, marginBottom: 6 }}>版本<span style={{ color: '#94A3B8', fontWeight: 400 }}>（运行时解析）</span></div>
              <Select value={dm.versionPolicy} style={{ width: '100%' }} onChange={vp => setDm(v => ({ ...v, versionPolicy: vp }))}
                options={[{ value: 'latest', label: '跟随最新' },
                  ...Array.from({ length: (dmAgent && dmAgent.version) || 0 }, (_, i) => ({ value: `pin:${i + 1}`, label: `钉住 v${i + 1}` }))]} /></div>
          </div>
          <div><div style={{ fontSize: 12.5, color: '#64748B', fontWeight: 650, marginBottom: 6 }}>任务指令<span style={{ color: '#94A3B8', fontWeight: 400 }}>（每次运行发给 Agent 的开场消息，支持 {'{{date}}'} {'{{time}}'} {'{{task}}'}）</span></div>
            <Input.TextArea value={dm.prompt} rows={3} placeholder={'如：汇总 {{date}} 的竞品动态，输出 5 条要点'} onChange={e => setDm(v => ({ ...v, prompt: e.target.value }))} /></div>
          <div><div style={{ fontSize: 12.5, color: '#64748B', fontWeight: 650, marginBottom: 6 }}>运行环境<span style={{ color: '#94A3B8', fontWeight: 400 }}>（跟随 Agent 发布设置）</span></div>
            <div style={{ padding: '7px 11px', border: '1px solid #E2E8F0', borderRadius: 6, background: '#F8FAFC', fontSize: 12.5, color: '#475569', display: 'flex', alignItems: 'center', gap: 8 }}>
              {dmAgent && dmAgent.publishedIsolation
                ? <>复用发布环境 {_neuPill(`${dmAgent.publishedIsolation} · ${isoName(dmAgent.publishedIsolation)}`)}</>
                : <span style={{ color: '#94A3B8' }}>选择 Agent 后显示其发布环境</span>}
            </div>
            <div style={{ marginTop: 5, fontSize: 11.5, color: '#94A3B8' }}>运行环境在发布 Agent 时选择，定时任务直接复用，无需在此重复配置。</div></div>
          <div><div style={{ fontSize: 12.5, color: '#64748B', fontWeight: 650, marginBottom: 6 }}>调度</div>
            <Segmented block value={dm.scheduleType} onChange={st => setDm(v => ({ ...v, scheduleType: st }))}
              options={[{ label: '重复（cron）', value: 'cron' }, { label: '一次性', value: 'once' }, { label: '仅手动', value: 'manual' }]} />
            {dm.scheduleType === 'cron' && <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <Select value={dm.preset} style={{ width: 180, flexShrink: 0 }}
                onChange={p => setDm(v => ({ ...v, preset: p, cronExpr: p === '__custom' ? v.cronExpr : p }))}
                options={CRON_PRESETS.map(p => ({ value: p.value, label: p.label }))} />
              <Input value={dm.cronExpr} disabled={dm.preset !== '__custom'} placeholder="分 时 日 月 周，如 30 8 * * 1-5"
                onChange={e => setDm(v => ({ ...v, cronExpr: e.target.value }))} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }} /></div>}
            {dm.scheduleType === 'once' && <div style={{ marginTop: 8 }}>
              <DatePicker showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} placeholder="选择运行时刻"
                value={dm.runAt ? dayjs(dm.runAt) : null} onChange={t => setDm(v => ({ ...v, runAt: t ? t.format('YYYY-MM-DD HH:mm') : null }))} /></div>}
            {dm.scheduleType === 'manual' && <div style={{ marginTop: 8, fontSize: 12, color: '#94A3B8' }}>不自动触发，仅通过「立即运行」执行。</div>}
          </div>
        </div>}
      </Modal>

      {/* 运行历史 · 规范 §05 Drawer：白底、标题 16/700、内容分区浅描边 */}
      <DrawerResizer open={!!hist} width={histW} onStart={histResize} />
      <Drawer open={!!hist} width={histW} onClose={() => setHist(null)} styles={{ header: { borderBottom: '1px solid #EDF0F4' } }}
        title={hist && <div><div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{hist.dep.name} · 运行历史</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{hist.dep.agentName} · {_schedText(hist.dep)} · 每次运行=一条会话，点「查看会话」看完整过程</div></div>}>
        {hist && (hist.runs === null
          ? <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>
          : (hist.runs || []).length === 0
          ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有运行记录" />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(hist.runs || []).map(r => (
                <div key={r.id} style={{ border: '1px solid #E2E8F0', borderRadius: 6, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {_runPill(r.status)}
                    {_neuPill(_trigText(r.trigger))}
                    {r.version && _neuPill(`v${r.version}`)}
                    <span style={{ ..._MONO, fontSize: 12, color: '#64748B' }}>{r.startedAt}</span>
                    {_durText(r) && <span style={{ fontSize: 12, color: '#94A3B8' }}>耗时 {_durText(r)}</span>}
                    <span style={{ flex: 1 }} />
                    {r.sessionId && <Button size="small" onClick={() => { setHist(null); onOpenSession && onOpenSession(r.sessionId); }}>查看会话</Button>}
                  </div>
                  {(r.summary || r.error) && <div style={{ marginTop: 7, fontSize: 12.5, lineHeight: 1.55, color: r.error ? '#DC2626' : '#475569', whiteSpace: 'pre-wrap', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{r.error || r.summary}</div>}
                </div>
              ))}
            </div>)}
      </Drawer>
    </div>
  );
}

/* ================= 环境（Environment 一等资源，Phase 2）================= */
export function EnvPanel() {
  const [list, setList] = useState([]);
  const [reg, setReg] = useState(null);   // 新建表单 {name, isolation, description}
  const load = () => API_ON ? apiCall('/api/environments').then(d => setList(d || [])).catch(() => {}) : setList([]);
  React.useEffect(() => { load(); }, []);
  const create = async () => {
    if (!reg.name || !reg.name.trim()) { antMsg.error('名称必填'); return; }
    try { await apiCall('/api/environments', { method: 'POST', body: JSON.stringify({ name: reg.name.trim(), isolation: reg.isolation || 'L1', description: reg.description || '' }) }); antMsg.success('已创建环境'); setReg(null); load(); }
    catch (e) { antMsg.error(e.message); }
  };
  const del = async id => { try { await apiCall(`/api/environments/${id}`, { method: 'DELETE' }); load(); } catch (e) { antMsg.error(e.message); } };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 750, letterSpacing: -0.3, color: '#17171C' }}>环境</div>
          <Text style={{ color: '#8A8C99', fontSize: 13.5 }}>运行环境（沙箱）。发布/Session 绑定其一；内置三档 = 共享 L1 / 独立 L2 / 即用即弃 L3。L0 是租户边界（每用户一沙箱、跨用户绝不共享，始终生效、非可选）</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setReg({ isolation: 'L2' })}>新建环境</Button>
      </div>
      {!API_ON ? <Empty description="环境需先在本机启动后端" /> : (<>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '9px 12px', background: '#EEF0FF', border: '1px solid #D8DCFB', borderRadius: 8, fontSize: 12, color: '#4F46E5', lineHeight: 1.55, marginBottom: 14 }}>
          <LockOutlined style={{ marginTop: 2, flexShrink: 0 }} /><span>{TENANT_NOTE}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
          {list.map(e => (
            <div key={e.id} style={{ border: '1px solid #EBEBF1', borderRadius: 8, padding: 16, background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 650, fontSize: 14.5 }}>{e.name}</div>
                <span style={pill('#EEF0FF', '#4F46E5')}>{e.isolation}</span>
              </div>
              <div style={{ fontSize: 12.5, color: '#5A5C6B', lineHeight: 1.55, margin: '8px 0 10px', minHeight: 38 }}>{e.description || '—'}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={pill('#F1F1F4', '#5A5C6B')}>{e.builtin ? '内置' : '自定义'}</span>
                {!e.builtin && <Popconfirm title="删除该环境？" onConfirm={() => del(e.id)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>}
              </div>
            </div>
          ))}
        </div>
      </>)}
      <Modal title="新建环境" open={!!reg} onOk={create} onCancel={() => setReg(null)} okText="创建" width={460} destroyOnHidden>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '12px 0 4px' }}>
          <div><div style={{ fontSize: 13, color: '#5A5C6B', marginBottom: 6 }}>名称</div><Input value={(reg && reg.name) || ''} placeholder="如：生产-独立沙箱" onChange={e => setReg(r => ({ ...r, name: e.target.value }))} /></div>
          <div><div style={{ fontSize: 13, color: '#5A5C6B', marginBottom: 6 }}>隔离级别</div>
            <Select value={(reg && reg.isolation) || 'L2'} style={{ width: '100%' }} onChange={v => setReg(r => ({ ...r, isolation: v }))}
              options={[{ value: 'L1', label: 'L1 共享（你名下多 Agent 共用，最省）' }, { value: 'L2', label: 'L2 独立（每 Agent 一沙箱）' }, { value: 'L3', label: 'L3 即用即弃（每会话临时，最强隔离）' }]} /></div>
          <div><div style={{ fontSize: 13, color: '#5A5C6B', marginBottom: 6 }}>说明（可选）</div><Input value={(reg && reg.description) || ''} placeholder="一句话说明用途" onChange={e => setReg(r => ({ ...r, description: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

/* ================= 会话控制台（Spec N · 按创建人聚合我创建的 Agent 的全部会话） ================= */
// 视觉规范：运行环境用中性药丸，隔离差异靠 L1/L2/L3 文本 + 分段过滤区分，不滥用语义色。
const _MONO = { fontFamily: 'ui-monospace,Menlo,monospace' };
const _envText = (iso, loc) => {
  const where = loc === 'cloud' ? '云端' : '本地';
  return iso ? `${isoName(iso)} · ${iso} · ${where}` : `通用 · ${where}`;
};
const _statusPill = (s) => s === 'active'
  ? <span style={pill('#E9F7EF', '#1E8449')}>● 活跃</span>
  : <span style={pill('#F1F1F4', '#A6A8B4')}>{s || '—'}</span>;
// 会话来源枚举（用于「归集来源」显示 + 过滤器）。云端回传（cloud-callback）尚未接通，暂不作为可选项。
const SESSION_SOURCES = [
  { value: 'platform', label: '平台界面', desc: '在平台界面里亲手发起的会话：Chat、Playground 对话、Agent 编辑页试跑等' },
  { value: 'schedule', label: '定时任务', desc: '定时任务到点触发或「立即运行」时，由调度器自动创建的会话' },
  { value: 'gateway', label: '网关直连', desc: '外部系统绕过平台界面、直连已发布 Agent 的稳定地址，由网关旁路归集回来的会话' },
];
const _srcText = (s) => s === 'gateway' ? '网关直连' : s === 'cloud-callback' ? '云端回传' : s === 'schedule' ? '定时任务' : '平台界面';

export function SessionConsole({ me, onGoAgents, initialOpenId, onOpened }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState(null);   // 概览统计/过滤候选（全集，不随过滤变）
  const [loading, setLoading] = useState(false);
  const [fAgent, setFAgent] = useState('');     // 所属 Agent 过滤
  const [fIso, setFIso] = useState('');         // 运行环境过滤 L1/L2/L3
  const [fSrc, setFSrc] = useState('');         // 来源过滤（平台/定时任务/直连…）
  const [q, setQ] = useState('');               // 关键词输入（标题）
  const [qd, setQd] = useState('');             // 防抖后的关键词（真正打到服务端）
  const [page, setPage] = useState(0);          // 0-based，服务端分页
  const PAGE_SIZE = 20;
  const [detail, setDetail] = useState(null);   // 打开的会话明细
  const [dLoading, setDLoading] = useState(false);
  const [dw, setDw] = useState(560);            // 明细抽屉宽度（可左右拖拽）

  // 拖拽抽屉左缘改宽度（向左拖变宽）
  const startResize = (e) => {
    e.preventDefault();
    const onMove = (ev) => setDw(Math.max(420, Math.min(window.innerWidth - 120, window.innerWidth - ev.clientX)));
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.userSelect = ''; };
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const load = React.useCallback(() => {
    if (!API_ON) { setRows([]); setTotal(0); setFacets(null); return; }
    setLoading(true);
    const qs = new URLSearchParams({ scope: 'created', page: String(page), size: String(PAGE_SIZE) });
    if (fAgent) qs.set('agent', fAgent);
    if (fIso) qs.set('isolation', fIso);
    if (fSrc) qs.set('source', fSrc);
    if (qd) qs.set('q', qd);
    apiCall('/api/sessions?' + qs.toString())
      .then(d => { setRows((d && d.items) || []); setTotal((d && d.total) || 0); if (d && d.facets) setFacets(d.facets); })
      .catch(() => { setRows([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [page, fAgent, fIso, fSrc, qd]);
  React.useEffect(() => { load(); }, [load]);

  // 关键词防抖：输入停 300ms 才打服务端，并回到第 1 页
  React.useEffect(() => { const t = setTimeout(() => { setQd(q.trim()); setPage(0); }, 300); return () => clearTimeout(t); }, [q]);

  // 过滤变更回到第 1 页
  const pickAgent = (v) => { setFAgent(v || ''); setPage(0); };
  const pickIso = (v) => { setFIso(v === 'ALL' ? '' : v); setPage(0); };
  const pickSrc = (v) => { setFSrc(v || ''); setPage(0); };

  const agentOptions = useMemo(() =>
    ((facets && facets.agents) || []).map(a => ({ value: a.value, label: `${a.label}（${a.count}）` })),
  [facets]);

  const openDetail = (id) => {
    setDLoading(true); setDetail({ loading: true });
    apiCall(`/api/sessions/${id}`).then(d => setDetail(d)).catch(() => setDetail(null)).finally(() => setDLoading(false));
  };
  // 深链：从「定时任务」的运行台账跳过来时直接打开对应会话明细
  React.useEffect(() => { if (initialOpenId) { openDetail(initialOpenId); onOpened && onOpened(); } }, [initialOpenId]);

  const hasFilter = !!(qd || fAgent || fIso || fSrc);

  // 抽屉内密集元数据：一个 label-value 对，行内排布
  const meta = (label, val) => (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap', minWidth: 0 }}>
      <span style={{ color: '#A6A8B4', fontSize: 12 }}>{label}</span>
      <span style={{ color: '#2A2A33', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>{val}</span>
    </span>
  );

  // 轻量表格列（细分隔线、无卡片描边，适合大量会话）
  const columns = [
    { title: '会话标题', dataIndex: 'title', ellipsis: true, render: (t, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: '#17171C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t || '新对话'}</span>
          {_statusPill(r.status)}
          {r.source === 'schedule' && <span style={pill('#EEF0FF', '#4F46E5')}><ClockCircleOutlined style={{ fontSize: 10, marginRight: 3 }} />定时任务</span>}
        </div>
      ) },
    { title: '所属 Agent', dataIndex: 'agentName', width: 168, ellipsis: true,
      render: (t, r) => <span style={{ color: '#5A5C6B' }}>{t || r.agent}</span> },
    { title: '运行环境', dataIndex: 'isolation', width: 158,
      render: (_, r) => <span style={pill('#F1F1F4', '#5A5C6B')}>{_envText(r.isolation, r.location)}</span> },
    { title: '发起人', dataIndex: 'initiator', width: 118, render: (v) => {
        const other = v && v !== me;
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {other && <span style={pill('#FFF8E6', '#946C00')}>他人</span>}
          <span style={{ ..._MONO, fontSize: 12, color: '#8A8C99' }}>{v || '—'}</span></span>;
      } },
    { title: '轮次', dataIndex: 'rounds', width: 60, align: 'right',
      render: (v, r) => <span style={{ color: '#5A5C6B' }}>{v != null ? v : (Math.ceil((r.count || 0) / 2) || 0)}</span> },
    { title: '最后活跃', dataIndex: 'updatedAt', width: 132, align: 'right',
      render: (v) => <span style={{ ..._MONO, color: '#A6A8B4', fontSize: 12 }}>{(v || '').slice(0, 16)}</span> },
  ];

  return (
    <div>
      <style>{`.sess-table .ant-table-row{cursor:pointer}.sess-table .ant-table-cell{padding-top:10px !important;padding-bottom:10px !important}.sess-grip:hover{background:rgba(79,70,229,0.18)}.sess-grip:active{background:rgba(79,70,229,0.32)}`}</style>

      {/* 页头 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 750, letterSpacing: -0.3, color: '#17171C' }}>会话</div>
        <Text style={{ color: '#8A8C99', fontSize: 13.5 }}>我创建的 Agent（含 L1 共享 / L2 独立 / L3 即用即弃，及通用助手）曾经活跃过的全部会话 · 仅自己创建的可见</Text>
      </div>

      {/* 工具条 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Input allowClear prefix={<SearchOutlined style={{ color: '#B6B6BE' }} />} placeholder="搜索会话标题" value={q} onChange={e => setQ(e.target.value)} style={{ width: 240 }} />
        <Select allowClear showSearch optionFilterProp="label" placeholder="全部 Agent" style={{ width: 200 }} value={fAgent || undefined} onChange={pickAgent} options={agentOptions} />
        <Segmented value={fIso || 'ALL'} onChange={pickIso}
          options={[{ label: '全部环境', value: 'ALL' }, { label: '共享 L1', value: 'L1' }, { label: '独立 L2', value: 'L2' }, { label: '即用即弃 L3', value: 'L3' }]} />
        <Select allowClear placeholder="全部来源" style={{ width: 150 }} popupMatchSelectWidth={300} value={fSrc || undefined} onChange={pickSrc}
          options={SESSION_SOURCES.map(o => ({ value: o.value, label: o.label }))}
          optionRender={opt => { const o = SESSION_SOURCES.find(s => s.value === opt.value); return (
            <div style={{ padding: '2px 0' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{o.label}</div>
              <div style={{ fontSize: 11.5, color: '#8A8C99', whiteSpace: 'normal', lineHeight: 1.45, marginTop: 1 }}>{o.desc}</div>
            </div>); }} />
        <div style={{ flex: 1 }} />
        <Text style={{ color: '#A6A8B4', fontSize: 12.5 }}>共 {total} 条{hasFilter ? '（已过滤）' : ''}</Text>
        <Tooltip title="刷新"><Button type="text" icon={<ReloadOutlined />} onClick={load} /></Tooltip>
      </div>

      {/* 列表 · 轻量表格 */}
      <Table className="sess-table" rowKey="id" size="middle" columns={columns} dataSource={rows} loading={loading}
        onRow={r => ({ onClick: () => openDetail(r.id) })}
        pagination={total > PAGE_SIZE
          ? { current: page + 1, pageSize: PAGE_SIZE, total, showSizeChanger: false, size: 'small',
              onChange: p => setPage(p - 1), showTotal: (t, [a, b]) => `${a}-${b} / 共 ${t} 条` }
          : false}
        locale={{ emptyText: (
          <div style={{ padding: '36px 0' }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={!API_ON ? '未连接后端' : hasFilter ? '没有匹配的会话' : '我创建的 Agent 还没有活跃过的会话'}>
              {API_ON && !hasFilter && onGoAgents && <Button type="primary" icon={<RobotOutlined />} onClick={onGoAgents}>去创建 / 部署 Agent</Button>}
            </Empty>
          </div>
        ) }} />

      {/* 明细抽屉 · 高密度；只保留列表没有的字段（版本/来源/创建），其余靠列表；宽度可拖拽 */}
      {detail && <div className="sess-grip" onMouseDown={startResize}
        style={{ position: 'fixed', top: 0, bottom: 0, left: `calc(100vw - ${dw}px)`, width: 8, marginLeft: -4, cursor: 'col-resize', zIndex: 1001 }} />}
      <Drawer open={!!detail} width={dw} onClose={() => setDetail(null)} closable styles={{ header: { borderBottom: '1px solid #F1F1F5' }, body: { padding: 0 } }}
        title={detail && !detail.loading
          ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#17171C', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{detail.title || '会话明细'}</div>
                <div style={{ ..._MONO, fontSize: 11, color: '#A6A8B4', marginTop: 2 }}>{detail.id}</div>
              </div>
              {_statusPill(detail.status)}
            </div>
          : '会话明细'}>
        {dLoading || (detail && detail.loading)
          ? <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>
          : detail && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* 密集元数据条：只放列表里没有的运行上下文（调用版本 / 归集来源 / 创建时间）*/}
              <div style={{ padding: '10px 20px', background: '#FAFAFB', borderBottom: '1px solid #F1F1F5', display: 'flex', flexWrap: 'wrap', gap: '6px 18px', alignItems: 'center' }}>
                {detail.agentVersion != null && meta('调用版本', <span style={pill('#EEF0FF', '#4F46E5')}>v{detail.agentVersion}</span>)}
                {meta('归集来源', _srcText(detail.source))}
                {meta('创建时间', <span style={_MONO}>{(detail.createdAt || '').slice(0, 16) || '—'}</span>)}
              </div>
              {/* 对话回看 · 只读，每条带时间戳 */}
              <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
                {(detail.messages || []).length === 0
                  ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无对话内容" />
                  : (detail.messages || []).map((m, i) => {
                    if (m.role === 'sys') return <div key={i} style={{ textAlign: 'center', fontSize: 12, color: '#A6A8B4', margin: '6px 0 14px' }}>{m.text}</div>;
                    const mine = m.role === 'user';
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                        {!mine && <TraceSteps steps={m.steps} />}
                        <div style={{ maxWidth: '86%', padding: '10px 13px', borderRadius: 10, fontSize: 13.5, lineHeight: 1.6, background: mine ? ACCENT : (m.err ? '#FDECEC' : '#F4F4F7'), color: mine ? '#fff' : (m.err ? '#C0392B' : '#2A2A33'), borderBottomRightRadius: mine ? 3 : 10, borderBottomLeftRadius: mine ? 10 : 3 }}>
                          {mine ? <span style={{ whiteSpace: 'pre-wrap' }}>{m.text || ''}</span> : <Md text={m.text} />}
                        </div>
                        <div style={{ ..._MONO, fontSize: 11, color: '#94A3B8', marginTop: 4, padding: '0 2px' }}>
                          {m.err ? <span style={{ color: '#C0392B', marginRight: 6 }}>出错</span> : null}
                          {m.ts ? (String(m.ts).length > 11 ? String(m.ts).slice(5, 16) : m.ts) : ''}
                          {!mine && <UsageLine usage={m.usage} model={m.model} stop={m.stop} />}
                        </div>
                      </div>);
                  })}
              </div>
              <div style={{ padding: '10px 20px', borderTop: '1px solid #F1F1F5', fontSize: 12, color: '#A6A8B4', textAlign: 'center' }}>只读 · 创建人视角回看</div>
            </div>)}
      </Drawer>
    </div>
  );
}

/* ================= 根组件 ================= */
