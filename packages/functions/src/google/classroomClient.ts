import { google } from 'googleapis';

export interface ClassroomCourse {
  id: string;
  name?: string;
  section?: string;
  descriptionHeading?: string;
  description?: string;
  room?: string;
  ownerId?: string;
  creationTime?: string;
  updateTime?: string;
  enrollmentCode?: string;
  courseState?: string;      // 'ACTIVE' · 'ARCHIVED' · 'PROVISIONED' · 'DECLINED' · 'SUSPENDED'
  alternateLink?: string;    // classroom.google.com 링크
  teacherGroupEmail?: string;
  courseGroupEmail?: string;
  guardiansEnabled?: boolean;
}

export interface ClassroomTeacher {
  courseId: string;
  userId: string;
  profile?: {
    id?: string;
    name?: { fullName?: string; givenName?: string; familyName?: string };
    emailAddress?: string;
    photoUrl?: string;
  };
}

export interface ClassroomStudent {
  courseId: string;
  userId: string;
  profile?: {
    id?: string;
    name?: { fullName?: string; givenName?: string; familyName?: string };
    emailAddress?: string;
    photoUrl?: string;
  };
}

export interface ClassroomCoursesListResponse {
  courses?: ClassroomCourse[];
  nextPageToken?: string;
}

export interface ClassroomTeachersListResponse {
  teachers?: ClassroomTeacher[];
  nextPageToken?: string;
}

export interface ClassroomStudentsListResponse {
  students?: ClassroomStudent[];
  nextPageToken?: string;
}

export interface ClassroomClient {
  courses: {
    list: (params?: {
      pageSize?: number;
      pageToken?: string;
      teacherId?: string;
      studentId?: string;
      courseStates?: string[];
    }) => Promise<{ data: ClassroomCoursesListResponse }>;
    patch: (params: {
      id: string;
      updateMask: string;
      requestBody: Partial<Pick<ClassroomCourse, 'courseState' | 'name' | 'section'>>;
    }) => Promise<{ data: ClassroomCourse }>;
    delete: (params: { id: string }) => Promise<{ data: {} }>;
    teachers: {
      list: (params: {
        courseId: string;
        pageSize?: number;
        pageToken?: string;
      }) => Promise<{ data: ClassroomTeachersListResponse }>;
      create: (params: {
        courseId: string;
        requestBody: { userId: string };
      }) => Promise<{ data: ClassroomTeacher }>;
      delete: (params: { courseId: string; userId: string }) => Promise<{ data: {} }>;
    };
    students: {
      list: (params: {
        courseId: string;
        pageSize?: number;
        pageToken?: string;
      }) => Promise<{ data: ClassroomStudentsListResponse }>;
      create: (params: {
        courseId: string;
        requestBody: { userId: string };
      }) => Promise<{ data: ClassroomStudent }>;
    };
  };
}

export function getClassroomClient(accessToken: string): ClassroomClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const classroom = google.classroom({ version: 'v1', auth });
  return classroom as unknown as ClassroomClient;
}
