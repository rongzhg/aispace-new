import React, { useState, useMemo } from "react";
import {
  ConfigProvider, App as AntApp, Layout, Menu, Button, Table, Input, Select, Card, Tabs,
  Drawer, Checkbox, Tag, Collapse, Descriptions, Modal, Tooltip, Avatar, Dropdown,
  Slider, InputNumber, Popconfirm, Popover, Space, Typography, Empty, Segmented, Divider, theme, message,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined, SearchOutlined, AppstoreOutlined,
  UserOutlined, TeamOutlined, SendOutlined, ReloadOutlined, ArrowLeftOutlined, DownOutlined,
  RobotOutlined, ToolOutlined, BulbOutlined, CheckOutlined, MessageOutlined, FileTextOutlined,
  SettingOutlined, CloseOutlined, ThunderboltOutlined, SwapOutlined, BranchesOutlined, ExperimentOutlined,
} from "@ant-design/icons";
const { Sider, Content } = Layout;
const { Text } = Typography;
import { ACCENT, FRAMEWORKS, PROVIDERS, MODEL_PARAMS, TOOLS, SKILLS, TEMPLATES, fwName, ISOLATIONS, isoName, INIT_WORKSPACES, td, now, mkAgent, INIT_AGENTS } from "./config";
import { apiCall, API_ON, setApiOn } from "./api";
import { AgentBuilder, AgentDetail, AgentWorkbench, VersionDiff, MembersPanel, ChatPanel, Playground, SkillMarket, McpMarket, DeployPanel, EnvPanel, SessionConsole, pill, antMsg, setAntMsg } from "./components";
import "./agent-redesign.css";

