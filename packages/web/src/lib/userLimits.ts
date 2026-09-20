// Google Directory API User 리소스 이름 필드별 문자 상한.
// 참조: https://developers.google.com/admin-sdk/directory/reference/rest/v1/users#Name
// v0.178: familyName/givenName 각 60자 (Google 규격, 초과 시 400 invalid_argument).
export const USER_FAMILY_NAME_MAX = 60;
export const USER_GIVEN_NAME_MAX = 60;
