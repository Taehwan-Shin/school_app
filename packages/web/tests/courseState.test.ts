import { describe, it, expect } from "vitest";
import {
  translateCourseState,
  courseStateOptionLabel,
} from "../src/lib/courseState";

// v0.170: v0.137 ClassroomTable 에서 정의됐던 helper 를 lib 로 승격 하고 3 dialog
// (CreateClassroom · CourseBulkCreate · ClassroomChatPairBulkCreate) select 에 재사용.
describe("courseState helpers", () => {
  it("translateCourseState: 5 known states → Korean", () => {
    expect(translateCourseState("ACTIVE")).toBe("활성");
    expect(translateCourseState("ARCHIVED")).toBe("보관됨");
    expect(translateCourseState("PROVISIONED")).toBe("준비 중");
    expect(translateCourseState("DECLINED")).toBe("거절됨");
    expect(translateCourseState("SUSPENDED")).toBe("일시중지");
  });

  it("translateCourseState: unknown / undefined → 원본 or '-'", () => {
    expect(translateCourseState("WHATEVER")).toBe("WHATEVER");
    expect(translateCourseState(undefined)).toBe("-");
    expect(translateCourseState("")).toBe("-");
  });

  it("courseStateOptionLabel: 「한글 (CODE)」 형태", () => {
    expect(courseStateOptionLabel("PROVISIONED")).toBe("준비 중 (PROVISIONED)");
    expect(courseStateOptionLabel("ACTIVE")).toBe("활성 (ACTIVE)");
    expect(courseStateOptionLabel("ARCHIVED")).toBe("보관됨 (ARCHIVED)");
  });
});
