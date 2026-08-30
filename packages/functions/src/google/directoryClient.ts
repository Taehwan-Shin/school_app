import { google } from 'googleapis';

export function getDirectoryClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.admin({ version: 'directory_v1', auth });
}
