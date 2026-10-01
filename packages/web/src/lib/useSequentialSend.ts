import { useCallback, useRef, useState } from 'react';

// v0.322: 메시지 발송 화면 공통 — 작업 목록을 순서대로 실행하며 진행률 · 결과를 모은다.
// 한 건 실패가 나머지를 막지 않는다 (bulk dialog 시리즈의 실패 격리 규약과 동일).

export interface SendJob {
  key: string;
  /** 결과 표에 보일 대상 (이메일 · 스페이스 이름). */
  target: string;
  /** 'Gmail' · '챗 DM' · '챗 스페이스' */
  channel: string;
  run: () => Promise<unknown>;
}

export interface SendResult {
  key: string;
  target: string;
  channel: string;
  ok: boolean;
  message?: string;
}

export function useSequentialSend(delayMs = 150) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const runningRef = useRef(false);

  const start = useCallback(
    async (jobs: SendJob[]) => {
      if (runningRef.current || jobs.length === 0) return;
      runningRef.current = true;
      setRunning(true);
      setProgress(0);
      setTotal(jobs.length);
      setResults(null);
      const out: SendResult[] = [];
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        try {
          await job.run();
          out.push({ key: job.key, target: job.target, channel: job.channel, ok: true });
        } catch (e) {
          out.push({
            key: job.key,
            target: job.target,
            channel: job.channel,
            ok: false,
            message: (e as Error).message,
          });
        }
        setProgress(i + 1);
        // 원본 스크립트의 Utilities.sleep(100~300) 대칭 — API rate 완화.
        if (delayMs > 0 && i < jobs.length - 1) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      setResults(out);
      setRunning(false);
      runningRef.current = false;
    },
    [delayMs],
  );

  const reset = useCallback(() => {
    if (runningRef.current) return;
    setProgress(0);
    setTotal(0);
    setResults(null);
  }, []);

  return { running, progress, total, results, start, reset };
}
