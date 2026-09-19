// v0.170: v0.137 ClassroomTable 에서 export 됐던 `translateCourseState` 를 lib 로 승격.
// CreateClassroomDialog · CourseBulkCreateDialog · ClassroomChatPairBulkCreateDialog
// 의 courseState select 도 이 helper 로 Korean 라벨 통일.
//
// Google Classroom REST v1 CourseState enum:
//   ACTIVE · ARCHIVED · PROVISIONED · DECLINED · SUSPENDED.
export type CourseStateCode =
  | "ACTIVE"
  | "ARCHIVED"
  | "PROVISIONED"
  | "DECLINED"
  | "SUSPENDED";

export function translateCourseState(s?: string): string {
  switch (s) {
    case "ACTIVE":
      return "활성";
    case "ARCHIVED":
      return "보관됨";
    case "PROVISIONED":
      return "준비 중";
    case "DECLINED":
      return "거절됨";
    case "SUSPENDED":
      return "일시중지";
    default:
      return s || "-";
  }
}

// Select option label 용: 「준비 중 (PROVISIONED)」 형태.
export function courseStateOptionLabel(code: CourseStateCode): string {
  return `${translateCourseState(code)} (${code})`;
}
