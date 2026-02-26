import { StatusBar } from "expo-status-bar"
import { ActivityIndicator, AppState, AppStateStatus, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import React, { useEffect, useRef, useState } from "react"
import { signInAnon, subscribeToAuthState } from "./firebase/AuthRepository"
import { subscribeToMessages, sendMessage, Message } from "./firebase/MessageRepository"
import { saveDisplayName, loadDisplayName } from "./firebase/UserRepository"

const MAX_CHARS = 500
const COUNTER_THRESHOLD = 50 // show counter when within 50 chars of limit

type AuthState = "loading" | "ready" | "error"

// hasPendingWrites comes from Firestore metadata — true until server confirms the write
type OptimisticMessage = Message & { hasPendingWrites: boolean }

// Helpers
function formatTime(seconds: number): string {
  const date = new Date(seconds * 1000)
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function formatDateLabel(seconds: number): string {
  const date = new Date(seconds * 1000)
  const today = new Date()
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  if (isToday) return "Today"
  return date.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

function isSameDay(a: number, b: number): boolean {
  const da = new Date(a * 1000)
  const db = new Date(b * 1000)
  return (
    da.getDate() === db.getDate() &&
    da.getMonth() === db.getMonth() &&
    da.getFullYear() === db.getFullYear()
  )
}

// Subcomponents
function DateSeparator({ label }: { label: string }) {
  return (
    <View style={styles.dateSeparatorWrap}>
      <View style={styles.dateSeparatorLine} />
      <Text style={styles.dateSeparatorText}>{label}</Text>
      <View style={styles.dateSeparatorLine} />
    </View>
  )
}

function TickIcon({ hasPendingWrites }: { hasPendingWrites: boolean }) {
  return <Text style={styles.tick}>{hasPendingWrites ? "✓" : "✓✓"}</Text>
}

function MessageBubble({
  item,
  isMe,
}: {
  item: OptimisticMessage
  isMe: boolean
}) {
  return (
    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
      {!isMe && <Text style={styles.senderLabel}>{item.displayName}</Text>}
      <Text style={styles.messageText}>{item.text}</Text>
      <View style={styles.bubbleMeta}>
        {item.createdAt !== null && (
          <Text style={styles.timeLabel}>{formatTime(item.createdAt)}</Text>
        )}
        {isMe && <TickIcon hasPendingWrites={item.hasPendingWrites} />}
      </View>
    </View>
  )
}

function UsernameModal({
  visible,
  onConfirm,
}: {
  visible: boolean
  onConfirm: (name: string) => void
}) {
  const [name, setName] = useState("")

  return (
    <Modal visible={visible} transparent animationType='fade'>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Welcome 👋</Text>
          <Text style={styles.modalSubtitle}>
            Choose a display name to get started
          </Text>
          <TextInput
            style={styles.modalInput}
            placeholder='Your name...'
            value={name}
            onChangeText={setName}
            maxLength={30}
            autoFocus
            returnKeyType='done'
            onSubmitEditing={() => name.trim() && onConfirm(name.trim())}
          />
          <Pressable
            style={[
              styles.modalButton,
              !name.trim() && styles.modalButtonDisabled,
            ]}
            onPress={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim()}
          >
            <Text style={styles.modalButtonText}>Let's go</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

// Main App
export default function App(): React.ReactElement {
  const [authState, setAuthState] = useState<AuthState>("loading")
  const [uid, setUid] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [value, setValue] = useState<string>("")
  const [messages, setMessages] = useState<OptimisticMessage[]>([])
  const [error, setError] = useState<string | null>(null)

  const unsubscribeMessages = useRef<(() => void) | null>(null)

  // Anonymous auth
  useEffect(() => {
    const unsubscribeAuth = subscribeToAuthState((user) => {
      if (user) {
        setUid(user.uid)
        setAuthState("ready")
      } else {
        signInAnon().catch((err) => {
          console.error("Anonymous sign-in failed", err)
          setAuthState("error")
          setError(
            "Could not connect. Is Anonymous auth enabled in Firebase console?",
          )
        })
      }
    })
    return () => unsubscribeAuth()
  }, [])

  // Load display name once uid is available
  useEffect(() => {
    if (!uid) return
    loadDisplayName(uid).then((name) => {
      if (name) {
        setDisplayName(name)
      } else {
        setShowUsernameModal(true)
      }
    })
  }, [uid])

  // Start Firestore listener once auth + name are ready
  useEffect(() => {
    if (authState !== "ready" || !displayName) return

    unsubscribeMessages.current = startListening()

    const appStateSub = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") {
          unsubscribeMessages.current?.()
          unsubscribeMessages.current = startListening()
        } else {
          unsubscribeMessages.current?.()
          unsubscribeMessages.current = null
        }
      },
    )

    return () => {
      unsubscribeMessages.current?.()
      appStateSub.remove()
    }
  }, [authState, displayName])

  function startListening() {
    return subscribeToMessages(
      (snapshot) => {
        // Firestore fires onSnapshot twice per send:
        //   1. Immediately from local cache (hasPendingWrites: true) — single tick
        //   2. Once server confirms (hasPendingWrites: false) — double tick
        // No manual optimistic state needed — Firestore handles it.
        const msgs: OptimisticMessage[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          text: doc.data().text,
          senderId: doc.data().senderId ?? "unknown",
          displayName: doc.data().displayName ?? "Anonymous",
          createdAt: doc.data().createdAt?.seconds ?? null,
          hasPendingWrites: doc.metadata.hasPendingWrites,
        }))
        setMessages(msgs)
        setError(null)
      },
      (err) => {
        console.error("Firestore snapshot error", err)
        setError("Failed to load messages. Check your connection.")
      },
    )
  }

  const handleConfirmName = async (name: string) => {
    if (!uid) return
    try {
      await saveDisplayName(uid, name)
      setDisplayName(name)
      setShowUsernameModal(false)
    } catch (err) {
      console.error("Failed to save display name", err)
      setError("Could not save your name. Please try again.")
    }
  }

  const handleSend = async () => {
    if (!uid || !displayName || !value.trim() || value.length > MAX_CHARS)
      return
    const text = value.trim()
    setValue("")
    try {
      // addDoc writes to Firestore local cache immediately, triggering onSnapshot
      // with hasPendingWrites: true — the single tick appears instantly.
      // When the server confirms, onSnapshot fires again with hasPendingWrites: false
      // — the double tick appears. No manual optimistic state needed.
      await sendMessage(text, uid, displayName)
    } catch (err) {
      console.error("Failed to send message", err)
      setError("Failed to send message. Please try again.")
    }
  }

  // Build list items with date separators injected between days.
  // The FlatList is inverted, so index 0 is visually at the bottom.
  // Separators must be inserted BEFORE their message group in the array
  // so they appear ABOVE (visually below on screen) the older messages.
  const listItems: (
    | OptimisticMessage
    | { type: "separator"; label: string; key: string }
  )[] = []
  messages.forEach((msg, index) => {
    const next = messages[index + 1]
    const isDayBoundary =
      msg.createdAt !== null &&
      (!next ||
        next.createdAt === null ||
        !isSameDay(msg.createdAt, next.createdAt))

    listItems.push({ ...msg })

    if (isDayBoundary) {
      listItems.push({
        type: "separator",
        label: formatDateLabel(msg.createdAt!),
        key: `sep-${msg.createdAt}`,
      })
    }
  })

  const charsLeft = MAX_CHARS - value.length
  const showCounter = charsLeft <= COUNTER_THRESHOLD

  if (authState === "loading") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size='large' color='#25D366' />
        <Text style={styles.loadingText}>Connecting...</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <UsernameModal
        visible={showUsernameModal}
        onConfirm={handleConfirmName}
      />

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {messages.length === 0 && !showUsernameModal && displayName !== null ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No messages yet.{"\n"}Say hello 👋
          </Text>
        </View>
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item) => ("key" in item ? item.key : item.id)}
          renderItem={({ item }) => {
            if ("type" in item && item.type === "separator") {
              return <DateSeparator label={item.label} />
            }
            const msg = item as OptimisticMessage
            const isMe = msg.senderId === uid
            return <MessageBubble item={msg} isMe={isMe} />
          }}
          style={styles.list}
          inverted
        />
      )}

      <View style={styles.inputRow}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder='Type a message...'
            value={value}
            onChangeText={setValue}
            onSubmitEditing={handleSend}
            returnKeyType='send'
            maxLength={MAX_CHARS}
            multiline
          />
          {showCounter && (
            <Text style={[styles.counter, charsLeft <= 0 && styles.counterRed]}>
              {charsLeft}
            </Text>
          )}
        </View>
        <Pressable
          style={[
            styles.sendButton,
            (!value.trim() || charsLeft < 0) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!value.trim() || charsLeft < 0}
        >
          <Text style={styles.sendButtonText}>➤</Text>
        </Pressable>
      </View>

      <StatusBar style='auto' />
    </KeyboardAvoidingView>
  )
}

