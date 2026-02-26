import { firestore, collection, addDoc, serverTimestamp, MESSAGES } from "./Config"
import { onSnapshot, query, orderBy, limit, Unsubscribe } from "firebase/firestore"

export type Message = {
  id: string
  text: string
  senderId: string
  displayName: string
  createdAt: number | null
}

const MESSAGE_LIMIT = 50

export function subscribeToMessages(
  onSnapshot_: (snapshot: import("firebase/firestore").QuerySnapshot) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const colRef = collection(firestore, MESSAGES)
  const q = query(colRef, orderBy("createdAt", "desc"), limit(MESSAGE_LIMIT))
  return onSnapshot(q, { includeMetadataChanges: true }, onSnapshot_, onError)
}

export async function sendMessage(
  text: string,
  uid: string,
  displayName: string,
): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error("Message text cannot be empty")

  const colRef = collection(firestore, MESSAGES)
  const ref = await addDoc(colRef, {
    text: trimmed,
    senderId: uid,
    displayName,
    createdAt: serverTimestamp(),
  })
  return ref.id
}
