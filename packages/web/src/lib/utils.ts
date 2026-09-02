import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge 는 기본적으로 표준 Tailwind 클래스만 인식한다.
// 우리 UI_SYSTEM 커스텀 토큰 (text-body/text-h1/text-accent-on-primary 등) 을
// 알려주지 않으면 `text-accent-on-primary` (color) 와 `text-body` (font-size) 를
// 같은 group 으로 오인해 하나를 삭제한다.
// 결과: Primary Button 이 검정 배경 + 검정 텍스트 (색 클래스 유실) 로 렌더됨.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      colors: [
        "canvas",
        "surface",
        "elevated",
        "fg-primary",
        "fg-secondary",
        "fg-muted",
        "border-subtle",
        "border-strong",
        "accent-primary",
        "accent-on-primary",
        "state-danger",
        "state-success",
        "state-warning",
      ],
    },
    classGroups: {
      "font-size": [
        { text: ["display", "h1", "h2", "h3", "body", "small", "micro"] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
