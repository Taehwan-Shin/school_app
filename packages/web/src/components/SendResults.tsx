import { Button } from './ui/button';
import { BulkDoneSummary } from './BulkDoneSummary';
import { BulkFailureList } from './BulkFailureList';
import { reauthorizeWithGoogle } from '../lib/auth';
import { isScopeError } from '../lib/messageTemplate';
import type { SendResult } from '../lib/useSequentialSend';

// v0.322: 메시지 발송 결과 요약 + 실패 목록 + (scope 부족 시) 재로그인 안내.

export function SendResults({ results, testId }: { results: SendResult[]; testId: string }) {
  const failures = results.filter((r) => !r.ok);
  const needsReauth = failures.some((f) => isScopeError(f.message));
  return (
    <div className="space-y-3" data-testid={testId}>
      <BulkDoneSummary
        successCount={results.length - failures.length}
        failureCount={failures.length}
        unit="건"
        label="발송 완료:"
      />
      <BulkFailureList
        items={failures}
        getKey={(f) => f.key}
        renderItem={(f) => (
          <>
            [{f.channel}] <span className="font-mono">{f.target}</span>: {f.message}
          </>
        )}
        testId={`${testId}-failures`}
      />
      {needsReauth && (
        <div className="space-y-1" data-testid={`${testId}-reauth-hint`}>
          <p className="text-small text-state-warning">
            로그인 토큰에 메시지 발송 권한이 없습니다. 재로그인 후 동의 화면에서 승인하면 발송할 수 있습니다.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              reauthorizeWithGoogle().catch((e) => console.warn('reauthorize failed', e));
            }}
          >
            Google 재로그인 (권한 재승인)
          </Button>
        </div>
      )}
    </div>
  );
}
