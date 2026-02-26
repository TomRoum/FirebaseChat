import { initializeApp } from "firebase/app"
import { getFirestore, Firestore, collection, addDoc, serverTimestamp } from "firebase/firestore"
// @ts-ignore: getReactNativePersistence exists in the RN bundle but is missing from TS definitions
import { initializeAuth, getReactNativePersistence, Auth } from "firebase/auth"
import AsyncStorage from "@react-native-async-storage/async-storage"

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const firestore: Firestore = getFirestore(app)
// @ts-ignore: AsyncStorage satisfies the persistence interface at runtime
const auth: Auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
})
const MESSAGES: string = "messages"

export {
  firestore,
  auth,
  collection,
  addDoc,
  serverTimestamp,
  MESSAGES,
}