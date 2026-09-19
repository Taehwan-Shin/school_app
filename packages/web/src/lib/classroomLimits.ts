// Google Classroom courses 리소스 필드별 문자 상한.
// 참조: https://developers.google.com/classroom/reference/rest/v1/courses#Course
// v0.174: description 부터 강제. 다른 필드는 후속 slice.
export const COURSE_DESCRIPTION_MAX = 30000;
