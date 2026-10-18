import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { PunctualityLogEntry, sanitizeLogId } from './utils/punctuality';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Validate connection to Firestore on boot as required
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function signInWithGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged };
export type { User };

function clampStr(val: string | undefined, maxLen: number, fallback = '-'): string {
  const trimmed = (val || '').trim();
  if (!trimmed) return fallback.slice(0, maxLen);
  return trimmed.slice(0, maxLen);
}

/**
 * Sanitizes and syncs PunctualityLogEntry items to Firestore (`/punctualityLogs/{logId}`)
 * strictly adhering to the blueprint and security rules.
 */
export async function syncPunctualityLogsToFirestore(
  entries: PunctualityLogEntry[],
  maxBatchCount = 40
): Promise<number> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return 0;

  const ownerId = sanitizeLogId(user.uid);
  const slice = entries.slice(0, maxBatchCount);
  let synced = 0;

  for (const entry of slice) {
    const safeId = sanitizeLogId(`${ownerId}_${entry.id}`);
    const docPath = `punctualityLogs/${safeId}`;
    const docRef = doc(db, 'punctualityLogs', safeId);

    const status = ['ontime', 'delayed', 'early', 'cancelled'].includes(entry.status)
      ? entry.status
      : 'ontime';
    const delayMinutes = Math.max(-120, Math.min(600, Number(entry.delayMinutes) || 0));
    const isoYear = Math.max(2020, Math.min(2100, Number(entry.isoYear) || 2026));
    const isoWeek = Math.max(1, Math.min(53, Number(entry.isoWeek) || 1));
    const date = /^\d{4}-\d{2}-\d{2}$/.test(entry.date) ? entry.date : '2026-10-18';
    const yearMonth = /^\d{4}-\d{2}$/.test(entry.yearMonth) ? entry.yearMonth : '2026-10';
    const yearWeek = /^\d{4}-W\d{2}$/.test(entry.yearWeek) ? entry.yearWeek : '2026-W42';

    try {
      const existingSnap = await getDoc(docRef);
      if (!existingSnap.exists()) {
        try {
          await setDoc(docRef, {
            id: safeId,
            ownerId,
            timestamp: clampStr(entry.timestamp, 64, new Date().toISOString()),
            date,
            yearMonth,
            isoYear,
            isoWeek,
            yearWeek,
            stopId: clampStr(entry.stopId, 64, 'swk-halte-1'),
            stopCode: clampStr(entry.stopCode, 64, 'NL:S:16301010'),
            stopName: clampStr(entry.stopName, 120, 'Halte'),
            town: clampStr(entry.town, 80, 'Steenwijk'),
            line: clampStr(entry.line, 16, '26'),
            operator: clampStr(entry.operator, 64, 'RRReis'),
            destination: clampStr(entry.destination, 120, 'Steenwijk'),
            journeyId: clampStr(entry.journeyId, 80, 'RIT-1'),
            plannedTime: clampStr(entry.plannedTime, 16, '08:00'),
            actualTime: clampStr(entry.actualTime, 32, '08:00'),
            delayMinutes,
            status,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          synced++;
        } catch (writeErr) {
          handleFirestoreError(writeErr, OperationType.CREATE, docPath);
        }
      } else {
        const existingData = existingSnap.data();
        if (
          existingData.status !== status ||
          existingData.delayMinutes !== delayMinutes ||
          existingData.actualTime !== entry.actualTime
        ) {
          try {
            await updateDoc(docRef, {
              timestamp: clampStr(entry.timestamp, 64, new Date().toISOString()),
              actualTime: clampStr(entry.actualTime, 32, '08:00'),
              delayMinutes,
              status,
              updatedAt: serverTimestamp(),
            });
            synced++;
          } catch (updErr) {
            handleFirestoreError(updErr, OperationType.UPDATE, docPath);
          }
        }
      }
    } catch (getErr) {
      handleFirestoreError(getErr, OperationType.GET, docPath);
    }
  }

  return synced;
}

/**
 * Subscribes to the current user's punctualityLogs in Firestore using a scoped `where('ownerId', '==', uid)` query.
 */
export function subscribeUserPunctualityLogs(
  uid: string,
  onLogs: (logs: PunctualityLogEntry[]) => void
): Unsubscribe {
  const safeOwnerId = sanitizeLogId(uid);
  const q = query(collection(db, 'punctualityLogs'), where('ownerId', '==', safeOwnerId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: PunctualityLogEntry[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: String(d.id || docSnap.id),
          timestamp: String(d.timestamp || ''),
          date: String(d.date || ''),
          yearMonth: String(d.yearMonth || ''),
          isoYear: Number(d.isoYear || 2026),
          isoWeek: Number(d.isoWeek || 1),
          yearWeek: String(d.yearWeek || ''),
          stopId: String(d.stopId || ''),
          stopCode: String(d.stopCode || ''),
          stopName: String(d.stopName || ''),
          town: String(d.town || ''),
          line: String(d.line || ''),
          operator: String(d.operator || ''),
          destination: String(d.destination || ''),
          journeyId: String(d.journeyId || ''),
          plannedTime: String(d.plannedTime || ''),
          actualTime: String(d.actualTime || ''),
          delayMinutes: Number(d.delayMinutes || 0),
          status: (d.status as PunctualityLogEntry['status']) || 'ontime',
        });
      });
      onLogs(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'punctualityLogs');
    }
  );
}
