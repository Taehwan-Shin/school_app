// Google Directory API User 리소스 이름 필드별 문자 상한.
// 참조: https://developers.google.com/admin-sdk/directory/reference/rest/v1/users#Name
// v0.178: familyName/givenName 각 60자 (Google 규격, 초과 시 400 invalid_argument).
export const USER_FAMILY_NAME_MAX = 60;
export const USER_GIVEN_NAME_MAX = 60;

// v0.181: primaryEmail local-part 상한 (RFC 5321 · Google Workspace 규격).
// `<local>@cam.hs.kr` 형식에서 local 부분은 64자 이하. lib/emailInput.ts
// LOCAL_PART_RE 와 동일한 상한이며 여기서는 CreateUser 등 helper 미사용
// 코드 경로에서도 참조할 수 있게 shared 상수로 export.
export const USER_LOCAL_PART_MAX = 64;
