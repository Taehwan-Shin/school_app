// Google Admin SDK Directory OrgUnit 리소스 필드별 문자 상한.
// 참조: https://developers.google.com/admin-sdk/directory/reference/rest/v1/orgunits
// v0.185: name 100자 (Google 규격, 초과 시 400 invalid_argument). description 은
// 공개 명세에 상한 표기 없어 제외.
export const ORG_UNIT_NAME_MAX = 100;
