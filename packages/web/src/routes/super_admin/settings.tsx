import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { BasicDataPanel } from '../admin/BasicDataPanel';
import { MessageTemplatesManager } from './MessageTemplatesManager';

// v0.334: 시스템 설정 (super_admin 전용 · bliss00 「다음 단계 진행」 2026-10-03).
// 흩어져 있던 학교 공통 설정을 한곳에: 메시지 문구 · 역할/권한 · 학년도 기초 데이터.
type Section = 'templates' | 'roles' | 'basic';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'templates', label: '메시지 문구' },
  { id: 'roles', label: '역할 · 권한' },
  { id: 'basic', label: '학년도 기초 데이터' },
];

export function SystemSettingsPage() {
  const { role } = useAuth();
  const [section, setSection] = useState<Section>('templates');

  return (
    <AppShell role={role} pageTitle="시스템 설정">
      <section className="bg-elevated p-8 border border-border-subtle space-y-6">
        <div className="flex gap-2 border-b border-border-subtle" role="tablist" aria-label="설정 항목">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={section === s.id}
              onClick={() => setSection(s.id)}
              data-testid={`settings-tab-${s.id}`}
              className={`px-4 py-2 text-small -mb-px border-b-2 ${
                section === s.id
                  ? 'border-fg-primary text-fg-primary font-semibold'
                  : 'border-transparent text-fg-secondary hover:text-fg-primary'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {section === 'templates' && <MessageTemplatesManager />}

        {section === 'roles' && (
          <div className="space-y-3 text-small text-fg-primary" data-testid="settings-roles">
            <p>
              역할별로 할 수 있는 일은{' '}
              <Link to="/super_admin/capabilities" className="underline" data-testid="settings-roles-matrix-link">
                역할 · 권한 매트릭스
              </Link>
              에서 볼 수 있어요.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-fg-secondary">
              <li>관리자 (admin): 계정 · 그룹 · 챗방 · 클래스룸 · 기초 데이터 · 메시지 발송</li>
              <li>교사 (teacher): 메시지 발송 · 본인 클래스룸</li>
              <li>
                역할 바꾸기: <Link to="/admin" className="underline">계정</Link> 화면에서 계정 체크 → 「선택 역할 변경」. 바뀐 역할은 그 사람이
                다시 로그인하면 적용돼요.
              </li>
            </ul>
          </div>
        )}

        {section === 'basic' && (
          <div data-testid="settings-basic">
            <BasicDataPanel />
          </div>
        )}
      </section>
    </AppShell>
  );
}
