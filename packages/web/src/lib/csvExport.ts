// v0.338: CSV 내보내기 공통 (UTF-8 BOM · 모든 셀 따옴표 · 엑셀 한글 호환).
// 기존 테이블별 인라인 구현과 같은 형식.
export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
