import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

function createFirestoreInstance() {
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch (err) {
    console.warn('Persistent local cache tidak tersedia, beralih ke memory cache:', err);
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
        localCache: memoryLocalCache(),
      },
      firebaseConfig.firestoreDatabaseId
    );
  }
}

export const db = createFirestoreInstance();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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

export function getFirestoreErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code?: unknown }).code || '');
  }
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  if (lower.includes('missing or insufficient permissions') || lower.includes('permission-denied')) {
    return 'permission-denied';
  }
  if (lower.includes('unauthenticated')) {
    return 'unauthenticated';
  }
  if (lower.includes('client is offline') || lower.includes('unavailable')) {
    return 'unavailable';
  }
  if (lower.includes('failed-precondition')) {
    return 'failed-precondition';
  }
  if (lower.includes('not-found')) {
    return 'not-found';
  }
  return 'unknown';
}

export function isPermissionDeniedError(error: unknown): boolean {
  const code = getFirestoreErrorCode(error);
  return code === 'permission-denied' || code === 'unauthenticated';
}

export function getFriendlyFirestoreErrorMessage(error: unknown): string {
  const code = getFirestoreErrorCode(error);
  switch (code) {
    case 'permission-denied':
      return 'Akses ditolak: Anda tidak memiliki kewenangan untuk membaca atau mengubah data tersebut.';
    case 'unauthenticated':
      return 'Sesi login Anda tidak aktif. Silakan masuk kembali terlebih dahulu.';
    case 'unavailable':
      return 'Koneksi ke server database sedang terganggu atau offline. Periksa jaringan Anda lalu coba lagi.';
    case 'failed-precondition':
      return 'Operasi tidak dapat diproses karena kondisi data atau indeks database belum terpenuhi.';
    case 'not-found':
      return 'Data yang diminta tidak ditemukan atau sudah tidak tersedia.';
    case 'already-exists':
      return 'Data dengan identitas tersebut sudah terdaftar sebelumnya.';
    case 'resource-exhausted':
      return 'Batas permintaan server sementara tercapai. Silakan tunggu beberapa saat lalu coba lagi.';
    default:
      return 'Terjadi kendala saat memproses permintaan data. Silakan muat ulang atau coba beberapa saat lagi.';
  }
}

export function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const rawMessage = error instanceof Error ? error.message : String(error);
  return {
    error: rawMessage,
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
}

export function reportFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = reportFirestoreError(error, operationType, path);
  throw new Error(JSON.stringify(errInfo));
}

export async function getCurrentIdToken(forceRefresh = false): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Koneksi Firestore terputus atau konfigurasi Firebase belum valid.');
    }
  }
}

void testConnection();
