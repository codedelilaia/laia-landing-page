import { useEffect, useMemo, useState } from 'react';
import seedJson from '../dashboard.json';
import { fetchDashboardState, normaliseDashboardState } from './api/dashboard';
import { fetchChatSessions } from './api/chat';
import type { ChatRunStatusResponse, ChatSessionSummary, ChatThreadState, DashboardState } from './types/dashboard';
import { AgentConfigTab } from './components/AgentConfigTab';
import { ChatTab } from './components/ChatTab';
import { DashboardTab } from './components/DashboardTab';
import { HistoryTab } from './components/HistoryTab';
import { Layout } from './components/Layout';
import { TabNav } from './components/TabNav';
import './styles/dashboard.css';

export interface AppProps {
  initialDashboard?: DashboardState;
  initialSessions?: ChatSessionSummary[];
  initialThread?: ChatThreadState | null;
  initialRunStatuses?: Record<string, ChatRunStatusResponse>;
}

const seedDashboard = normaliseDashboardState(seedJson);

const defaultSessions: ChatSessionSummary[] = [];

export function App({
  initialDashboard = seedDashboard,
  initialSessions = defaultSessions,
  initialThread = null,
  initialRunStatuses = {},
}: AppProps) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [sessions, setSessions] = useState(initialSessions);
  const [thread, setThread] = useState<ChatThreadState | null>(initialThread);
  const [sessionsHydrated, setSessionsHydrated] = useState(initialSessions.length > 0);
  const [activeTab, setActiveTab] = useState('dashboard');

  const agentModules = useMemo(
    () => dashboard.modules.filter((module) => module.zone === 'agent-left' || module.zone === 'agent-right'),
    [dashboard.modules],
  );
  const historyModules = useMemo(() => dashboard.modules.filter((module) => module.zone === 'history'), [dashboard.modules]);

  useEffect(() => {
    if (initialDashboard !== seedDashboard) return;
    fetchDashboardState().then(setDashboard).catch(() => undefined);
  }, [initialDashboard]);

  useEffect(() => {
    if (initialSessions.length > 0) {
      setSessionsHydrated(true);
      return;
    }
    fetchChatSessions()
      .then((nextSessions) => setSessions(nextSessions))
      .catch(() => undefined)
      .finally(() => setSessionsHydrated(true));
  }, [initialSessions]);

  return (
    <Layout
      actions={<a className="logout-link" href="/cdn-cgi/access/logout">Sign out</a>}
      headline={dashboard.headline}
      owner={dashboard.owner}
      subheadline={dashboard.subheadline}
    >
      <div className="tab-shell">
        <TabNav activeTab={activeTab} onSelect={setActiveTab} />
        {activeTab === 'dashboard' ? <DashboardTab dashboard={dashboard} onDashboardChange={setDashboard} /> : null}
        {activeTab === 'chat' ? (
          <ChatTab
            initialRunStatuses={initialRunStatuses}
            sessions={sessions}
            sessionsHydrated={sessionsHydrated}
            setSessions={setSessions}
            setThread={setThread}
            thread={thread}
          />
        ) : null}
        {activeTab === 'agent' ? <AgentConfigTab modules={agentModules} /> : null}
        {activeTab === 'history' ? <HistoryTab modules={historyModules} /> : null}
      </div>
    </Layout>
  );
}
