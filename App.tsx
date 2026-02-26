import { StatusBar } from "expo-status-bar"
import { ActivityIndicator, AppState, AppStateStatus, Button, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native"
import React, { useEffect, useRef, useState } from "react"
import { signInAnon, subscribeToAuthState, formatSenderId } from "./firebase/AuthRepository"
import { subscribeToMessages, sendMessage, Message } from "./firebase/MessageRepository"

type AuthState = "loading" | "ready" | "error"

export default function App(): React.ReactElement {
  const [authState, setAuthState] = useState<AuthState>("loading")
  const [uid, setUid] = useState<string | null>(null)
  const [value, setValue] = useState<string>("")
  const [messages, setMessages] = useState<Message[]>([])
  const [error, setError] = useState<string | null>(null)

  // Keep a stable ref to the unsubscribe fn so AppState handler can call it
  const unsubscribeMessages = useRef<(() => void) | null>(null)

  useEffect(() => {
    const unsubscribeAuth = subscribeToAuthState((user) => {
      if (user) {
        setUid(user.uid)
        setAuthState("ready")
      } else {
        // Trigger anonymous sign-in
        signInAnon().catch((err) => {
          console.error("Anonymous sign-in failed", err)
          setAuthState("error")
          setError("Could not connect. Is Anonymous auth enabled in Firebase console?")
        })
      }
    })

    return () => unsubscribeAuth()
  }, [])

  useEffect(() => {
    if (authState !== "ready") return

    unsubscribeMessages.current = startListening()

    const appStateSub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        unsubscribeMessages.current = startListening()
      } else {
        unsubscribeMessages.current?.()
      }
    })

    return () => {
      unsubscribeMessages.current?.()
      appStateSub.remove()
    }
  }, [authState])

  function startListening() {
    return subscribeToMessages(
      (msgs) => {
        setMessages(msgs)
        setError(null)
      },
      (err) => {
        console.error("Firestore snapshot error", err)
        setError("Failed to load messages. Check your connection.")
      }
    )
  }

  const handleSend = async () => {
    if (!uid || !value.trim()) return
    try {
      await sendMessage(value, uid)
      setValue("")
      setError(null)
    } catch (err) {
      console.error("Failed to send message", err)
      setError("Failed to send message. Please try again.")
    }
  }

  // Loading screen while auth is resolving
  if (authState === "loading") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Connecting...</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isMe = item.senderId === uid
          const label = isMe ? "You" : formatSenderId(item.senderId)
          return (
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
              <Text style={styles.senderLabel}>{label}</Text>
              <Text>{item.text}</Text>
            </View>
          )
        }}
        style={styles.list}
        inverted
      />

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Type here..."
          value={value}
          onChangeText={setValue}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Button title="Send" onPress={handleSend} disabled={!value.trim()} />
      </View>

      <StatusBar style="auto" />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#888",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "flex-start",
    margin: 8,
    marginVertical: 40,
  },
  list: {
    width: "100%",
    marginBottom: 8,
  },
  bubble: {
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
    maxWidth: "75%",
  },
  bubbleMe: {
    backgroundColor: "#dcf8c6",
    alignSelf: "flex-end",
  },
  bubbleThem: {
    backgroundColor: "#f0f0f0",
    alignSelf: "flex-start",
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#555",
    marginBottom: 2,
  },
  form: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 8,
    marginRight: 8,
  },
  errorBanner: {
    width: "100%",
    backgroundColor: "#ffe0e0",
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  errorText: {
    color: "#cc0000",
    fontSize: 13,
  },
})
