// v0.275: bulk 다이얼로그 running/done phase 「스크린 리더용 DialogHeader」
// shared component. 22 사이트 반복 markup 통합.
//
// - Dialog 는 접근성 위해 항상 Title/Description 을 요구하지만, running/done
//   phase 는 시각적으로 필요 없어 sr-only 로 감춘다.
// - shadcn/ui Dialog 는 DialogHeader/Title/Description 를 그대로 사용.

import { DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

export interface SrOnlyDialogHeaderProps {
  title: string;
  description: string;
}

export function SrOnlyDialogHeader({ title, description }: SrOnlyDialogHeaderProps) {
  return (
    <DialogHeader className="sr-only">
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>
  );
}
