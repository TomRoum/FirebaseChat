import { StatusBar } from "expo-status-bar"
import { Button, FlatList, StyleSheet, Text, TextInput, View } from "react-native"
import { firestore, collection, addDoc, serverTimestamp, MESSAGES } from "./firebase/Config"
import { onSnapshot, query, orderBy } from "firebase/firestore"
import React, { useEffect, useState } from "react"

type Message = {
  id: string
  text: string
  createdAt: number | null
}

export default function App(): React.ReactElement {
  const [value, setValue] = useState<string>("")
  const [messages, setMessages] = useState<Message[]>([])

  useEffect(() => {
    const colRef = collection(firestore, MESSAGES)
    const q = query(colRef, orderBy("createdAt", "asc"))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        text: doc.data().text,
        createdAt: doc.data().createdAt?.seconds ?? null,
      }))
      setMessages(msgs)
    })

    return () => unsubscribe()
  }, [])

  const handleSend = async () => {
    if (!value.trim()) return

    try {
      const colRef = collection(firestore, MESSAGES)
      await addDoc(colRef, {
        text: value,
        createdAt: serverTimestamp(),
      })
      setValue("")
    } catch (err) {
      console.error("Failed to save message", err)
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.bubble}>
            <Text>{item.text}</Text>
          </View>
        )}
        style={styles.list}
      />
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder='Type here...'
          value={value}
          onChangeText={setValue}
        />
        <Button title='Send' onPress={handleSend} />
      </View>
      <StatusBar style='auto' />
    </View>
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
})
