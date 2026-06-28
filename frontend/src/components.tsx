import React, { useState, useMemo } from "react";
import {
  ConfigProvider, App as AntApp, Layout, Menu, Button, Table, Input, Select, Card, Tabs,
  Drawer, Checkbox, Tag, Collapse, Descriptions, Modal, Tooltip, Avatar, Dropdown,
  Slider, InputNumber, Popconfirm, Popover, Space, Typography, Empty, Segmented, Divider, theme, message, Spin, Badge, Tree, Upload, Switch,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined, SearchOutlined, AppstoreOutlined,
  UserOutlined, TeamOutlined, SendOutlined, ReloadOutlined, ArrowLeftOutlined, DownOutlined,
  RobotOutlined, ToolOutlined, BulbOutlined, CheckOutlined, MessageOutlined, FileTextOutlined,
  SettingOutlined, CloseOutlined, ThunderboltOutlined, SwapOutlined, BranchesOutlined,
  InboxOutlined, FolderOutlined, FileOutlined, EyeOutlined,
} from "@ant-design/icons";
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
    <Modal title={`发布${agentName ? '「' + agentName + '」' : ''}`} open={open} onCancel={onCancel}
      okText={migrating ? '迁移并发布' : '发布'} onOk={() => onConfirm(iso, ver)} width={520} destroyOnHidden>
      {hasVers && (
        <div style={{ margin: '4px 0 14px' }}>
          <div style={{ fontSize: 13, color: '#5A5C6B', marginBottom: 6 }}>发布版本</div>
          <Select value={ver} style={{ width: '100%' }} onChange={setVer}
            options={versions.slice().reverse().map(x => ({ value: x.version, label: `v${x.version}${x.version === latestVer ? ' · 最新' : ''} · ${(x.createdAt || '').slice(5)}` }))} />
        </div>
      )}
      <div style={{ fontSize: 13, color: '#5A5C6B', margin: '4px 0 12px' }}>选择运行环境（决定隔离强度——成本与互相影响范围）{curIso ? <>；当前 <span style={pill('#F1F1F4', '#5A5C6B')}>{isoName(curIso)} · {curIso}</span></> : ''}：</div>
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
        ? { id: r.id, name: r.name, desc: r.summary, cat: r.source === 'custom' ? '本空间 · 自定义 MCP' : '本空间 · MCP', mcp: r.command, ver: '', locked: false }
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

