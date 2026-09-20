import { describe, it, expect } from "vitest";
import { GROUP_DESCRIPTION_MAX, GROUP_NAME_MAX } from "../src/lib/groupLimits";

// v0.173: shared 상한 상수. v0.166 BulkUpdate + v0.173 Create/Edit dialog 모두 동일.
// v0.180: GROUP_NAME_MAX 추가 (Workspace Directory groups.name 규격 60자).
describe("groupLimits", () => {
  it("GROUP_DESCRIPTION_MAX = 4096 (Workspace Directory 규격)", () => {
    expect(GROUP_DESCRIPTION_MAX).toBe(4096);
  });

  it("GROUP_NAME_MAX = 60 (Workspace Directory groups.name 규격)", () => {
    expect(GROUP_NAME_MAX).toBe(60);
  });
});
