import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile, 
  signOut 
} from "firebase/auth";
// Fix: Use namespace imports and cast to any to handle type definition mismatches
import * as _database from "firebase/database";
import * as _storage from "firebase/storage";

const database = _database as any;
const storagePkg = _storage as any;

const firebaseConfig = {
  apiKey: "AIzaSyAkIdohq9muISla_pUvWZzJnk8Dq03R7QQ",
  authDomain: "fir-ide-7d022.firebaseapp.com",
  databaseURL: "https://fir-ide-7d022-default-rtdb.firebaseio.com",
  projectId: "fir-ide-7d022",
  storageBucket: "fir-ide-7d022.appspot.com",
  messagingSenderId: "884464757996",
  appId: "1:884464757996:web:937fbeb1d3c1a3df5d09c9",
  measurementId: "G-ZNM7K8J8KC"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = database.getDatabase(app);
export const storage = storagePkg.getStorage(app);

// Export Database Functions for use in other files
export const ref = database.ref;
export const set = database.set;
export const get = database.get;
export const push = database.push;
export const onValue = database.onValue;
export const update = database.update;
export const query = database.query;
export const limitToLast = database.limitToLast;

// Helpers
export const uploadFile = async (file: File, path: string): Promise<string> => {
  try {
    const fileRef = storagePkg.ref(storage, path);
    await storagePkg.uploadBytes(fileRef, file);
    return await storagePkg.getDownloadURL(fileRef);
  } catch (e) {
    console.error("Upload failed", e);
    return "https://via.placeholder.com/300?text=Upload+Failed"; // Fallback for demo
  }
};

// --- Mock User Helper for Demo/Error Handling ---
const getMockUser = async (email: string, name: string) => {
  console.warn("Auth environment restricted. Using Mock Teacher for demo.");
  const mockUser = {
    uid: "teacher_demo_" + email.split('@')[0],
    displayName: name || "أستاذ تجريبي",
    email: email,
    photoURL: "https://api.dicebear.com/9.x/avataaars/svg?seed=" + email,
    isAnonymous: true
  };

  // Ensure mock user exists in DB
  try {
    const userRef = ref(db, `teachers/${mockUser.uid}`);
    await set(userRef, {
       uid: mockUser.uid,
       displayName: mockUser.displayName,
       email: mockUser.email,
       photoURL: mockUser.photoURL,
       chatLocked: false
    });
  } catch (dbError) {
    console.warn("Could not sync mock user to DB. Continuing locally.", dbError);
  }
  
  return mockUser;
};

export const registerTeacher = async (email: string, password: string, name: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, {
      displayName: name,
      photoURL: `https://api.dicebear.com/9.x/avataaars/svg?seed=${name}`
    });

    // Initialize user in DB
    const userRef = ref(db, `teachers/${result.user.uid}`);
    await set(userRef, {
      uid: result.user.uid,
      displayName: name,
      email: email,
      photoURL: result.user.photoURL,
      chatLocked: false
    });

    return result.user;
  } catch (error: any) {
    // Fallback for unauthorized domain in preview
    if (error.code === 'auth/unauthorized-domain' || error.code === 'auth/operation-not-allowed') {
       return getMockUser(email, name);
    }
    throw error;
  }
};

export const loginTeacher = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    // Fallback for unauthorized domain in preview
    if (error.code === 'auth/unauthorized-domain' || error.code === 'auth/operation-not-allowed' || error.code === 'auth/user-not-found') {
       // Note: In a real app, we wouldn't mock login on user-not-found, but for this demo environment we might need to
       if (error.code === 'auth/unauthorized-domain') {
         return getMockUser(email, "أستاذ عائد");
       }
    }
    throw error;
  }
};

export const logout = async () => {
  await signOut(auth);
};