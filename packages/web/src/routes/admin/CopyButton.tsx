import { useState } from "react";

export interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  ["data-testid"]?: string;
}

// v0.171: 작은 inline 「복사」 버튼. 값 옆에 배치. 클릭 시 clipboard.writeText 호출.
// 성공 시 「복사됨 ✓」 로 잠깐 (2초) 문구 바뀌었다가 원복.
// clipboard API 미지원 (구 브라우저 · insecure context) 시 fallback = document.execCommand('copy').
export function CopyButton({
  value,
  label = "복사",
  className,
  ["data-testid"]: dataTestId,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    let ok = false;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        ok = true;
      } else if (typeof document !== "undefined") {
        // Fallback: 임시 textarea + execCommand('copy'). insecure origin 등에서만 필요.
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        try {
          ok = document.execCommand("copy");
        } finally {
          document.body.removeChild(ta);
        }
      }
    } catch {
      ok = false;
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid={dataTestId}
      aria-label={`${label}: ${value}`}
      className={
        className ??
        "ml-2 text-micro text-fg-secondary hover:text-fg-primary underline decoration-transparent hover:decoration-fg-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
      }
    >
      {copied ? "복사됨 ✓" : label}
    </button>
  );
}
