import { describe, it, expect } from "vitest";
import { GROUP_DESCRIPTION_MAX } from "../src/lib/groupLimits";

// v0.173: shared 상한 상수. v0.166 BulkUpdate + v0.173 Create/Edit dialog 모두 동일.
describe("groupLimits", () => {
  it("GROUP_DESCRIPTION_MAX = 4096 (Workspace Directory 규격)", () => {
    expect(GROUP_DESCRIPTION_MAX).toBe(4096);
  });
});
