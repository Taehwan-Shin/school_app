import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, renderHook } from '@testing-library/react';

const mockSignIn = vi.fn();
vi.mock('../src/lib/auth', () => ({ refreshGoogleSession: (...a: unknown[]) => mockSignIn(...a) }));

import {
  GOOGLE_TOKEN_STALE_MS,
  isGoogleTokenStale,
  markGoogleTokenIssued,
  maybeNotifySessionExpired,
  notifyGoogleSessionExpired,
  useGoogleSessionExpired,
} from '../src/lib/googleSession';
import { SessionExpiredBanner } from '../src/components/shell/SessionExpiredBanner';

describe('googleSession (v0.326)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it('isGoogleTokenStale: 기록 없음 → false · 55분 이내 false · 초과 true', () => {
    expect(isGoogleTokenStale()).toBe(false);
    markGoogleTokenIssued(1_000_000);
    expect(isGoogleTokenStale(1_000_000 + GOOGLE_TOKEN_STALE_MS)).toBe(false);
    expect(isGoogleTokenStale(1_000_000 + GOOGLE_TOKEN_STALE_MS + 1)).toBe(true);
  });

  it('maybeNotifySessionExpired: 만료 계열 오류만 이벤트 발행', () => {
    const { result } = renderHook(() => useGoogleSessionExpired());
    act(() => maybeNotifySessionExpired('insufficient_scope:x'));
    expect(result.current.reason).toBeNull();
    act(() => maybeNotifySessionExpired('invalid_google_access_token'));
    expect(result.current.reason).toBe('invalid_google_access_token');
    act(() => result.current.clear());
    expect(result.current.reason).toBeNull();
  });

  it('useGoogleSessionExpired: 주기 검사로 stale 감지', () => {
    vi.useFakeTimers();
    markGoogleTokenIssued(Date.now() - GOOGLE_TOKEN_STALE_MS + 30_000);
    const { result } = renderHook(() => useGoogleSessionExpired(10_000));
    expect(result.current.reason).toBeNull();
    act(() => vi.advanceTimersByTime(40_000));
    expect(result.current.reason).toBe('stale');
  });

  it('SessionExpiredBanner: 평소 숨김 → 만료 이벤트 시 표시 → 다시 로그인 성공 시 사라짐', async () => {
    mockSignIn.mockResolvedValueOnce({});
    render(<SessionExpiredBanner />);
    expect(screen.queryByTestId('session-expired-banner')).toBeNull();
    act(() => notifyGoogleSessionExpired('missing_google_access_token'));
    expect(screen.getByTestId('session-expired-banner').textContent).toContain('이 탭에는');
    fireEvent.click(screen.getByTestId('session-expired-relogin'));
    await waitFor(() => expect(screen.queryByTestId('session-expired-banner')).toBeNull());
    expect(mockSignIn).toHaveBeenCalledTimes(1);
  });

  it('v0.329: 만료 원인은 재마운트 (라우트 전환) 후에도 유지 · 새 토큰 발급 시 제거', () => {
    const first = render(<SessionExpiredBanner />);
    act(() => notifyGoogleSessionExpired('missing_google_access_token'));
    first.unmount();
    const second = render(<SessionExpiredBanner />);
    expect(screen.getByTestId('session-expired-banner').textContent).toContain('이 탭에는');
    second.unmount();
    markGoogleTokenIssued();
    render(<SessionExpiredBanner />);
    expect(screen.queryByTestId('session-expired-banner')).toBeNull();
  });

  it('v0.329: 재인증이 다른 계정/토큰 없음으로 실패하면 배너 유지 (account_mismatch)', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('account_mismatch'));
    render(<SessionExpiredBanner />);
    act(() => notifyGoogleSessionExpired('invalid_google_access_token'));
    fireEvent.click(screen.getByTestId('session-expired-relogin'));
    await waitFor(() => expect(screen.getByTestId('session-expired-banner').textContent).toContain('account_mismatch'));
  });

  it('SessionExpiredBanner: 로그인 팝업 실패 → 배너 유지 + 오류 표시', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('popup_closed'));
    render(<SessionExpiredBanner />);
    act(() => notifyGoogleSessionExpired('invalid_google_access_token'));
    fireEvent.click(screen.getByTestId('session-expired-relogin'));
    await waitFor(() => expect(screen.getByTestId('session-expired-banner').textContent).toContain('popup_closed'));
  });
});
