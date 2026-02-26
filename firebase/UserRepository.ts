import { firestore } from "./Config"
import { doc, getDoc, setDoc } from "firebase/firestore"

const USERS = "users"

export async function saveDisplayName(
  uid: string,
  name: string,
): Promise<void> {
  const ref = doc(firestore, USERS, uid)
  await setDoc(ref, { displayName: name }, { merge: true })
}

export async function loadDisplayName(uid: string): Promise<string | null> {
  const ref = doc(firestore, USERS, uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data().displayName ?? null
}