/* ================= 调试面板 (Spec I · mock) ================= */
export function DebugPanel({ cfg, chatPath, streamPath, initialMsgs, onTurn }) {
  const [msgs, setMsgs] = useState(initialMsgs && initialMsgs.length ? initialMsgs : [{ role: 'sys', text: API_ON ? `调试 · 模型 ${cfg.model || '未选'} · 本机 ${cfg.framework === 'OPENCLAW' ? 'OpenClaw Gateway' : 'Claude Code'} 运行` : `调试 · 模型 ${cfg.model || '未选'} · 本地 mock（未连后端）` }]);
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
      finally { setBusy(false); onTurn && onTurn(); }
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
    } finally { setBusy(false); onTurn && onTurn(); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`@keyframes pgBlink{0%,100%{opacity:1}50%{opacity:0}}@keyframes pgBounce{0%,80%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-4px);opacity:1}}.pg-caret{animation:pgBlink 1s steps(1) infinite;color:#8A8C99;margin-left:1px}.pg-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#9A9CAA;margin:0 2px;animation:pgBounce 1.2s infinite}`}</style>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 2px' }}>
        {msgs.map((m, i) => m.role === 'sys' ? (
          <div key={i} style={{ textAlign: 'center', fontSize: 12, color: '#8A8C99', margin: '8px 0 16px' }}>{m.text}</div>
        ) : (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <div style={{
              maxWidth: '82%', padding: '10px 13px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              background: m.role === 'user' ? ACCENT : '#F4F4F7', color: m.role === 'user' ? '#fff' : (m.err ? '#D4380D' : '#2A2A33'),
              borderBottomRightRadius: m.role === 'user' ? 3 : 12, borderBottomLeftRadius: m.role === 'bot' ? 3 : 12,
            }}>
              {m.role === 'bot' && m.pending && !m.text
                ? <span style={{ display: 'inline-flex', alignItems: 'center' }} aria-label="正在回复"><span className="pg-dot" style={{ animationDelay: '0s' }} /><span className="pg-dot" style={{ animationDelay: '.18s' }} /><span className="pg-dot" style={{ animationDelay: '.36s' }} /></span>
                : <>{m.text}{m.role === 'bot' && m.pending ? <span className="pg-caret">▋</span> : null}</>}
            </div>
          </div>
        ))}
      </div>
      {busy && <div style={{ fontSize: 12, color: '#8A8C99', padding: '0 2px 8px', display: 'flex', alignItems: 'center', gap: 6 }}><Spin size="small" /> Agent 正在回复…（请等本轮结束）</div>}
      <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid #F1F1F5' }}>
        <Input placeholder={busy ? '回复中，请稍候…' : '输入消息，试跑当前 Agent…'} value={input} disabled={busy} onChange={e => setInput(e.target.value)} onPressEnter={send} />
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
export function AgentWorkbench({ mode, agent: agentProp, service, wsId, onBack, onCreate, onSaveStay, onChanged, onDiff }) {
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 顶栏：名称 + 状态 ……… 版本 + 保存 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: '1px solid #F1F1F5', marginBottom: 12 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} />
        <Input variant="borderless" value={name} disabled={!isCreate} maxLength={50} placeholder="未命名 Agent"
          onChange={e => setName(e.target.value)} style={{ fontSize: 18, fontWeight: 750, padding: 0, width: 240, color: '#17171C', flexShrink: 0 }} />
        <span style={pill('#EEF0FF', '#4F46E5')}>{fwName(framework)}</span>
        {!isCreate && statusPill}
        {nameErr && <span style={{ fontSize: 12, color: '#E5484D' }}>{nameErr}</span>}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {!isCreate && (
            <>
              <span style={pill('#F1F1F4', '#5A5C6B')}>v{savedAgent.version}</span>
              <Button size="small" icon={<BranchesOutlined />} onClick={() => setHistOpen(true)}>版本历史{versions.length > 1 ? ` · ${versions.length}` : ''}</Button>
            </>
          )}
          {isCreate
            ? <Dropdown.Button type="primary" disabled={!canSave} icon={<DownOutlined />} onClick={primarySave}
                menu={{ items: [{ key: 'draft', label: '仅创建草稿（暂不上线）', onClick: createDraft }] }}>创建并发布</Dropdown.Button>
            : <Dropdown.Button type="primary" disabled={!canSave} icon={<DownOutlined />} onClick={saveVersion}
                menu={{ items: [{ key: 'pub', label: '保存并发布', onClick: primarySave }] }}>保存为新版本</Dropdown.Button>}
        </div>
      </div>

      {/* 主体：中（配置编辑）+ 右（运行 & 试跑） */}
      <div style={{ flex: 1, display: 'flex', gap: 14, minHeight: 0 }}>
        {/* 中：配置 */}
        <div style={{ flex: 1, overflow: 'auto', minWidth: 0, paddingRight: 2 }}>
          {/* 元信息条 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
            <Input variant="borderless" value={desc} placeholder="添加描述…" onChange={e => setDesc(e.target.value)} style={{ fontSize: 13, padding: 0, color: '#8A8C99', width: 260 }} />
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, color: '#8A8C99' }}>框架</span>
              <Segmented size="small" value={framework} onChange={pickFramework} disabled={!isCreate}
                options={FRAMEWORKS.map(f => ({ value: f.key, disabled: !f.enabled, label: <Tooltip title={f.enabled ? '' : (f.tip || '未开放')}><span>{f.name}</span></Tooltip> }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, color: '#8A8C99' }}>模型</span>
              <Select value={model} placeholder="选择模型 *" style={{ width: 180 }} options={PROVIDERS} onChange={setModel} showSearch optionFilterProp="label" status={!model ? 'warning' : ''} />
            </div>
            <Popover trigger="click" placement="bottomRight" title="模型参数" content={paramsContent}>
              <Button icon={<SettingOutlined />} disabled={!model}>参数</Button>
            </Popover>
          </div>

          <div style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 8, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: 650, color: '#33333C' }}>指令文件 · {fwName(framework)}</Text>
              <Button size="small" type="text" style={{ color: ACCENT }} onClick={() => setFiles({ ...TEMPLATES[framework] })}>重置为模板</Button>
            </div>
            {fileKeys.length > 1 ? (
              <Tabs activeKey={activeFile} onChange={setActiveFile} size="small"
                items={fileKeys.map(k => ({ key: k, label: <span>{k}{files[k] && files[k].trim() ? <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: ACCENT, marginLeft: 6, verticalAlign: 'middle' }} /> : null}</span>,
                  children: <CodeEditor value={files[k] || ''} onChange={v => setFiles({ ...files, [k]: v })} rows={16} /> }))} />
            ) : <CodeEditor value={files[fileKeys[0]] || ''} onChange={v => setFiles({ ...files, [fileKeys[0]]: v })} rows={16} />}
          </div>

          <div style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 8, padding: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: 650, color: '#33333C' }}>能力</Text>
            <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ color: '#5A5C6B', fontSize: 13 }}><ToolOutlined /> 工具</span>
                  <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => setDrawer('tool')}>添加</Button>
                </div>
                <div>{tools.length === 0 ? <Text style={{ color: '#A6A8B4', fontSize: 12 }}>未选择</Text> :
                  tools.map(id => { const t = TOOLS.find(x => x.id === id); return <Tag key={id} closable bordered={false} onClose={() => setTools(tools.filter(x => x !== id))} style={{ marginBottom: 6, background: '#EEF0FF', color: ACCENT }}>{(t && t.name) || id}</Tag>; })}</div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
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
        <div style={{ width: 400, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          {/* 运行面板 */}
          <div style={{ background: '#fff', border: '1px solid #ECECEF', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>运行</span>
                {isCreate ? <span style={{ color: '#A6A8B4' }}>创建后可发布</span>
                  : !published && !service ? <span style={{ color: '#A6A8B4' }}>未发布</span>
                  : <><span style={pill('#F1F1F4', '#5A5C6B')}>v{liveVer}</span><span style={pill('#F1F1F4', '#5A5C6B')}>{isoName(liveIso)}·{liveIso}</span>{service && (service.location === 'cloud' ? <span style={pill('#EEF0FF', '#4F46E5')}>☁云</span> : <span style={pill('#F1F1F4', '#5A5C6B')}>本地</span>)}</>}
              </div>
              {!isCreate && <Space size={6}>
                {!published && !service ? <Button size="small" type="primary" onClick={() => askPublish()}>发布</Button>
                  : deploying ? <Button size="small" loading disabled>部署中</Button>
                  : failed ? <Button size="small" type="primary" onClick={() => askPublish()}>重新发布</Button>
                  : running ? <><Tooltip title="换版本/环境（本地↔云）"><Button size="small" onClick={() => askPublish()}>更改发布</Button></Tooltip><Popconfirm title="停止该服务？" description="仅停实例，已发布配置保留" onConfirm={stopService}><Button size="small" danger>停服</Button></Popconfirm></>
                  : <><Tooltip title={`用已发布 v${savedAgent.publishedVersion}·${isoName(liveIso)} 原样拉起`}><Button size="small" type="primary" onClick={startPublished}>启动</Button></Tooltip><Button size="small" onClick={() => askPublish()}>更改发布</Button></>}
              </Space>}
            </div>
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
          <div style={{ flex: 1, minHeight: 0, background: '#fff', border: '1px solid #EBEBF1', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column' }}>
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

/* ================= 版本历史抽屉（列表 + 只读明细 + 对比 + 发布某版本） ================= */
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
    <Drawer title={`版本历史 · ${agentName}`} width={940} open={open} onClose={onClose} styles={{ body: { padding: 0 } }}>
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
            <Segmented value={tab} onChange={setTab} options={[{ value: 'detail', label: '版本明细' }, { value: 'diff', label: '版本对比' }]} />
            {tab === 'detail'
              ? <Space size={8}>
                  <Button onClick={() => onEditFrom(sel)}>以此为基础编辑</Button>
                  <Tooltip title={sel === liveVer ? '该版本已是线上发布版本' : '把此版本设为线上发布版本'}>
                    <Button type="primary" disabled={sel === liveVer} onClick={() => onPublish(sel)}>{sel === liveVer ? '当前已发布' : `发布 v${sel}`}</Button>
                  </Tooltip>
                </Space>
              : <Space size={6}><Select size="small" value={lv} style={{ width: 168 }} options={opts} onChange={setLv} /><span style={{ color: '#8A8C99' }}>→</span><Select size="small" value={rv} style={{ width: 168 }} options={opts} onChange={setRv} /></Space>}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
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
  const [svcMap, setSvcMap] = useState({});      // agentId → 运行态（隔离级别 / local|cloud / status）
  const loadSvc = () => { if (API_ON) apiCall('/api/services').then(d => setSvcMap(Object.fromEntries((d || []).map(s => [s.agentId || s.id, s])))).catch(() => {}); };
  // 会话管理（统一 /api/sessions，按 agent 过滤）——切 tab 回来即由此重载、回显
  const loadPgSessions = async (aid) => { try { const l = await apiCall(`/api/sessions?agent=${aid}`); setPgSessions(l || []); return l || []; } catch { return []; } };
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
    <div>
      {!embedded
        ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 750, letterSpacing: -0.3, color: '#17171C' }}>Playground</div>
              <Text style={{ color: '#8A8C99', fontSize: 13.5 }}>与已发布的 Agent 对话{API_ON ? '' : '（未连后端 · 本地 mock）'}</Text>
            </div>
            {agentPicker}
          </div>
        )
        : (agentPicker && <div style={{ marginBottom: 12 }}>{agentPicker}</div>)}
      {list.length === 0
        ? <div style={{ border: '1px dashed #DEDEE3', borderRadius: 8, padding: '40px 0', background: '#FCFCFD' }}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有已发布的 Agent —— 去详情或编辑页点「发布」" /></div>
        : <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', height: 'calc(100vh - 200px)' }}>
            {cfg && (
              <div style={{ width: 184, flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Button size="small" icon={<PlusOutlined />} onClick={() => sel && newPgSession(sel.id, { reuseEmpty: true })} style={{ marginBottom: 8 }}>新会话</Button>
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                  {pgSessions.length === 0
                    ? <div style={{ textAlign: 'center', color: '#C2C4CE', fontSize: 12, padding: '16px 0' }}>暂无会话</div>
                    : pgSessions.map(s => (
                      <div key={s.id} onClick={() => switchPgSession(s.id)} style={{ padding: '7px 8px', borderRadius: 8, cursor: 'pointer', marginBottom: 2, background: s.id === psid ? '#EEF0FF' : 'transparent', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, color: s.id === psid ? '#4F46E5' : '#2A2A33', fontWeight: s.id === psid ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title || '新对话'}</div>
                          <div style={{ fontSize: 11, color: '#A6A8B4' }}>{s.count || 0} 条</div>
                        </div>
                        <Popconfirm title="删除该会话？" okText="删除" okButtonProps={{ danger: true }} cancelText="取消" onConfirm={() => delPgSession(s.id)}>
                          <DeleteOutlined onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: '#C0C2CC', flexShrink: 0 }} />
                        </Popconfirm>
                      </div>
                    ))}
                </div>
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #EBEBF1', borderRadius: 8, padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
              {cfg ? <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 650, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {cfg.name} <span style={pill('#EEF0FF', '#4F46E5')}>{fwName(cfg.framework)}</span>
                    {(() => { const s = svcMap[sel && sel.id]; if (!s) return null; const cloud = s.location === 'cloud';
                      return <Badge status={s.status === 'running' ? 'success' : (s.status === 'failed' ? 'error' : 'processing')}
                        text={<span style={{ fontSize: 12, color: '#8A8C99', fontWeight: 400 }}>{s.isolation ? isoName(s.isolation) + ' · ' + s.isolation : ''}{cloud ? ' · 云端沙箱' : ' · 本地'}{s.status && s.status !== 'running' ? ' · ' + s.status : ''}</span>} />; })()}
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}><DebugPanel key={sel.id + '-' + sel.version + '-' + (psid || 'x')} cfg={cfg}
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
  const push = (role, text) => setMsgs(m => [...m, { role, text }]);
  // 增量更新最后一条 bot 气泡（流式）
  const setBot = (text, extra) => setMsgs(m => { const c = [...m]; for (let i = c.length - 1; i >= 0; i--) { if (c[i].role === 'bot') { c[i] = { ...c[i], text, ...(extra || {}) }; break; } } return c; });

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
          else if (ev === 'done') { acc = d.reply || acc; setBot(acc, { pending: false }); }
          else if (ev === 'error') { acc = d.reply || acc || '出错'; setBot(acc, { pending: false, err: true }); }
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

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 750, letterSpacing: -0.3, color: '#17171C', display: 'flex', alignItems: 'center', gap: 8 }}>
            Chat
            {copilot && (conn
              ? <Badge status={conn.running ? 'success' : 'default'} text={<span style={{ fontSize: 12, color: '#8A8C99', fontWeight: 400 }}>{conn.running ? '通用 Agent 已连接' : '通用 Agent 待启动'}</span>} />
              : <Badge status="default" text={<span style={{ fontSize: 12, color: '#A6A8B4', fontWeight: 400 }}>未连后端</span>} />)}
          </div>
          <Text style={{ color: '#8A8C99', fontSize: 13.5 }}>平台统一入口：默认连后端通用 Agent，经平台工具真正执行；输入 / 唤起内置技能</Text>
        </div>
        <Tooltip title={copilot ? '已连后端常驻通用 Agent（Claude Code + platform-ops MCP + 内置 skill）。关掉=前端轻量意图匹配' : '当前为前端轻量匹配。打开以连接真正的通用 Agent'}>
          <Space size={6} style={{ flexShrink: 0, paddingTop: 4 }}>
            <Text style={{ fontSize: 12.5, color: copilot ? ACCENT : '#8A8C99' }}>通用 Agent</Text>
            <Switch size="small" checked={copilot} onChange={v => { setCopilot(v); push('sys', v ? '已连通用 Agent（首条消息会自动启动，约数秒）' : '已切回前端轻量模式'); }} />
          </Space>
        </Tooltip>
      </div>
      <div style={{ background: '#fff', border: '1px solid #EBEBF1', borderRadius: 8, height: 'calc(100vh - 200px)', display: 'flex', overflow: 'hidden' }}>
        {/* 会话侧栏：新建 / 切换 / 删除 / 历史 */}
        <div style={{ width: 210, borderRight: '1px solid #EFEFF3', display: 'flex', flexDirection: 'column', background: '#FCFCFD' }}>
          <div style={{ padding: 10 }}>
            <Button block size="small" icon={<PlusOutlined />} onClick={newSession}>新对话</Button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '0 6px 8px' }}>
            {sessions.length === 0
              ? <div style={{ textAlign: 'center', color: '#C2C4CE', fontSize: 12, padding: '24px 0' }}>暂无会话</div>
              : sessions.map(s => (
                <div key={s.id} onClick={() => switchSession(s.id)} style={{ padding: '8px 9px', borderRadius: 8, cursor: 'pointer', marginBottom: 2, background: s.id === curSid ? '#EEF0FF' : 'transparent', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: s.id === curSid ? '#4F46E5' : '#2A2A33', fontWeight: s.id === curSid ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title || '新对话'}</div>
                    <div style={{ fontSize: 11, color: '#A6A8B4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.updatedAt || ''} · {s.count || 0} 条</div>
                  </div>
                  <Tooltip title="重命名"><EditOutlined onClick={e => { e.stopPropagation(); setRenaming({ id: s.id, title: s.title || '' }); }} style={{ fontSize: 12, color: '#C0C2CC', flexShrink: 0 }} /></Tooltip>
                  <Popconfirm title="删除该会话？" okText="删除" okButtonProps={{ danger: true }} cancelText="取消" onConfirm={() => delSession(s.id)}>
                    <DeleteOutlined onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: '#C0C2CC', flexShrink: 0 }} />
                  </Popconfirm>
                </div>
              ))}
          </div>
        </div>
        {/* 对话区 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, minWidth: 0 }}>
          <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
            {msgs.map((m, i) => m.role === 'sys'
              ? <div key={i} style={{ textAlign: 'center', fontSize: 12, color: '#A6A8B4', margin: '6px 0 14px' }}>{m.text}</div>
              : <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                  <div style={{ maxWidth: '82%', padding: '10px 13px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: m.role === 'user' ? ACCENT : (m.err ? '#FDECEC' : '#F4F4F7'), color: m.role === 'user' ? '#fff' : (m.err ? '#B42318' : '#2A2A33'), borderBottomRightRadius: m.role === 'user' ? 3 : 12, borderBottomLeftRadius: m.role === 'bot' ? 3 : 12 }}>
                    {m.text || (m.pending ? <span style={{ color: '#8A8C99' }}><Spin size="small" style={{ marginRight: 8 }} />通用 Agent 思考中…</span> : '')}
                  </div>
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
  if (installed) {
    const iconBtn = <Tooltip title={removeLabel || '移出本空间'}><Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={removeConfirm ? undefined : onRemove} /></Tooltip>;
    const fullBtn = <Button size="small" danger ghost onClick={removeConfirm ? undefined : onRemove} style={{ flex: 1 }}>{removeLabel || '移出本空间'}</Button>;
    const el = compactRemove ? iconBtn : fullBtn;
    removeEl = removeConfirm
      ? <Popconfirm title={removeConfirm} okText="删除" okButtonProps={{ danger: true }} cancelText="取消" onConfirm={onRemove}>{el}</Popconfirm>
      : el;
  }
  return (
    <div style={{ border: '1px solid #EBEBF1', borderRadius: 8, padding: 16, background: '#fff', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 140 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 650, fontSize: 14, color: '#17171C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {sub && <div style={{ fontSize: 11.5, color: '#A6A8B4', fontFamily: 'ui-monospace,Menlo,monospace', marginTop: 1 }}>{sub}</div>}
        </div>
        {badge}
      </div>
      <div style={{ fontSize: 12.5, color: '#5A5C6B', lineHeight: 1.5, flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{desc || '—'}</div>
      {meta}
      {info && <div style={{ fontSize: 11.5, color: '#A6A8B4', display: 'flex', alignItems: 'center', gap: 6 }}>{info}</div>}
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
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ paddingLeft: 0, marginBottom: 12, color: '#5A5C6B' }}>返回技能市场</Button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: '#EEF0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, fontSize: 17 }}><BulbOutlined /></div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#17171C' }}>{skill.name}
            <Tag bordered={false} style={{ marginLeft: 8, fontSize: 11 }}>{skill.source === 'upload' ? '上传包' : skill.source === 'custom' ? '自定义' : skill.source}</Tag></div>
          <div style={{ fontSize: 12.5, color: '#8A8C99', fontFamily: 'ui-monospace,Menlo,monospace' }}>{skill.id}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#5A5C6B', lineHeight: 1.6, margin: '10px 0 18px', maxWidth: 760 }}>{skill.description}</div>

      <div style={{ fontSize: 12, fontWeight: 650, color: '#33333C', marginBottom: 10 }}>技能文件</div>
      {treeData.length > 0 ? (
        <div style={{ display: 'flex', gap: 14, height: 'calc(100vh - 320px)', minHeight: 340 }}>
          <div style={{ width: 300, border: '1px solid #EBEBF1', borderRadius: 8, padding: 8, overflow: 'auto', background: '#FAFAFB' }}>
            <Tree.DirectoryTree treeData={treeData} showIcon defaultExpandAll selectedKeys={sel ? [sel] : []}
              onSelect={(keys, { node }) => { if (node.isLeaf) openFile(node.key); }} />
          </div>
          <div style={{ flex: 1, minWidth: 0, border: '1px solid #EBEBF1', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11.5, color: '#8A8C99', padding: '8px 12px', borderBottom: '1px solid #F1F1F5', fontFamily: 'ui-monospace,Menlo,monospace' }}>{sel || '← 点击左侧文件查看内容'}</div>
            {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
              : <pre style={{ margin: 0, padding: 14, fontSize: 12.5, lineHeight: 1.6, color: '#33333C', background: '#FAFAFC', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'auto', flex: 1, fontFamily: 'ui-monospace, Menlo, monospace' }}>{content}</pre>}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: '#A6A8B4', marginBottom: 8 }}>该技能无上传包文件，展示其 SKILL.md：</div>
          <pre style={{ margin: 0, background: '#FAFAFC', border: '1px solid #F1F1F5', color: '#33333C', borderRadius: 8, padding: 14, fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 'calc(100vh - 360px)', overflow: 'auto', fontFamily: 'ui-monospace, Menlo, monospace' }}>{skill.skill_md}</pre>
        </div>
      )}
    </div>
  );
}

/* MCP 详情：展示标准 mcpServers 配置（MCP 协议形态） */
function McpDetailModal({ open, mcp, onClose }) {
  if (!mcp) return null;
  const desc = mcp.desc || mcp.summary || '';
  const env = mcp.env || [];
  const server = { type: 'stdio', command: mcp.command, args: mcp.args || [] };
  if (env.length) server.env = Object.fromEntries(env.map(k => [k, '<在运行环境配置>']));
  const cfg = JSON.stringify({ mcpServers: { [mcp.id]: server } }, null, 2);
  const srcLabel = mcp.source === 'custom' ? '自定义' : (mcp.official ? '官方' : '社区');
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={620}
      title={<span>{mcp.name} <Tag bordered={false} style={{ marginLeft: 6, fontSize: 11 }}>{srcLabel}</Tag></span>}>
      <div style={{ fontSize: 12.5, color: '#5A5C6B', lineHeight: 1.6, marginBottom: 14 }}>{desc || '—'}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 16 }}>
        <span style={pill('#F1F1F4', '#5A5C6B')}>{mcp.category}</span>
        {env.map(e => <span key={e} style={pill('#FFF8E6', '#946C00')}>需 {e}</span>)}
        {mcp.homepage && <a href={mcp.homepage} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: ACCENT }}>主页 / 文档 ↗</a>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 650, color: '#33333C' }}>标准 mcpServers 配置（MCP 协议 · stdio）</span>
        <Button size="small" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(cfg); antMsg.success('已复制'); }}>复制</Button>
      </div>
      <pre style={{ margin: 0, background: '#FAFAFC', border: '1px solid #F1F1F5', color: '#33333C', borderRadius: 8, padding: 14, fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 320, overflow: 'auto', fontFamily: 'ui-monospace, Menlo, monospace' }}>{cfg}</pre>
      <div style={{ fontSize: 11.5, color: '#A6A8B4', marginTop: 10 }}>所需环境变量的值在运行环境中配置；远程（HTTP）型 MCP 用 <code>type:"http"</code> + <code>url</code> + <code>headers</code>。</div>
    </Modal>
  );
}

