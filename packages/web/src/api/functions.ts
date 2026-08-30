import { httpsCallable, type HttpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

export function getCallable<Req, Res>(name: string): HttpsCallable<Req, Res> {
  return httpsCallable<Req, Res>(functions, name);
}