// Styles

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECE5DD",
  },
  loadingText: {
    marginTop: 12,
    color: "#555",
  },
  container: {
    flex: 1,
    backgroundColor: "#ECE5DD",
    marginVertical: 40,
  },
  list: {
    flex: 1,
    paddingHorizontal: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    color: "#888",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 26,
  },
  bubble: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
    marginVertical: 2,
    maxWidth: "75%",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  bubbleMe: {
    backgroundColor: "#DCF8C6",
    alignSelf: "flex-end",
  },
  bubbleThem: {
    backgroundColor: "#fff",
    alignSelf: "flex-start",
  },
  senderLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#075E54",
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    color: "#111",
  },
  bubbleMeta: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 2,
  },
  timeLabel: {
    fontSize: 11,
    color: "#888",
    marginRight: 3,
  },
  tick: {
    fontSize: 11,
    color: "#888",
  },
  dateSeparatorWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
    paddingHorizontal: 8,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ccc",
  },
  dateSeparatorText: {
    marginHorizontal: 8,
    fontSize: 12,
    color: "#888",
    backgroundColor: "#ECE5DD",
    paddingHorizontal: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "#F0F0F0",
  },
  inputWrap: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
  },
  counter: {
    fontSize: 12,
    color: "#888",
    marginLeft: 6,
    alignSelf: "flex-end",
    paddingBottom: 1,
  },
  counterRed: {
    color: "#cc0000",
    fontWeight: "700",
  },
  sendButton: {
    backgroundColor: "#25D366",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#aaa",
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 18,
  },
  errorBanner: {
    backgroundColor: "#ffe0e0",
    padding: 8,
    marginHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  errorText: {
    color: "#cc0000",
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "80%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
    color: "#111",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  modalInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: "#25D366",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
  },
  modalButtonDisabled: {
    backgroundColor: "#aaa",
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
})