export function McpMarket({ wsId }) {
  const [installed, setInstalled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reg, setReg] = useState(null);          // 注册 MCP 表单
  const [mdetail, setMdetail] = useState(null);  // 点卡片看详情
  const loadInstalled = () => { setLoading(true); return apiCall('/api/tools?ws=' + wsId).then(rows => setInstalled(rows || [])).catch(() => {}).finally(() => setLoading(false)); };
  React.useEffect(() => { loadInstalled(); }, [wsId]);
  const remove = async (m) => { try { await apiCall(`/api/tools/${encodeURIComponent(m.id)}?ws=${wsId}`, { method: 'DELETE' }); antMsg.success('已删除 MCP'); loadInstalled(); } catch (e) { antMsg.error(e.message); } };
  // 平台全局项：本空间不可删，只能禁用/启用（不影响其他空间与平台定义）
  const toggleScope = async (m) => { try { await apiCall(`/api/scope/mcp/${encodeURIComponent(m.id)}/${m.disabled ? 'enable' : 'disable'}?ws=${wsId}`, { method: 'POST' }); antMsg.success(m.disabled ? '已在本空间启用' : '已在本空间禁用'); loadInstalled(); } catch (e) { antMsg.error(e.message); } };
  const submitReg = async () => {
    if (!reg.name || !reg.command) { antMsg.error('名称与命令必填'); return; }
    const body = { name: reg.name, desc: reg.desc || '', category: reg.category || '自定义', homepage: reg.homepage || '',
      command: reg.command, args: (reg.args || '').split('\n').map(s => s.trim()).filter(Boolean),
      env: (reg.env || '').split(/[,\n]/).map(s => s.trim()).filter(Boolean) };
    try { await apiCall(`/api/market/mcp/register?ws=${wsId}`, { method: 'POST', body: JSON.stringify(body) }); antMsg.success(`已注册 MCP「${reg.name}」到本空间`); setReg(null); loadInstalled(); } catch (e) { antMsg.error(e.message); }
  };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, color: '#8A8C99' }}>本空间可用 MCP（{installed.length}）· 含<span style={{ color: '#7C3AED' }}>平台全局</span>（所有空间共享）+ 本空间私有</div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setReg({ category: '自定义' })}>注册 MCP</Button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        : installed.length === 0
          ? <div style={{ border: '1px dashed #DEDEE3', borderRadius: 8, padding: '40px 0', background: '#FCFCFD' }}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本空间还没有 MCP">
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setReg({ category: '自定义' })}>注册 MCP</Button>
              </Empty>
            </div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
              {installed.map(m => { const isPlat = m.scope === 'platform'; return (
                <MarketCard key={m.id} title={m.name} desc={m.summary} installed
                  badge={isPlat
                    ? <Tag bordered={false} color="purple" style={{ fontSize: 11 }}>{m.disabled ? '全局·已禁用' : '全局'}</Tag>
                    : <Tag bordered={false} style={{ fontSize: 11 }}>自定义</Tag>}
                  onRemove={isPlat ? undefined : () => remove(m)}
                  actionEl={isPlat ? <Button size="small" danger={!m.disabled} type={m.disabled ? 'primary' : 'default'} ghost={m.disabled} onClick={() => toggleScope(m)}>{m.disabled ? '在本空间启用' : '在本空间禁用'}</Button> : undefined}
                  onView={() => setMdetail(m)}
                  meta={<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', opacity: m.disabled ? 0.55 : 1 }}>
                    <span style={pill('#F1F1F4', '#5A5C6B')}>{m.category}</span>
                    <span style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11, color: '#8A8C99' }}>{m.command} {(m.args || []).slice(0, 2).join(' ')}</span>
                    {(m.env || []).map(e => <span key={e} style={pill('#FFF8E6', '#946C00')}>需 {e}</span>)}
                  </div>} />
              ); })}
            </div>}

      <McpDetailModal open={!!mdetail} mcp={mdetail} onClose={() => setMdetail(null)} />
      <Modal open={!!reg} onCancel={() => setReg(null)} onOk={submitReg} okText="注册到本空间" title="注册 MCP 接口" width={520} destroyOnClose>
        {reg && <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <Field label="名称" required><Input value={reg.name} onChange={e => setReg({ ...reg, name: e.target.value })} placeholder="如：内部工单系统" /></Field>
          <Field label="用途简介"><Input value={reg.desc} onChange={e => setReg({ ...reg, desc: e.target.value })} placeholder="一句话说明这个 MCP 能做什么" /></Field>
          <Field label="分类"><Input value={reg.category} onChange={e => setReg({ ...reg, category: e.target.value })} /></Field>
          <Field label="启动命令" required><Input value={reg.command} onChange={e => setReg({ ...reg, command: e.target.value })} placeholder="如：npx / node / uvx / python3" /></Field>
          <Field label="参数（每行一个）"><Input.TextArea rows={3} value={reg.args} onChange={e => setReg({ ...reg, args: e.target.value })} placeholder={'-y\n@scope/your-mcp-server'} style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12 }} /></Field>
          <Field label="所需环境变量" hint="逗号或换行分隔，仅填变量名（如 token），值在运行环境配置"><Input value={reg.env} onChange={e => setReg({ ...reg, env: e.target.value })} placeholder="JIRA_TOKEN, API_BASE" /></Field>
          <Field label="主页 / 文档"><Input value={reg.homepage} onChange={e => setReg({ ...reg, homepage: e.target.value })} placeholder="可选" /></Field>
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
  const toggleScope = async (s) => { try { await apiCall(`/api/scope/skill/${encodeURIComponent(s.id)}/${s.disabled ? 'enable' : 'disable'}?ws=${wsId}`, { method: 'POST' }); antMsg.success(s.disabled ? '已在本空间启用' : '已在本空间禁用'); loadInstalled(); } catch (e) { antMsg.error(e.message); } };
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, color: '#8A8C99' }}>本空间可用技能（{installed.length}）· 含<span style={{ color: '#7C3AED' }}>平台全局</span>（所有空间共享）+ 本空间私有</div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewOpen(true)}>新建技能</Button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        : installed.length === 0
          ? <div style={{ border: '1px dashed #DEDEE3', borderRadius: 8, padding: '40px 0', background: '#FCFCFD' }}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本空间还没有技能">
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewOpen(true)}>新建技能</Button>
              </Empty>
            </div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
              {installed.map(s => { const isPlat = s.scope === 'platform'; return (
                <MarketCard key={s.id} title={s.name} sub={s.id} desc={s.description} installed
                  removeLabel="删除" removeConfirm={isPlat ? undefined : `删除技能「${s.name}」？（软删除，可重新上传同名恢复）`}
                  badge={isPlat ? <Tag bordered={false} color="purple" style={{ fontSize: 11 }}>{s.disabled ? '全局·已禁用' : '全局'}</Tag>
                    : s.source === 'upload' ? <Tag bordered={false} style={{ fontSize: 11 }}>{(s.tree || []).filter(e => !e.dir).length} 文件</Tag>
                    : <Tag bordered={false} style={{ fontSize: 11 }}>{s.source === 'custom' ? '自定义' : s.source}</Tag>}
                  info={<><UserOutlined style={{ fontSize: 11 }} /> {s.creator || '—'} · {s.added_at || '—'}</>}
                  onRemove={isPlat ? undefined : () => remove(s)}
                  actionEl={isPlat ? <Button size="small" danger={!s.disabled} type={s.disabled ? 'primary' : 'default'} ghost={s.disabled} onClick={() => toggleScope(s)}>{s.disabled ? '在本空间启用' : '在本空间禁用'}</Button> : undefined}
                  onView={() => setDetail(s)}
                  meta={(s.allowed_tools || []).length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {s.allowed_tools.map(t => <span key={t} style={pill('#F1F1F4', '#5A5C6B')}>{t}</span>)}</div> : null} />
              ); })}
            </div>}

      <Modal open={newOpen} onCancel={() => setNewOpen(false)} footer={null} title="新建技能" width={560} destroyOnClose>
        <div style={{ fontSize: 12.5, color: '#8A8C99', margin: '4px 0 16px', background: '#F7F8FA', borderRadius: 8, padding: '10px 12px' }}>
          技能 = 一个含 <code>SKILL.md</code> 的目录（Claude Agent Skill 规格）。把它打包成压缩包上传，系统会自动解析 <b>name</b> 与 <b>description</b>。
        </div>
        <Upload.Dragger {...uploadProps} disabled={uploading}>
          <p style={{ margin: '6px 0 10px' }}>{uploading ? <Spin /> : <InboxOutlined style={{ fontSize: 38, color: ACCENT }} />}</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#17171C', margin: 0 }}>点击或拖拽技能包到此处上传</p>
          <p style={{ fontSize: 12.5, color: '#8A8C99', margin: '6px 0 0' }}>支持 .zip / .tar / .tar.gz；包内（根目录或子目录）需含 SKILL.md</p>
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
export function DeployPanel({ agents, services, onServiceChanged }) {
  const [busy, setBusy] = useState(null);   // 正在操作的 agentId
  const [dm, setDm] = useState(null);        // 部署弹窗 {agentId, version, iso}
  const statusEl = s => {
    if (!s) return <span style={pill('#F1F1F4', '#A6A8B4')}>○ 已停止</span>;
    if (s.status === 'deploying') return <span style={pill('#FFF8E6', '#946C00')}>◌ 部署中</span>;
    if (s.status === 'failed') return <Tooltip title={s.error || ''}><span style={pill('#FDECEC', '#C0392B')}>✕ 失败</span></Tooltip>;
    return <span style={pill('#E9F7EF', '#1E8449')}>● 运行中{s.location === 'cloud' ? '·云' : ''}</span>;
  };
  const svcMap = {}; (services || []).forEach(s => { svcMap[s.agentId] = s; });
  const published = (agents || []).filter(a => a.published);
  const running = published.filter(a => { const s = svcMap[a.id]; return s && s.status !== 'failed' && s.status !== 'deploying'; }).length;
  const stableUrl = a => { const s = svcMap[a.id]; return (s && s.stable_url) || (location.origin + `/api/agents/${a.id}/service-chat`); };
  const copy = x => { navigator.clipboard && navigator.clipboard.writeText(x); antMsg.success('已复制'); };
  const stopOne = async aid => { try { await apiCall(`/api/agents/${aid}/service/stop`, { method: 'POST' }); antMsg.success('已停服'); onServiceChanged && onServiceChanged(); } catch (e) { antMsg.error(e.message); } };
  // 发布/迁移/钉选/重启 都是 publish 的不同参数（单主实例：停旧起新）
  const deploy = async (aid, iso, version, note) => {
    setBusy(aid);
    const vq = version ? `&version=${version}` : '';
    try { await apiCall(`/api/agents/${aid}/publish?isolation=${iso}${vq}`, { method: 'POST', body: '{}' }); antMsg.success(note || '已更新部署'); onServiceChanged && onServiceChanged(); }
    catch (e) { antMsg.error(e.message); }
    finally { setBusy(null); }
  };
  const dmAgent = dm && (agents || []).find(a => a.id === dm.agentId);
  const dmTier = ISOLATIONS.find(o => o.key === ((dm && dm.iso) || 'L1'));
  const openNew = () => { const a = (agents || [])[0]; setDm({ agentId: a && a.id, version: a && a.version, iso: 'L1', existing: false }); };
  const openManage = a => { const s = svcMap[a.id]; setDm({ agentId: a.id, version: a.publishedVersion || a.version, iso: (s && s.isolation) || 'L1', existing: true }); };
  const apply = async () => { if (!dm || !dm.agentId) return; await deploy(dm.agentId, dm.iso || 'L1', dm.version, dm.existing ? '已更新部署' : `已部署「${dmAgent ? dmAgent.name : ''}」`); setDm(null); };
  const restartModal = async () => { if (!dm) return; await deploy(dm.agentId, dm.iso || 'L1', dm.version, '已重启'); setDm(null); };
  const stopModal = async () => { if (!dm) return; await stopOne(dm.agentId); setDm(null); };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 750, letterSpacing: -0.3, color: '#17171C' }}>部署</div>
          <Text style={{ color: '#8A8C99', fontSize: 13.5 }}>发布与运行控制台：发起部署、查看运行态与稳定地址；点「管理」改版本 / 部署方式、停 / 重启</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} disabled={!API_ON || (agents || []).length === 0} onClick={openNew}>部署 Agent</Button>
      </div>
      {!API_ON ? <Empty description="部署需先在本机启动后端" /> : (<>
        <div style={{ display: 'flex', gap: 18, marginBottom: 14, fontSize: 12.5, color: '#5A5C6B' }}>
          <span>已部署 <b style={{ color: '#17171C' }}>{published.length}</b></span>
          <span>运行中 <b style={{ color: '#1E8449' }}>{running}</b></span>
          <span>已停止 <b style={{ color: '#A6A8B4' }}>{published.length - running}</b></span>
        </div>
        {published.length === 0
          ? <div style={{ border: '1px dashed #DEDEE3', borderRadius: 8, padding: '32px 24px', background: '#FCFCFD', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#33333C', marginBottom: 6 }}>还没有部署</div>
              <div style={{ fontSize: 12.5, color: '#8A8C99', marginBottom: 16 }}>三步:① 选一个 Agent ② 选版本 + 部署方式(L0/L1/L2) ③ 发布并在此管理</div>
              <Button type="primary" icon={<PlusOutlined />} disabled={(agents || []).length === 0} onClick={openNew}>部署 Agent</Button>
            </div>
          : <div style={{ border: '1px solid #EBEBF1', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'flex', fontSize: 12, color: '#8A8C99', background: '#FAFAFB', padding: '8px 14px', borderBottom: '1px solid #F1F1F5' }}>
                <div style={{ flex: 1 }}>Agent / 稳定地址</div><div style={{ width: 90 }}>生产版本</div><div style={{ width: 130 }}>部署方式</div><div style={{ width: 96 }}>运行态</div><div style={{ width: 72 }} />
              </div>
              {published.map(a => { const s = svcMap[a.id]; const cur = (s && s.isolation) || 'L1'; const pinned = a.publishedVersion || a.version; const tier = ISOLATIONS.find(o => o.key === cur); return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid #F6F6F9' }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.name} <span style={pill('#EEF0FF', '#4F46E5')}>{fwName(a.framework)}</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <Text code style={{ fontSize: 11, color: '#8A8C99' }} ellipsis>{stableUrl(a)}</Text>
                      <a onClick={() => copy(stableUrl(a))} style={{ fontSize: 11, color: ACCENT, flexShrink: 0 }}>复制</a>
                    </div>
                  </div>
                  <div style={{ width: 90 }}><span style={pill('#E9F7EF', '#1E8449')}>v{pinned}</span></div>
                  <div style={{ width: 130 }}><Tooltip title={tier && tier.hint}><span style={pill('#F1F1F4', '#5A5C6B')}>{cur} · {(tier && tier.name) || ''}</span></Tooltip></div>
                  <div style={{ width: 96 }}>{statusEl(s)}</div>
                  <div style={{ width: 72, textAlign: 'right' }}><Button size="small" onClick={() => openManage(a)}>管理</Button></div>
                </div>
              ); })}
            </div>}
        <div style={{ marginTop: 14, fontSize: 12.5, color: '#A6A8B4' }}>想和已发布的 Agent 对话验证？去「Playground」。L3 即用即弃为会话级、不在部署。</div>
      </>)}

      <Modal title={dm && dm.existing ? `管理部署 · ${dmAgent ? dmAgent.name : ''}` : '部署 Agent'} open={!!dm} onCancel={() => setDm(null)} width={480} destroyOnHidden
        footer={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {dm && dm.existing && svcMap[dm.agentId] && <Popconfirm title="停止该服务？" onConfirm={stopModal}><Button danger>停服</Button></Popconfirm>}
            {dm && dm.existing && <Button style={{ marginLeft: 8 }} onClick={restartModal}>重启</Button>}
            <span style={{ flex: 1 }} />
            <Button onClick={() => setDm(null)}>取消</Button>
            <Button type="primary" style={{ marginLeft: 8 }} disabled={!dm || !dm.agentId} loading={dm && busy === dm.agentId} onClick={apply}>{dm && dm.existing ? '应用更改' : '发布'}</Button>
          </div>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '12px 0 4px' }}>
          <div><div style={{ fontSize: 13, color: '#5A5C6B', marginBottom: 6 }}>Agent</div>
            {dm && dm.existing
              ? <div style={{ padding: '6px 11px', border: '1px solid #F1F1F5', borderRadius: 8, background: '#FAFAFB', fontSize: 13.5, fontWeight: 600 }}>{dmAgent ? dmAgent.name : ''} <span style={pill('#EEF0FF', '#4F46E5')}>{dmAgent ? fwName(dmAgent.framework) : ''}</span></div>
              : <Select value={dm && dm.agentId} style={{ width: '100%' }} placeholder="选择 Agent"
                  onChange={id => { const a = (agents || []).find(x => x.id === id); setDm(d => ({ ...d, agentId: id, version: a ? a.version : 1 })); }}
                  options={(agents || []).map(a => ({ value: a.id, label: `${a.name}（${fwName(a.framework)}）` }))} />}</div>
          <div><div style={{ fontSize: 13, color: '#5A5C6B', marginBottom: 6 }}>生产版本<span style={{ color: '#A6A8B4' }}>（钉选 = 晋升 / 回滚）</span></div>
            <Select value={dm && dm.version} style={{ width: '100%' }}
              onChange={v => setDm(d => ({ ...d, version: v }))}
              options={Array.from({ length: (dmAgent && dmAgent.version) || 1 }, (_, i) => ({ value: i + 1, label: `v${i + 1}${dmAgent && i + 1 === dmAgent.version ? ' · 最新' : ''}` }))} /></div>
          <div><div style={{ fontSize: 13, color: '#5A5C6B', marginBottom: 6 }}>部署方式（环境 tier）</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '7px 10px', background: '#EEF0FF', border: '1px solid #D8DCFB', borderRadius: 8, fontSize: 11.5, color: '#4F46E5', lineHeight: 1.55, marginBottom: 8 }}>
              <LockOutlined style={{ marginTop: 2, flexShrink: 0 }} /><span>{TENANT_NOTE}</span>
            </div>
            <Select value={(dm && dm.iso) || 'L1'} style={{ width: '100%' }} onChange={iso => setDm(d => ({ ...d, iso }))}
              options={ISOLATIONS.map(o => ({ value: o.key, label: `${o.tag} · ${o.name}` }))} />
            <div style={{ marginTop: 8, padding: '10px 12px', background: '#F7F8FB', border: '1px solid #EEF0F5', borderRadius: 8, fontSize: 12, color: '#5A5C6B', lineHeight: 1.65, whiteSpace: 'pre-line' }}>{dmTier && dmTier.detail}</div>
          </div>
        </div>
      </Modal>
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

/* ================= 根组件 ================= */
