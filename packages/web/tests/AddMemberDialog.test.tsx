import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockMutateAsync = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;

vi.mock('../src/api/groupsMembersInsert.js', () => ({
  useAddMember: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    error: mockError,
  }),
}));

import { AddMemberDialog } from '../src/routes/admin/AddMemberDialog.js';

describe('AddMemberDialog component', () => {
  const groupEmail = 'group-a@cam.hs.kr';

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
  });

  it('renders dialog fields when open', () => {
    render(
      <AddMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        groupEmail={groupEmail}
      />
    );

    expect(screen.getByText('그룹 멤버 추가')).toBeDefined();
    expect(screen.getByTestId('add-member-email')).toBeDefined();
    expect(screen.getByTestId('add-member-role-MEMBER')).toBeDefined();
    expect(screen.getByTestId('add-member-role-MANAGER')).toBeDefined();
    expect(screen.getByTestId('add-member-role-OWNER')).toBeDefined();

    const memberRadio = screen.getByTestId('add-member-role-MEMBER') as HTMLInputElement;
    expect(memberRadio.checked).toBe(true);
    expect(screen.getByTestId('add-member-submit')).toBeDefined();
  });

  it('validates email requirement and domain match', async () => {
    render(
      <AddMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        groupEmail={groupEmail}
      />
    );

    // Empty email
    fireEvent.click(screen.getByTestId('add-member-submit'));
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId('add-member-error')).toBeDefined();
    expect(screen.getByText('멤버 이메일을 입력해주세요.')).toBeDefined();

    // Invalid domain
    fireEvent.change(screen.getByTestId('add-member-email'), {
      target: { value: 'user@other.com' },
    });
    fireEvent.click(screen.getByTestId('add-member-submit'));
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText('이메일은 @cam.hs.kr 도메인이어야 합니다.')).toBeDefined();
  });

  it('submits valid member data and triggers onSuccess on success', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      groupEmail,
      memberEmail: 'new-user@cam.hs.kr',
      role: 'MANAGER',
    });
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    render(
      <AddMemberDialog
        open={true}
        onOpenChange={onOpenChange}
        groupEmail={groupEmail}
        onSuccess={onSuccess}
      />
    );

    fireEvent.change(screen.getByTestId('add-member-email'), {
      target: { value: 'new-user@cam.hs.kr' },
    });
    fireEvent.click(screen.getByTestId('add-member-role-MANAGER'));
    fireEvent.click(screen.getByTestId('add-member-submit'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        groupEmail,
        memberEmail: 'new-user@cam.hs.kr',
        role: 'MANAGER',
      });
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('displays mapped 409 already member error message', () => {
    mockError = new Error('409: member_already_exists');

    render(
      <AddMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        groupEmail={groupEmail}
      />
    );

    expect(screen.getByTestId('add-member-error')).toBeDefined();
    expect(screen.getByText('이 사용자는 이미 그룹의 멤버입니다.')).toBeDefined();
  });

  it('displays mapped permission-denied error message', () => {
    mockError = new Error('permission-denied: requires admin role');

    render(
      <AddMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        groupEmail={groupEmail}
      />
    );

    expect(screen.getByTestId('add-member-error')).toBeDefined();
    expect(
      screen.getByText('멤버 추가 권한이 없거나 스코프가 부족합니다.')
    ).toBeDefined();
  });
});
