// v0.173: Google Workspace Directory groups.description 상한 4096 chars.
// v0.166 BulkUpdateGroupDescriptionDialog 에서 이미 강제 · v0.173 부터 개별
// Create/Edit dialog 에도 대칭 적용 · shared constant 로 통일.
export const GROUP_DESCRIPTION_MAX = 4096;
// v0.180: Google Workspace Directory groups.name 상한 60 chars (초과 시 400).
// 참조: https://developers.google.com/admin-sdk/directory/reference/rest/v1/groups
export const GROUP_NAME_MAX = 60;
