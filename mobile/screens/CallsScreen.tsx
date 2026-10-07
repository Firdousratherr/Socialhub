import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { AppHeader } from "../components/MobileShell";
import { apiFetch } from "../lib/api";
import type { User } from "../types";

type CallItem = {
  id: string;
  type: "AUDIO" | "VIDEO";
  status: string;
  direction: "INCOMING" | "OUTGOING";
  createdAt: string;
  peer?: User;
};

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function CallsScreen({ onMenu }: { onMenu: () => void }) {
  const [items, setItems] = useState<CallItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ calls: CallItem[] }>("/api/calls?take=100");
      setItems(data.calls ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load().catch(() => setLoading(false)); }, [load]);

  return (
    <View style={styles.screen}>
      <AppHeader title="Calls" subtitle="Recent voice and video calls." onMenu={onMenu} action="Refresh" onAction={() => void load()} />
      {loading ? <ActivityIndicator color="#725cff" style={styles.loader} /> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.icon}><Text style={styles.iconText}>{item.type === "VIDEO" ? "▣" : "☎"}</Text></View>
            <View style={styles.copy}>
              <Text style={styles.name}>{item.peer?.name ?? "Socialhub member"}</Text>
              <Text style={styles.meta}>{item.direction === "INCOMING" ? "Incoming" : "Outgoing"} · {item.status.toLowerCase()} · {formatTime(item.createdAt)}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No calls yet.</Text> : null}
      />
    </View>
  );
}
const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#08080c"},
  loader:{marginVertical:20},
  list:{padding:12,paddingBottom:150},
  row:{flexDirection:"row",alignItems:"center",padding:14,marginBottom:10,borderRadius:18,backgroundColor:"#111118",borderWidth:1,borderColor:"#252531"},
  icon:{width:46,height:46,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"#251f55",marginRight:12},
  iconText:{color:"#fff",fontSize:20,fontWeight:"900"},
  copy:{flex:1},
  name:{color:"#f8f8ff",fontSize:15,fontWeight:"900"},
  meta:{color:"#8d8d9b",fontSize:11,marginTop:4},
  empty:{color:"#8d8d9b",textAlign:"center",paddingVertical:60},
});
