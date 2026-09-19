// Google Classroom courses 리소스 필드별 문자 상한.
// 참조: https://developers.google.com/classroom/reference/rest/v1/courses#Course
// v0.174: description. v0.175: name/section/room 추가.
export const COURSE_DESCRIPTION_MAX = 30000;
export const COURSE_NAME_MAX = 750;
export const COURSE_SECTION_MAX = 2800;
export const COURSE_ROOM_MAX = 650;
