import React from 'react';
import type { Role } from '@school-app/shared';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export interface AppShellProps {
  role?: Role | null;
  pageTitle: string;
  children: React.ReactNode;
}

export function AppShell({ role, pageTitle, children }: AppShellProps) {
  return (
    <div className="min-h-screen flex bg-canvas text-fg-primary">
      <Sidebar role={role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar pageTitle={pageTitle} />
        <main className="flex-1 p-6 md:p-8 lg:p-12 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
