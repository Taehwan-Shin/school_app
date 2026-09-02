import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockMutateAsync = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;

vi.mock('../src/api/groupsMembersUpdate.js', () => ({
  useUpdateMemberRole: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    error: mockError,
  }),
}));

import { EditMemberRoleDialog } from '../src/routes/admin/EditMemberRoleDialog.js';

describe('EditMemberRoleDialog component', () => {
  const groupEmail = 'group-a@cam.hs.kr';
  const memberEmail = 'user1@cam.hs.kr';

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
  });

  it('scenario 1: does not render dialog content when open is false', () => {
    render(
      <EditMemberRoleDialog
        open={false}
        onOpenChange={vi.fn()}
        groupEmail={groupEmail}
        memberEmail={memberEmail}
        currentRole="MEMBER"
      />
    );

    expect(screen.queryByTestId('edit-member-role-dialog')).toBeNull();
    expect(screen.queryByText('그룹 멤버 역할 변경')).toBeNull();
  });

  it('scenario 2: renders dialog with current role checked and submit button disabled when open is true', () => {
    render(
      <EditMemberRoleDialog
        open={true}
        onOpenChange={vi.fn()}
        groupEmail={groupEmail}
        memberEmail={memberEmail}
        currentRole="MEMBER"
      />
    );

    expect(screen.getByTestId('edit-member-role-dialog')).toBeDefined();
    expect(screen.getByText('그룹 멤버 역할 변경')).toBeDefined();
    expect(screen.getByText(groupEmail)).toBeDefined();
    expect(screen.getByText(memberEmail)).toBeDefined();

    const memberRadio = screen.getByTestId('edit-member-role-MEMBER') as HTMLInputElement;
    const managerRadio = screen.getByTestId('edit-member-role-MANAGER') as HTMLInputElement;
    const ownerRadio = screen.getByTestId('edit-member-role-OWNER') as HTMLInputElement;

    expect(memberRadio.checked).toBe(true);
    expect(managerRadio.checked).toBe(false);
    expect(ownerRadio.checked).toBe(false);

    const submitBtn = screen.getByTestId('edit-member-role-submit') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('scenario 3: enables submit button when a different role is selected', () => {
    render(
      <EditMemberRoleDialog
        open={true}
        onOpenChange={vi.fn()}
        groupEmail={groupEmail}
        memberEmail={memberEmail}
        currentRole="MEMBER"
      />
    );

    const submitBtn = screen.getByTestId('edit-member-role-submit') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    const managerRadio = screen.getByTestId('edit-member-role-MANAGER');
    fireEvent.click(managerRadio);

    expect(submitBtn.disabled).toBe(false);

    const memberRadio = screen.getByTestId('edit-member-role-MEMBER');
    fireEvent.click(memberRadio);
    expect(submitBtn.disabled).toBe(true);
  });

  it('scenario 4: calls mutation and onOpenChange(false) on submit', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      groupEmail,
      memberEmail,
      role: 'MANAGER',
    });
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    render(
      <EditMemberRoleDialog
        open={true}
        onOpenChange={onOpenChange}
        groupEmail={groupEmail}
        memberEmail={memberEmail}
        currentRole="MEMBER"
        onSuccess={onSuccess}
      />
    );

    fireEvent.click(screen.getByTestId('edit-member-role-MANAGER'));
    fireEvent.click(screen.getByTestId('edit-member-role-submit'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        groupEmail,
        memberEmail,
        role: 'MANAGER',
      });
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('scenario 5: displays error message when mutation fails', () => {
    mockError = new Error('permission-denied: requires admin role');

    render(
      <EditMemberRoleDialog
        open={true}
        onOpenChange={vi.fn()}
        groupEmail={groupEmail}
        memberEmail={memberEmail}
        currentRole="MEMBER"
      />
    );

    expect(screen.getByTestId('edit-member-role-error')).toBeDefined();
    expect(
      screen.getByText('역할 변경 권한이 없거나 스코프가 부족합니다.')
    ).toBeDefined();
  });
});
