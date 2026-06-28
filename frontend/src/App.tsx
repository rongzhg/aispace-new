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
import { AgentBuilder, AgentDetail, VersionDiff, MembersPanel, ChatPanel, Playground, SkillMarket, McpMarket, DeployPanel, EnvPanel, SessionConsole, pill, antMsg, setAntMsg } from "./components";

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
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
                <Input allowClear prefix={<SearchOutlined style={{ color: '#B6B6BE' }} />} placeholder="搜索 Agent 名称" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 280 }} />
                <Select value={sort} style={{ width: 150 }} onChange={setSort} options={[{ value: 'updated', label: '最近编辑' }, { value: 'name', label: '名称 A–Z' }]} />
                <div style={{ flex: 1 }} />
                <Text style={{ color: '#A6A8B4', fontSize: 12.5 }}>共 {visibleAgents.length} 个</Text>
              </div>
              {visibleAgents.length === 0
                ? <div style={{ border: '1px dashed #DEDEE3', borderRadius: 8, padding: '40px 0', background: '#FCFCFD' }}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search ? '没有匹配的 Agent' : '该空间还没有 Agent'}>{!search && <Button type="primary" icon={<PlusOutlined />} onClick={() => setView({ name: 'create' })}>创建 Agent</Button>}</Empty></div>
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
                                  {(() => { const s = svcMap[a.id];
                                    if (!s) return <span style={pill('#F1F1F4', '#A6A8B4')}>○ 已停止</span>;
                                    if (s.status === 'deploying') return <span style={pill('#FFF8E6', '#946C00')}>◌ 部署中</span>;
                                    if (s.status === 'failed') return <span style={pill('#FDECEC', '#C0392B')}>✕ 失败</span>;
                                    return <span style={pill('#E9F7EF', '#1E8449')}>● 运行中{s.location === 'cloud' ? '·云' : ''}</span>;
                                  })()}</>
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
          {nav === 'agent' && view.name === 'create' && <AgentBuilder mode="create" wsId={curWs} onCancel={() => setView({ name: 'list' })} onSave={saveNew} onCreate={data => saveNew(data, true)} onPublished={() => { if (API_ON) { loadAgents(curWs); loadServices(); } }} />}
          {nav === 'agent' && view.name === 'edit' && <AgentBuilder mode="edit" agent={view.agent} wsId={curWs} onCancel={() => setView({ name: 'list' })} onSave={data => saveEdit(view.agent, data)} onPublished={() => { if (API_ON) { loadAgents(curWs); loadServices(); } }} />}
          {nav === 'agent' && view.name === 'detail' && <AgentDetail agent={agents.find(a => a.id === view.agent.id) || view.agent} service={svcMap[view.agent.id] || null} onServiceChanged={() => { if (API_ON) loadServices(); }} onBack={() => setView({ name: 'list' })} onEdit={a => setView({ name: 'edit', agent: a })} onDiff={a => setView({ name: 'diff', agent: a })} />}
          {nav === 'agent' && view.name === 'diff' && <VersionDiff agent={agents.find(a => a.id === view.agent.id) || view.agent} onBack={() => setView({ name: 'detail', agent: view.agent })} />}
          {nav === 'chat' && <ChatPanel curWs={curWs} isAdmin={isPlatformAdmin} onChanged={() => { if (API_ON) { loadWorkspaces(); loadAgents(curWs); } }} />}
          {nav === 'deploy' && <DeployPanel agents={visibleAgents} services={services} onServiceChanged={() => { if (API_ON) { loadServices(); loadAgents(curWs); } }} />}
          {nav === 'playground' && <Playground agents={visibleAgents} />}
          {nav === 'session' && <SessionConsole me={'u0'} />}
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
export default App;
