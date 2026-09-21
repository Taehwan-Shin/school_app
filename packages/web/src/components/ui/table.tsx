import * as React from "react";
import { cn } from "../../lib/utils";

// v0.208: outer wrapper 는 가로 스크롤만 (`overflow-x-auto`). 세로는 페이지 스크롤에
// 위임 → `<thead>` sticky top-0 이 뷰포트에서 동작하도록.
const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-x-auto">
    <table
      ref={ref}
      className={cn("w-full border border-border-subtle rounded-none text-small", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

// v0.208: sticky top header. 스크롤되는 outer 컨테이너 (`Table` wrapper 의 overflow-auto)
// 안에서 `thead` 를 상단 고정 → 긴 테이블에서 컬럼 헤더가 계속 보임.
// v0.210: sticky 상태 시각 강조 — border-b-2 (기존 TableHead border-b 위에 더 두꺼운 하단 경계)
//          + shadow-sm (스크롤로 내용이 헤더 아래로 지나갈 때 깊이감).
const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "bg-surface [&_tr]:border-b sticky top-0 z-10 border-b-2 border-border-subtle shadow-sm",
      className,
    )}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

// v0.213: `striped` opt-in prop → 짝수 body row 에 `bg-fg-primary/[0.02]` (2% overlay).
//          긴 목록에서 시선이 행을 따라가기 쉽게. hover (`hover:bg-fg-primary/[0.04]`, 4%) 는
//          그 위에 겹치므로 hover 감지에는 지장 없음. 기본값 false → 기존 테이블 무영향.
interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  striped?: boolean;
}
const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  TableBodyProps
>(({ className, striped = false, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn(
      "[&_tr:last-child]:border-0",
      striped && "[&_tr:nth-child(even)]:bg-fg-primary/[0.02]",
      className,
    )}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t border-border-subtle bg-surface font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

// v0.211: hover 색상 분리. 기존 `hover:bg-surface` 는 sticky thead `bg-surface` (v0.208) 와 같은 색상 →
//          hover 를 알아채기 힘듦. 4% fg-primary overlay 로 분리 (light 모드에서 #FFF 위에 살짝 어둡게,
//          dark 모드에서 #0A0A0A 위에 살짝 밝게 — 두 모드 모두 자연스러운 hover).
const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-border-subtle hover:bg-fg-primary/[0.04] transition-colors data-[state=selected]:bg-surface",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "text-micro uppercase tracking-wide text-fg-secondary px-4 py-3 border-b border-border-subtle text-left align-middle font-medium [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("px-4 py-3 text-body text-fg-primary align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-small text-fg-secondary", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};

