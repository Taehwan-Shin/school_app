import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import { authenticateRequest, assertHasCap } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getDirectoryClient } from '../../google/directoryClient.js';

export interface UserItem {
  email: string;
  firstName: string;
  lastName: string;
  orgUnitPath: string;
  isAdmin: boolean;
  isSuspended: boolean;
}

export interface UsersListResponse {
  users: UserItem[];
}

export const usersList = onCall({ region: 'asia-northeast3' }, async (request): Promise<UsersListResponse> => {
  const user = await authenticateRequest(request);
  const rawRequestId = request.rawRequest?.headers?.['x-request-id'] ?? request.rawRequest?.headers?.['X-Request-Id'];
  const requestId = (Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId) ?? crypto.randomUUID();

  try {
    assertHasCap(user, 'users.read');
  } catch (err) {
    await writeAudit({
      actor: user.email,
      role: user.role,
      action: 'users.read',
      target: '*',
      request_id: requestId,
      result: 'denied',
      message: (err as Error).message,
    });
    throw err;
  }

  try {
    const directory = getDirectoryClient(user.googleAccessToken);
    const results: UserItem[] = [];
    let pageToken: string | undefined;

    do {
      const res = await directory.users.list({
        customer: 'my_customer',
        maxResults: 100,
        pageToken,
        orderBy: 'email',
      });
      results.push(
        ...(res.data.users ?? []).map((u) => ({
          email: u.primaryEmail ?? '',
          firstName: u.name?.givenName ?? '',
          lastName: u.name?.familyName ?? '',
          orgUnitPath: u.orgUnitPath ?? '',
          isAdmin: u.isAdmin ?? false,
          isSuspended: u.suspended ?? false,
        })),
      );
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    await writeAudit({
      actor: user.email,
      role: user.role,
      action: 'users.read',
      target: '*',
      request_id: requestId,
      result: 'ok',
      message: `listed ${results.length} users`,
    });

    return { users: results };
  } catch (err) {
    await writeAudit({
      actor: user.email,
      role: user.role,
      action: 'users.read',
      target: '*',
      request_id: requestId,
      result: 'error',
      message: (err as Error).message,
    });
    if (err instanceof HttpsError) {
      throw err;
    }
    throw new HttpsError('unknown', (err as Error).message);
  }
});
