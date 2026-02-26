import { StatusBar } from "expo-status-bar"
import { Button, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native"
import React, { useEffect, useState } from "react"
import { AppState, AppStateStatus } from "react-native"
import { subscribeToMessages, sendMessage, Message } from "./firebase/MessageRepository"

export default function App(): React.ReactElement {
  const [value, setValue] = useState<string>("")
  const [messages, setMessages] = useState<Message[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let unsubscribe = startListening()

    // Unsubscribe when app goes to background, resubscribe on foreground
    // This reduces bandwidth when the user isn't actively using the app
    const appStateSub = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") {
          unsubscribe = startListening()
        } else {
          unsubscribe()
        }
      },
    )

    return () => {
      unsubscribe()
      appStateSub.remove()
    }
  }, [])

  function startListening() {
    return subscribeToMessages(
      (msgs) => {
        setMessages(msgs)
        setError(null)
      },
      (err) => {
        console.error("Firestore snapshot error", err)
        setError("Failed to load messages. Check your connection.")
      },
    )
  }

  const handleSend = async () => {
    try {
      await sendMessage(value)
      setValue("")
      setError(null)
    } catch (err) {
      console.error("Failed to send message", err)
      setError("Failed to send message. Please try again.")
    }
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
        renderItem={({ item }) => (
          <View style={styles.bubble}>
            <Text>{item.text}</Text>
          </View>
        )}
        style={styles.list}
        inverted
      />

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder='Type here...'
          value={value}
          onChangeText={setValue}
          onSubmitEditing={handleSend}
          returnKeyType='send'
        />
        <Button title='Send' onPress={handleSend} />
      </View>

      <StatusBar style='auto' />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
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
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
    alignSelf: "flex-start",
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