let AGENT_SEQ = 100;
function Root() {
  const { message } = AntApp.useApp();
  setAntMsg(message);
  const [workspaces, setWorkspaces] = useState(INIT_WORKSPACES);
  const [curWs, setCurWs] = useState('w1');
  const [agents, setAgents] = useState(INIT_AGENTS);
  const [nav, setNav] = useState('agent'); // chat | agent | deploy | skill | mcp | env | members
  const [view, setView] = useState({ name: 'list' });
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('updated');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [runtimeFilter, setRuntimeFilter] = useState('all');
  const [createWsOpen, setCreateWsOpen] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [apiMode, setApiMode] = useState(false);
  const [services, setServices] = useState([]);

  const loadWorkspaces = () => apiCall('/api/workspaces').then(d => { setWorkspaces(d); return d; }).catch(() => {});
  const loadAgents = wsId => apiCall(`/api/agents?ws=${wsId}`).then(setAgents).catch(() => {});
  const loadServices = () => apiCall('/api/services').then(setServices).catch(() => {});
  React.useEffect(() => {
    apiCall('/api/health').then(() => { setApiOn(true); setApiMode(true); loadWorkspaces(); loadAgents(curWs); loadServices(); }).catch(() => { setApiOn(false); });
  }, []);
  // 云端发布是异步的（部署中→运行中）：只要有服务在「部署中」，每 5s 轮询刷新一次
  React.useEffect(() => {
    if (!services.some(s => s.status === 'deploying')) return;
    const t = setInterval(loadServices, 5000);
    return () => clearInterval(t);
  }, [services]);
  const svcMap = useMemo(() => { const m = {}; services.forEach(s => { m[s.agentId] = s; }); return m; }, [services]);
  const openAgent = a => {
    if (API_ON) apiCall(`/api/agents/${a.id}`).then(full => setView({ name: 'detail', agent: full })).catch(() => setView({ name: 'detail', agent: a }));
    else setView({ name: 'detail', agent: a });
  };

  const ws = workspaces.find(w => w.id === curWs);
  const myRole = (ws.members.find(m => m.id === 'u0') || {}).role || 'member';
  const isPlatformAdmin = true; // demo：当前 mock 用户为平台管理员；生产由 SSO/RBAC 决定
  const ownerName = id => {
    if (!id) return '未记录';
    const m = (ws.members || []).find(x => x.id === id || x.name === id);
    return (m && m.name) || id;
  };

  const runtimeMeta = a => {
    const s = svcMap[a.id];
    const liveIso = (s && s.isolation) || a.publishedIsolation || 'L1';
    const liveVersion = (s && s.version) || a.publishedVersion || '-';
    const publishForm = `${isoName(liveIso)}(${liveIso})`;
    const location = s ? (s.location === 'cloud' ? '云端' : '本地') : '';
    if (!a.published) return { key: 'unpublished', label: '未发布', color: '#94A3B8', bg: '#F1F5F9', meta: '无 Live 版本' };
    if (!s) return { key: 'stopped', label: '已发布 · 停止', color: '#64748B', bg: '#F1F5F9', meta: `${publishForm} · Live v${liveVersion}` };
    if (s.status === 'deploying') return { key: 'deploying', label: '部署中', color: '#D97706', bg: '#FEF3C7', meta: `${location} · ${publishForm} · Live v${liveVersion}` };
    if (s.status === 'failed') return { key: 'failed', label: '失败', color: '#DC2626', bg: '#FEE2E2', meta: `${s.error || '部署失败'} · ${publishForm}` };
    return { key: 'running', label: '运行中', color: '#16A34A', bg: '#DCFCE7', meta: `${location} · ${publishForm} · Live v${liveVersion}` };
  };
  const draftMeta = a => {
    if (!a.published) return { key: 'draft_only', label: '仅草稿', cls: 'draft-state--draft', meta: `Head v${a.version || '-'}` };
    if (a.publishedVersion !== a.version) return { key: 'diverged', label: '与 Live 不同', cls: 'draft-state--diverged', meta: `Head v${a.version} / Live v${a.publishedVersion}` };
    return { key: 'synced', label: '与 Live 一致', cls: 'draft-state--ok', meta: `Head v${a.version}` };
  };
  const ownerOptions = useMemo(() => {
    const ids = Array.from(new Set(agents.filter(a => a.wsId === curWs && !a.deleted).map(a => a.creator).filter(Boolean)));
    return [{ value: 'all', label: '全部创建人' }, ...ids.map(id => ({ value: id, label: ownerName(id) }))];
  }, [agents, curWs, ws]);

  const visibleAgents = useMemo(() => {
    let list = agents.filter(a => a.wsId === curWs && !a.deleted);
    if (search) list = list.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
    if (ownerFilter !== 'all') list = list.filter(a => a.creator === ownerFilter);
    if (runtimeFilter === 'draft_diff') list = list.filter(a => draftMeta(a).key === 'diverged');
    else if (runtimeFilter !== 'all') list = list.filter(a => runtimeMeta(a).key === runtimeFilter);
    return list.slice().sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : b.updatedAt.localeCompare(a.updatedAt));
  }, [agents, curWs, search, sort, ownerFilter, runtimeFilter, services]);

  // 列表「显示 N / total」用的总数（KPI 概览已移除，仅保留这个计数）
  const agentTotal = useMemo(() => agents.filter(a => a.wsId === curWs && !a.deleted).length, [agents, curWs]);

  const switchWs = id => { setCurWs(id); setView({ name: 'list' }); setNav('agent'); setSearch(''); setOwnerFilter('all'); setRuntimeFilter('all'); if (API_ON) loadAgents(id); };
  // stay=true：创建后停留在 Builder（用于「创建并发布」），返回新建 agent；否则回列表
  const saveNew = (data, stay) => {
    if (API_ON) {
      return apiCall('/api/agents', { method: 'POST', body: JSON.stringify({ ...data, ws_id: curWs }) })
        .then(a => { message.success(`已创建「${data.name}」及初始版本 v1`); loadAgents(curWs); if (!stay) setView({ name: 'list' }); return a; })
        .catch(e => { message.error('创建失败：' + e.message); return null; });
    }
    const id = 'a' + (++AGENT_SEQ); const ts = now();
    const a = { id, wsId: curWs, version: 1, updatedAt: ts, deleted: false, creator: 'u0', ...data, versions: [{ version: 1, createdAt: ts, config: { ...data } }] };
    setAgents([a, ...agents]); message.success(`已创建「${data.name}」及初始版本 v1`); if (!stay) setView({ name: 'list' });
    return Promise.resolve(a);
  };
  // stay=true：保存后停留在工作台（方案A），返回刷新后的完整 agent
  const saveEdit = (orig, data, stay) => {
    if (API_ON) {
      return apiCall(`/api/agents/${orig.id}`, { method: 'PUT', body: JSON.stringify({ model: data.model, desc: data.desc, params: data.params, files: data.files, tools: data.tools, skills: data.skills }) })
        .then(() => { message.success(`已保存为新版本 v${orig.version + 1}`); loadAgents(curWs); if (!stay) setView({ name: 'list' }); return apiCall(`/api/agents/${orig.id}`); })
        .catch(e => { message.error('保存失败：' + e.message); return null; });
    }
    const ts = now(); let updated = null;
    setAgents(agents.map(a => { if (a.id === orig.id) { updated = { ...a, ...data, version: a.version + 1, updatedAt: ts, versions: [...a.versions, { version: a.version + 1, createdAt: ts, config: { ...data } }] }; return updated; } return a; }));
    message.success(`已保存为新版本 v${orig.version + 1}`); if (!stay) setView({ name: 'list' });
    return Promise.resolve(updated);
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

  const renderRuntime = a => {
    const m = runtimeMeta(a);
    return (
      <div>
        <span className="runtime-state" title={m.meta}>
          <span className="runtime-dot" style={{ '--runtime-color': m.color, '--runtime-bg': m.bg } as React.CSSProperties} />
          {m.label}
        </span>
        <div className="runtime-meta">{m.meta}</div>
      </div>
    );
  };
  const renderDraft = a => {
    const m = draftMeta(a);
    return (
      <div>
        <span className={'draft-state ' + m.cls}>{m.label}</span>
        <div className="draft-state__meta">{m.meta}</div>
      </div>
    );
  };
  const renderOwner = a => {
    const name = ownerName(a.creator);
    return (
      <div className="owner-cell">
        <Avatar size={22} className="owner-avatar">{name.slice(0, 1)}</Avatar>
        <span className="owner-name">{name}</span>
      </div>
    );
  };
  const columns = [
    { title: 'Agent', dataIndex: 'name', ellipsis: true, render: (t, r) => (
      <div className="agent-name-cell">
        <div className="agent-avatar"><RobotOutlined style={{ fontSize: 15 }} /></div>
        <div style={{ minWidth: 0 }}>
          <div className="agent-name-main">{t}</div>
          <div className="agent-name-sub"><span className="compact-code">{r.id}</span> · {fwName(r.framework)} · 更新 {(r.updatedAt || '').slice(5)}</div>
        </div>
      </div>) },
    { title: 'Owner', width: 140, render: (_, r) => renderOwner(r) },
    { title: 'Live', width: 162, render: (_, r) => renderRuntime(r) },
    { title: 'Draft', width: 126, render: (_, r) => renderDraft(r) },
    { title: '', width: 82, fixed: 'right', render: (_, r) => (
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <Button size="small" type="link" onClick={() => openAgent(r)} style={{ paddingInline: 6 }}>管理</Button>
        <Popconfirm title="删除该 Agent？" description="软删除，记录保留" onConfirm={() => softDelete(r.id)}>
          <Tooltip title="删除"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip>
        </Popconfirm>
      </div>) },
  ];

  const inBuilder = view.name === 'create' || view.name === 'edit' || view.name === 'detail';
  const sectionLabel = nav === 'chat' ? 'Chat'
    : nav === 'deploy' ? '部署'
    : nav === 'playground' ? 'Playground'
    : nav === 'session' ? '会话'
    : nav === 'skill' ? '技能'
    : nav === 'mcp' ? 'MCP'
    : nav === 'env' ? '环境'
    : nav === 'members' ? '成员与权限'
    : view.name === 'create' ? '创建 Agent'
    : view.name === 'edit' ? '编辑 · ' + (view.agent ? view.agent.name : '')
    : view.name === 'detail' ? '详情'
    : view.name === 'diff' ? '版本对比' : 'Agent';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider className="ais-sider" width={236} theme="light" style={{ background: '#FAFAFB', borderRight: '1px solid #EBEBF1', padding: '16px 14px', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', left: 0, top: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 6px 16px' }}>
          <div className="ais-logo-mark" style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#4F46E5,#7A72ED)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, boxShadow: '0 2px 7px rgba(79,70,229,0.30)' }}>A</div>
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
            { key: 'chat', icon: <MessageOutlined />, label: 'Chat' },
            { key: 'agent', icon: <RobotOutlined />, label: 'Agent' },
            { key: 'deploy', icon: <ThunderboltOutlined />, label: '部署' },
            { key: 'playground', icon: <ExperimentOutlined />, label: 'Playground' },
            { key: 'session', icon: <MessageOutlined />, label: '会话' },
            { key: 'skill', icon: <BulbOutlined />, label: 'Skill' },
            { key: 'mcp', icon: <ToolOutlined />, label: 'MCP' },
            { key: 'env', icon: <AppstoreOutlined />, label: '环境' },
            { type: 'divider' },
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

      <Layout style={{ marginLeft: 236, background: '#f6f7f9' }}>
        <div className="ais-topbar" style={{ height: 56, borderBottom: '1px solid #EFEFF2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', position: 'sticky', top: 0, background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 20 }}>
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

        <Content className="ais-content" style={{ padding: inBuilder ? '14px 18px' : '18px 24px 32px', maxWidth: inBuilder ? 'none' : 1480, width: '100%', margin: inBuilder ? 0 : '0 auto', height: inBuilder ? 'calc(100vh - 48px)' : 'auto' }}>
          {nav === 'agent' && view.name === 'list' && (
            <div className="agent-console">
              <div className="agent-console__header">
                <div>
                  <div className="agent-console__eyebrow">{ws.name} · Agent Registry</div>
                  <div className="agent-console__title">Agent Operations</div>
                  <div className="agent-console__subtitle">围绕负责人、Live 版本、发布方式和草稿状态做运营判断。</div>
                </div>
                <Space size={8}>
                  <Button icon={<ReloadOutlined />} onClick={() => { if (API_ON) { loadAgents(curWs); loadServices(); message.success('已刷新'); } }}>刷新</Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setView({ name: 'create' })}>创建 Agent</Button>
                </Space>
              </div>

              <div className="agent-toolbar">
                <Input allowClear size="small" prefix={<SearchOutlined style={{ color: '#94A3B8' }} />} placeholder="按名称或描述搜索" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
                <Select size="small" value={ownerFilter} style={{ width: 120 }} onChange={setOwnerFilter} options={ownerOptions} />
                <Select size="small" value={runtimeFilter} style={{ width: 144 }} onChange={setRuntimeFilter}
                  options={[
                    { value: 'all', label: '全部 Live 状态' },
                    { value: 'running', label: '运行中' },
                    { value: 'deploying', label: '部署中' },
                    { value: 'failed', label: '失败' },
                    { value: 'stopped', label: '已停止' },
                    { value: 'unpublished', label: '未发布' },
                    { value: 'draft_diff', label: 'Draft 与 Live 不同' },
                  ]} />
                <Select size="small" value={sort} style={{ width: 112 }} onChange={setSort} options={[{ value: 'updated', label: '最近编辑' }, { value: 'name', label: '名称 A-Z' }]} />
                <div style={{ flex: 1 }} />
                <Text style={{ color: '#64748B', fontSize: 12 }}>显示 {visibleAgents.length} / {agentTotal}</Text>
              </div>

              <div className="agent-table-shell">
                <Table rowKey="id" columns={columns} dataSource={visibleAgents} pagination={false} size="small" scroll={{ x: 700 }}
                  locale={{ emptyText: <div style={{ padding: '36px 0' }}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search || ownerFilter !== 'all' || runtimeFilter !== 'all' ? '没有匹配的 Agent' : '该空间还没有 Agent'}>{!search && ownerFilter === 'all' && runtimeFilter === 'all' && <Button type="primary" icon={<PlusOutlined />} onClick={() => setView({ name: 'create' })}>创建 Agent</Button>}</Empty></div> }} />
              </div>
            </div>
          )}
          {nav === 'agent' && view.name === 'create' && <AgentWorkbench mode="create" wsId={curWs} services={services} onBack={() => setView({ name: 'list' })} onCreate={data => saveNew(data, true)} onSaveStay={(a, data) => saveEdit(a, data, true)} onChanged={() => { if (API_ON) { loadAgents(curWs); loadServices(); } }} onDiff={a => setView({ name: 'diff', agent: a })} />}
          {nav === 'agent' && (view.name === 'detail' || view.name === 'edit') && (() => {
            // 列表项有最新 published/状态字段但无 versions；打开详情时抓取的 view.agent 带 versions。合并：列表字段覆盖 + 保留 versions
            const listA = agents.find(a => a.id === view.agent.id);
            const full = listA ? { ...view.agent, ...listA, versions: view.agent.versions || listA.versions } : view.agent;
            return <AgentWorkbench mode="open" agent={full} services={services} wsId={curWs} onBack={() => setView({ name: 'list' })} onSaveStay={(a, data) => saveEdit(a, data, true)} onChanged={() => { if (API_ON) { loadAgents(curWs); loadServices(); } }} onDiff={a => setView({ name: 'diff', agent: a })} />;
          })()}
          {nav === 'agent' && view.name === 'diff' && <VersionDiff agent={agents.find(a => a.id === view.agent.id) || view.agent} onBack={() => setView({ name: 'detail', agent: view.agent })} />}
          {nav === 'chat' && <ChatPanel curWs={curWs} isAdmin={isPlatformAdmin} onChanged={() => { if (API_ON) { loadWorkspaces(); loadAgents(curWs); } }} />}
          {nav === 'deploy' && <DeployPanel agents={visibleAgents} services={services} onServiceChanged={() => { if (API_ON) { loadServices(); loadAgents(curWs); } }} />}
          {nav === 'playground' && <Playground agents={visibleAgents} />}
          {nav === 'session' && <SessionConsole me={'u0'} onGoAgents={() => { setNav('agent'); setView({ name: 'list' }); }} />}
          {nav === 'skill' && <SkillMarket wsId={curWs} me={(ws && (ws.members.find(m => m.id === 'u0') || {}).name) || 'Helena（我）'} />}
          {nav === 'mcp' && <McpMarket wsId={curWs} />}
          {nav === 'env' && <EnvPanel />}
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
      token: { colorPrimary: '#0F172A', colorLink: ACCENT, colorLinkHover: '#1D4ED8', borderRadius: 5, fontSize: 13, controlHeight: 30, colorBorder: '#DDE3EA', colorBorderSecondary: '#EAEFF5', colorText: '#111827', colorTextSecondary: '#475569', fontFamily: 'Inter, -apple-system, "PingFang SC", "Microsoft YaHei", Segoe UI, sans-serif' },
      components: {
        Layout: { bodyBg: '#F6F7F9' },
        Menu: { itemBg: 'transparent', itemSelectedBg: '#E8EEF7', itemSelectedColor: '#0F172A', itemHeight: 34, itemBorderRadius: 5, itemColor: '#475569', itemHoverBg: '#EFF3F8', iconSize: 15 },
        Table: { headerBg: '#F8FAFC', headerColor: '#64748B', headerSplitColor: 'transparent', borderColor: '#E2E8F0', rowHoverBg: '#F8FAFC', cellPaddingBlock: 5, cellPaddingInline: 12, fontSize: 12.5 },
        Button: { primaryShadow: 'none', defaultShadow: 'none', fontWeight: 600, controlHeight: 30, paddingInline: 12 },
        Input: { activeShadow: '0 0 0 2px rgba(37,99,235,0.12)' },
        Segmented: { itemSelectedBg: '#fff', trackBg: '#EAEFF5', itemSelectedColor: '#0F172A', itemColor: '#475569' },
        Tabs: { inkBarColor: ACCENT, itemSelectedColor: '#0F172A', itemColor: '#64748B' },
        Card: { borderRadiusLG: 6 },
      },
    },
  }, React.createElement(AntApp, null, React.createElement(Root)));
}
export default App;
