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

export interface ClassroomCoursesListResponse {
  courses?: ClassroomCourse[];
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
  };
}

export function getClassroomClient(accessToken: string): ClassroomClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const classroom = google.classroom({ version: 'v1', auth });
  return classroom as unknown as ClassroomClient;
}
