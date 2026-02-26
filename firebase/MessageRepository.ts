import { firestore, collection, addDoc, serverTimestamp, MESSAGES } from "./Config"
import { onSnapshot, query, orderBy, limit, Unsubscribe } from "firebase/firestore"

export type Message = {
  id: string
  text: string
  createdAt: number | null
}

const MESSAGE_LIMIT = 50

export function subscribeToMessages(
  onMessages: (messages: Message[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const colRef = collection(firestore, MESSAGES)
  const q = query(colRef, orderBy("createdAt", "desc"), limit(MESSAGE_LIMIT))

  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: Message[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        text: doc.data().text,
        createdAt: doc.data().createdAt?.seconds ?? null,
      }))
      onMessages(msgs)
    },
    onError
  )
}

// Sends a new message to Firestore
// Throws on failure. Caller is responsible for handling the error
export async function sendMessage(text: string): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return

  const colRef = collection(firestore, MESSAGES)
  await addDoc(colRef, {
    text: trimmed,
    createdAt: serverTimestamp(),
  })
}