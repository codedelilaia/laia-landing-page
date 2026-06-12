import { Fragment } from 'react';

interface TabNavProps {
  activeTab: string;
  onSelect: (tab: string) => void;
}

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'chat', label: 'Chat' },
  { id: 'agent', label: 'Agent config' },
  { id: 'history', label: 'Work history', separated: true },
];

export function TabNav({ activeTab, onSelect }: TabNavProps) {
  return (
    <nav className="tab-nav" aria-label="Laia sections">
      {tabs.map((tab) => (
        tab.separated ? (
          <Fragment key={tab.id}>
            <div className="tab-spacer" data-testid="tab-spacer" />
            <button
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`.trim()}
              onClick={() => onSelect(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          </Fragment>
        ) : (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`.trim()}
            onClick={() => onSelect(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        )
      ))}
    </nav>
  );
}
