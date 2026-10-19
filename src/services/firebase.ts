import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  signInAnonymously,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: The app will break without passing firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Error handling types required by Firebase Integration Skill
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
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

// Connection test on boot as required by Firebase skill
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client appears offline or connecting.');
    }
    return false;
  }
}

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  } catch (error) {
    console.error('Failed to sign in with Google:', error);
    return null;
  }
}

export async function signInAsGuest(): Promise<FirebaseUser | null> {
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (error) {
    console.error('Guest login error:', error);
    return null;
  }
}

export async function logOut(): Promise<void> {
  await firebaseSignOut(auth);
}

// Cloud Career Save & Load
export interface CloudCareerData {
  uid: string;
  displayName: string;
  driverName?: string;
  email?: string;
  cashBalance: number;
  selectedTeamId?: string;
  selectedDriverId?: string;
  difficulty?: 'rookie' | 'pro' | 'legend';
  racesEntered?: number;
  wins?: number;
  podiums?: number;
  championshipPoints?: number;
  customTeamName?: string;
  createdAt?: any;
  updatedAt?: any;
}

export async function saveCareerToCloud(data: Partial<CloudCareerData>): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  const path = `users/${user.uid}`;
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const existingSnap = await getDoc(userDocRef);

    if (!existingSnap.exists()) {
      await setDoc(userDocRef, {
        uid: user.uid,
        displayName: data.displayName || user.displayName || 'Formula Driver',
        driverName: data.driverName || 'Driver',
        email: user.email || '',
        cashBalance: data.cashBalance ?? 15000000,
        selectedTeamId: data.selectedTeamId || 'redbull',
        selectedDriverId: data.selectedDriverId || 'max_verstappen',
        difficulty: data.difficulty || 'pro',
        racesEntered: data.racesEntered || 0,
        wins: data.wins || 0,
        podiums: data.podiums || 0,
        championshipPoints: data.championshipPoints || 0,
        customTeamName: data.customTeamName || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        userDocRef,
        {
          ...data,
          uid: user.uid,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function loadCareerFromCloud(): Promise<CloudCareerData | null> {
  const user = auth.currentUser;
  if (!user) return null;

  const path = `users/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      return snap.data() as CloudCareerData;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

// Global Hot Lap Leaderboards
export interface CloudLapRecord {
  id?: string;
  circuitId: string;
  userId: string;
  driverName: string;
  teamId?: string;
  lapTimeSeconds: number;
  lapTimeFormatted: string;
  carNumber?: number;
  createdAt?: any;
}

export async function recordCircuitLapTime(record: Omit<CloudLapRecord, 'userId' | 'createdAt'>): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const recordId = `${user.uid}_${Date.now()}`;
  const path = `leaderboards/${record.circuitId}/records/${recordId}`;
  try {
    await setDoc(doc(db, 'leaderboards', record.circuitId, 'records', recordId), {
      ...record,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Non-blocking leaderboard save
    console.warn('Leaderboard save error:', err);
  }
}

export async function getCircuitLeaderboard(circuitId: string, limitCount = 10): Promise<CloudLapRecord[]> {
  const path = `leaderboards/${circuitId}/records`;
  try {
    const colRef = collection(db, 'leaderboards', circuitId, 'records');
    const q = query(colRef, orderBy('lapTimeSeconds', 'asc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as CloudLapRecord) }));
  } catch (err) {
    console.warn('Leaderboard fetch fallback:', err);
    return [];
  }
}

// Run test connection silently on module load
if (typeof window !== 'undefined') {
  testConnection();
}
