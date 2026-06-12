import type { PropsWithChildren, ReactNode } from 'react';

interface LayoutProps extends PropsWithChildren {
  owner: string;
  headline: string;
  subheadline: string;
  actions?: ReactNode;
}

export function Layout({ owner, headline, subheadline, actions, children }: LayoutProps) {
  return (
    <div className="wrap">
      <div className="shell">
        <header className="masthead">
          <div className="brand-stack">
            <div>
              <div className="eyebrow">{owner}</div>
              <div className="title-row">
                <div className="brand-mark">Laia</div>
                <div className="headline">{headline}</div>
              </div>
              <p className="subheadline">{subheadline}</p>
            </div>
          </div>
          <div className="header-actions">{actions}</div>
        </header>
        {children}
      </div>
    </div>
  );
}
