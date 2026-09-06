import { google } from 'googleapis';

export interface ChatSpace {
  name: string;
  displayName?: string;
  spaceType?: string;
  spaceHistoryState?: string;
  externalUserAllowed?: boolean;
  createTime?: string;
}

export interface ChatSpacesListResponse {
  spaces?: ChatSpace[];
  nextPageToken?: string;
}

export interface ChatClient {
  spaces: {
    list: (params?: { pageSize?: number; pageToken?: string; filter?: string }) => Promise<{ data: ChatSpacesListResponse }>;
    create: (params: { requestBody: { displayName: string; spaceType: 'SPACE' } }) => Promise<{ data: ChatSpace }>;
    delete: (params: { name: string }) => Promise<{ data: {} }>;
  };
}

export function getChatClient(accessToken: string): ChatClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const chat = google.chat({ version: 'v1', auth });
  return chat as unknown as ChatClient;
}
