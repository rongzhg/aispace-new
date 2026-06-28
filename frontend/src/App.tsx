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
import { AgentBuilder, AgentDetail, AgentWorkbench, VersionDiff, MembersPanel, ChatPanel, Playground, SkillMarket, McpMarket, DeployPanel, EnvPanel, pill, antMsg, setAntMsg } from "./components";

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

  const visibleAgents = useMemo(() => {
    let list = agents.filter(a => a.wsId === curWs && !a.deleted);
    if (search) list = list.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
    return list.slice().sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : b.updatedAt.localeCompare(a.updatedAt));
  }, [agents, curWs, search, sort]);

  const switchWs = id => { setCurWs(id); setView({ name: 'list' }); setNav('agent'); setSearch(''); if (API_ON) loadAgents(id); };
  // stay=true：创建后停留在 Builder（用于「创建并发布」），返回新建 agent；否则回列表
  const saveNew = (data, stay) => {
    if (API_ON) {
      return apiCall('/api/agents', { method: 'POST', body: JSON.stringify({ ...data, ws_id: curWs }) })
        .then(a => { message.success(`已创建「${data.name}」及初始版本 v1`); loadAgents(curWs); if (!stay) setView({ name: 'list' }); return a; })
        .catch(e => { message.error('创建失败：' + e.message); return null; });
    }
    const id = 'a' + (++AGENT_SEQ); const ts = now();
    const a = { id, wsId: curWs, version: 1, updatedAt: ts, deleted: false, ...data, versions: [{ version: 1, createdAt: ts, config: { ...data } }] };
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

  const statusDot = (color, label, title) => <span title={title || label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#33333C', whiteSpace: 'nowrap' }}><span style={{ width: 7, height: 7, borderRadius: 4, background: color, flexShrink: 0 }} />{label}</span>;
  const renderStatus = a => {
    if (!a.published) return statusDot('#C9CAD6', '未发布');
    const s = svcMap[a.id];
    if (!s) return statusDot('#C9CAD6', '已停止');
    if (s.status === 'deploying') return statusDot('#E8A33D', '部署中', s.error);
    if (s.status === 'failed') return statusDot('#E5484D', '失败', s.error);
    return statusDot('#30A46C', '运行中' + (s.location === 'cloud' ? ' · 云' : ''));
  };
  const columns = [
    { title: '名称', dataIndex: 'name', ellipsis: true, render: (t, r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: '#EEF0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><RobotOutlined style={{ color: ACCENT, fontSize: 15 }} /></div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: '#17171C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t}</div>
          <div style={{ color: '#9A9CA8', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.desc || '暂无描述'}</div>
        </div>
      </div>) },
    { title: '状态', width: 116, render: (_, r) => renderStatus(r) },
    { title: '框架', width: 116, dataIndex: 'framework', render: f => <span style={pill('#EEF0FF', '#4F46E5')}>{fwName(f)}</span> },
    { title: '模型', width: 164, dataIndex: 'model', render: m => <span style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12, color: '#5A5C6B' }}>{m}</span> },
    { title: '版本', width: 104, render: (_, r) => (
      <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
        <span style={pill('#F1F1F4', '#5A5C6B')}>v{r.version}</span>
        {r.published && r.publishedVersion !== r.version && <span style={pill('#E9F7EF', '#1E8449')} title={`已发布 v${r.publishedVersion}`}>线上 v{r.publishedVersion}</span>}
      </span>) },
    { title: '更新', width: 120, dataIndex: 'updatedAt', render: t => <span style={{ color: '#9A9CA8', fontSize: 12.5 }}>{t.slice(5)}</span> },
    { title: '', width: 72, render: (_, r) => (
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 2 }}>
        <Tooltip title="编辑"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => setView({ name: 'edit', agent: r })} /></Tooltip>
        <Popconfirm title="删除该 Agent？" description="软删除，记录保留" onConfirm={() => softDelete(r.id)}>
          <Tooltip title="删除"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip>
        </Popconfirm>
      </div>) },
  ];

  const inBuilder = view.name === 'create' || view.name === 'edit' || view.name === 'detail';
  const sectionLabel = nav === 'chat' ? 'Chat'
    : nav === 'deploy' ? '部署'
    : nav === 'playground' ? 'Playground'
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
            { key: 'chat', icon: <MessageOutlined />, label: 'Chat' },
            { key: 'agent', icon: <RobotOutlined />, label: 'Agent' },
            { key: 'deploy', icon: <ThunderboltOutlined />, label: '部署' },
            { key: 'playground', icon: <ExperimentOutlined />, label: 'Playground' },
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
          {nav === 'agent' && view.name === 'list' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 750, letterSpacing: -0.3, color: '#17171C' }}>Agent</div>
                  <Text style={{ color: '#8A8C99', fontSize: 13.5 }}>管理、调试与版本化你的智能体</Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setView({ name: 'create' })}>创建 Agent</Button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                <Input allowClear prefix={<SearchOutlined style={{ color: '#B6B6BE' }} />} placeholder="搜索 Agent 名称" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 260 }} />
                <Select value={sort} style={{ width: 136 }} onChange={setSort} options={[{ value: 'updated', label: '最近编辑' }, { value: 'name', label: '名称 A–Z' }]} />
                <div style={{ flex: 1 }} />
                <Text style={{ color: '#A6A8B4', fontSize: 12.5 }}>共 {visibleAgents.length} 个</Text>
              </div>
              <div style={{ border: '1px solid #EBEBF1', borderRadius: 8, overflow: 'hidden' }}>
                <Table rowKey="id" columns={columns} dataSource={visibleAgents} pagination={false} size="middle"
                  onRow={r => ({ onClick: () => openAgent(r), style: { cursor: 'pointer' } })}
                  locale={{ emptyText: <div style={{ padding: '36px 0' }}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search ? '没有匹配的 Agent' : '该空间还没有 Agent'}>{!search && <Button type="primary" icon={<PlusOutlined />} onClick={() => setView({ name: 'create' })}>创建 Agent</Button>}</Empty></div> }} />
              </div>
            </div>
          )}
          {nav === 'agent' && view.name === 'create' && <AgentWorkbench mode="create" wsId={curWs} service={null} onBack={() => setView({ name: 'list' })} onCreate={data => saveNew(data, true)} onChanged={() => { if (API_ON) { loadAgents(curWs); loadServices(); } }} onDiff={a => setView({ name: 'diff', agent: a })} />}
          {nav === 'agent' && (view.name === 'detail' || view.name === 'edit') && (() => {
            // 列表项有最新 published/状态字段但无 versions；打开详情时抓取的 view.agent 带 versions。合并：列表字段覆盖 + 保留 versions
            const listA = agents.find(a => a.id === view.agent.id);
            const full = listA ? { ...view.agent, ...listA, versions: view.agent.versions || listA.versions } : view.agent;
            return <AgentWorkbench mode="open" agent={full} service={svcMap[view.agent.id] || null} wsId={curWs} onBack={() => setView({ name: 'list' })} onSaveStay={(a, data) => saveEdit(a, data, true)} onChanged={() => { if (API_ON) { loadAgents(curWs); loadServices(); } }} onDiff={a => setView({ name: 'diff', agent: a })} />;
          })()}
          {nav === 'agent' && view.name === 'diff' && <VersionDiff agent={agents.find(a => a.id === view.agent.id) || view.agent} onBack={() => setView({ name: 'detail', agent: view.agent })} />}
          {nav === 'chat' && <ChatPanel curWs={curWs} isAdmin={isPlatformAdmin} onChanged={() => { if (API_ON) { loadWorkspaces(); loadAgents(curWs); } }} />}
          {nav === 'deploy' && <DeployPanel agents={visibleAgents} services={services} onServiceChanged={() => { if (API_ON) { loadServices(); loadAgents(curWs); } }} />}
          {nav === 'playground' && <Playground agents={visibleAgents} />}
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
      token: { colorPrimary: '#17171C', colorLink: ACCENT, colorLinkHover: '#6E66EA', borderRadius: 7, fontSize: 14, controlHeight: 32, colorBorder: '#E7E7EC', colorBorderSecondary: '#F1F1F5', colorText: '#17171C', colorTextSecondary: '#5A5C6B', fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", Segoe UI, Inter, sans-serif' },
      components: {
        Layout: { bodyBg: '#fff' },
        Menu: { itemBg: 'transparent', itemSelectedBg: '#EEF0FF', itemSelectedColor: ACCENT, itemHeight: 38, itemBorderRadius: 8, itemColor: '#5B5D6B', itemHoverBg: '#F4F4F7', iconSize: 16 },
        Table: { headerBg: '#FAFAFB', headerColor: '#8A8C99', headerSplitColor: 'transparent', borderColor: '#F1F1F5', rowHoverBg: '#F7F8FB', cellPaddingBlock: 8, cellPaddingInline: 14, fontSize: 13.5 },
        Button: { primaryShadow: 'none', defaultShadow: 'none', fontWeight: 500, controlHeight: 32, paddingInline: 15 },
        Input: { activeShadow: '0 0 0 3px rgba(79,70,229,0.10)' },
        Segmented: { itemSelectedBg: '#fff', trackBg: '#F1F1F4', itemSelectedColor: '#17171C', itemColor: '#5B5D6B' },
        Tabs: { inkBarColor: ACCENT, itemSelectedColor: ACCENT, itemColor: '#8A8C99' },
        Card: { borderRadiusLG: 8 },
      },
    },
  }, React.createElement(AntApp, null, React.createElement(Root)));
}
export default App;
