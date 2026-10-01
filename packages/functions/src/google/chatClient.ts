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
    // v0.322: DM 찾기/생성 + 메시지 발송 (원본 메신저 스크립트 _sendChat 포팅).
    findDirectMessage: (params: { name: string }) => Promise<{ data: ChatSpace }>;
    setup: (params: {
      requestBody: {
        space: { spaceType: 'DIRECT_MESSAGE' };
        memberships: { member: { name: string; type: 'HUMAN' } }[];
      };
    }) => Promise<{ data: ChatSpace }>;
    messages: {
      create: (params: {
        parent: string;
        requestBody: { text: string };
      }) => Promise<{ data: { name?: string } }>;
    };
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
