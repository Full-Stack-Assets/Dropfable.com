import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "onyx-harmony-493920-d3",
  appId: "1:419875740852:web:49b6f58ef5e7e32eff8be1",
  apiKey: "AIzaSyAFoUzKTd4JEj0oIYFoItbX-cyJbqIykN4",
  authDomain: "onyx-harmony-493920-d3.firebaseapp.com",
  storageBucket: "onyx-harmony-493920-d3.firebasestorage.app",
  messagingSenderId: "419875740852",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const db = getFirestore(app, "ai-studio-dropkit-85c3a74b-817c-4f1a-b79a-016cef8f88a2");

export const signInWithGoogle = async () => {
  try {
    const res = await signInWithPopup(auth, googleProvider);
    return res.user;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

export const logout = () => signOut(auth);
