import { auth } from "./Config"
import { signInAnonymously,onAuthStateChanged,User,Unsubscribe } from "firebase/auth"

export async function signInAnon(): Promise<string> {
  const credential = await signInAnonymously(auth)
  return credential.user.uid
}

export function subscribeToAuthState(
  onChange: (user: User | null) => void,
): Unsubscribe {
  return onAuthStateChanged(auth, onChange)
}

export function formatSenderId(uid: string): string {
  return `anon-${uid.slice(0, 4)}`
}
