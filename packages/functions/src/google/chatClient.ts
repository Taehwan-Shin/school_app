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

export interface ChatMember {
  name: string;
  member?: {
    name: string;
    type?: string;
    displayName?: string;
  };
  role?: string;
  state?: string;
  createTime?: string;
}

export interface ChatMembersListResponse {
  memberships?: ChatMember[];
  nextPageToken?: string;
}

export interface ChatClient {
  spaces: {
    list: (params?: { pageSize?: number; pageToken?: string; filter?: string }) => Promise<{ data: ChatSpacesListResponse }>;
    create: (params: { requestBody: { displayName: string; spaceType: 'SPACE' } }) => Promise<{ data: ChatSpace }>;
    delete: (params: { name: string }) => Promise<{ data: {} }>;
    members: {
      list: (params: { parent: string; pageSize?: number; pageToken?: string }) => Promise<{ data: ChatMembersListResponse }>;
      create: (params: {
        parent: string;
        requestBody: {
          member: { name: string; type: 'HUMAN' | 'BOT' };
        };
      }) => Promise<{ data: ChatMember }>;
      delete: (params: { name: string }) => Promise<{ data: {} }>;
    };
  };
}

export function getChatClient(accessToken: string): ChatClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const chat = google.chat({ version: 'v1', auth });
  return chat as unknown as ChatClient;
}
