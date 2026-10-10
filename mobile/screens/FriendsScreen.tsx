import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View, Image } from "react-native";
import { AppHeader } from "../components/MobileShell";
import { apiFetch } from "../lib/api";
import type { User } from "../types";
import { colors } from "../theme";


type FriendRequest = { id:string; sender:User; receiver?:User };
type FriendUser = User & { isFriend?: boolean; isFollowing?: boolean; friendRequestStatus?: string };

export default function FriendsScreen({ onMenu }: { onMenu: () => void }) {
  const [tab, setTab] = useState<"requests"|"sent"|"suggestions"|"all">("requests");
  const [received, setReceived] = useState<FriendRequest[]>([]);
  const [sent, setSent] = useState<FriendRequest[]>([]);
  const [suggestions, setSuggestions] = useState<FriendUser[]>([]);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [requests, friendData, people] = await Promise.all([
        apiFetch<{ received: FriendRequest[]; sent: FriendRequest[] }>("/api/friend-requests"),
        apiFetch<{ friends: FriendUser[] }>("/api/friends"),
        apiFetch<{ users: FriendUser[] }>("/api/users?take=20&suggestions=true"),
      ]);
      setReceived(requests.received ?? []);
      setSent(requests.sent ?? []);
      setFriends(friendData.friends ?? []);
      setSuggestions((people.users ?? []).filter((u) => !u.isFriend && !u.isFollowing && (u.friendRequestStatus ?? "NONE") === "NONE"));
    } catch (e) {
      Alert.alert("Friends", e instanceof Error ? e.message : "Unable to load friends.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const respond = async (id:string, status:"ACCEPTED"|"DECLINED") => {
    try { await apiFetch("/api/friend-requests/"+id,{method:"PATCH",body:JSON.stringify({status})}); await load(); }
    catch(e){ Alert.alert("Friends", e instanceof Error ? e.message : "Unable to update request."); }
  };
  const send = async (id:string) => {
    try { await apiFetch("/api/friend-requests",{method:"POST",body:JSON.stringify({receiverId:id})}); await load(); }
    catch(e){ Alert.alert("Friends", e instanceof Error ? e.message : "Unable to send request."); }
  };
  const remove = async (id:string) => {
    Alert.alert("Remove friend","Remove this person from your friends?",[{text:"Cancel",style:"cancel"},{text:"Remove",style:"destructive",onPress:async()=>{try{await apiFetch("/api/friends/"+id,{method:"DELETE"});await load();}catch(e){Alert.alert("Friends",e instanceof Error?e.message:"Unable to remove friend.");}}}]);
  };

  const people = tab==="requests" ? received.map(r=>r.sender) : tab==="sent" ? sent.map(r=>r.receiver).filter(Boolean) as FriendUser[] : tab==="suggestions" ? suggestions : friends;

  return <View style={styles.screen}>
    <AppHeader title="Friends" subtitle="Manage your circle." onMenu={onMenu}/>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.tabs}>{[
        ["requests","Requests",received.length],["sent","Sent",sent.length],["suggestions","Suggestions",suggestions.length],["all","All friends",friends.length],
      ].map(([key,label,count])=><Pressable key={String(key)} onPress={()=>setTab(key as typeof tab)} style={[styles.tab,tab===key&&styles.tabActive]}><Text style={[styles.tabText,tab===key&&styles.tabTextActive]}>{label} {String(count)}</Text></Pressable>)}</View>
      {loading ? <ActivityIndicator color={colors.accent} style={{marginTop:30}}/> : null}
      {!loading && !people.length ? <Text style={styles.empty}>{tab==="requests"?"No pending requests":tab==="sent"?"No sent requests":tab==="suggestions"?"No new suggestions":"No friends yet"}</Text> : null}
      {people.map((person:any)=><View key={person.id} style={styles.card}>
        {person.image ? <Image source={{uri:person.image}} style={styles.avatar}/> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{person.name?.[0]?.toUpperCase()||"S"}</Text></View>}
        <View style={styles.flex}><Text style={styles.name}>{person.name}</Text><Text style={styles.handle}>@{person.username||"member"}</Text><Text numberOfLines={1} style={styles.bio}>{person.bio||"Socialhub member"}</Text></View>
        {tab==="requests" ? <View style={styles.actions}><Pressable onPress={()=>void respond(received.find(r=>r.sender.id===person.id)?.id||"","ACCEPTED")} style={styles.accept}><Text style={styles.buttonText}>Accept</Text></Pressable><Pressable onPress={()=>void respond(received.find(r=>r.sender.id===person.id)?.id||"","DECLINED")} style={styles.decline}><Text style={styles.declineText}>Decline</Text></Pressable></View> : tab==="sent" ? <Pressable onPress={()=>{const id=sent.find(r=>r.receiver?.id===person.id)?.id;if(id)void apiFetch("/api/friend-requests/"+id,{method:"DELETE"}).then(load)}} style={styles.decline}><Text style={styles.declineText}>Cancel</Text></Pressable> : tab==="suggestions" ? <Pressable onPress={()=>void send(person.id)} style={styles.accept}><Text style={styles.buttonText}>Add</Text></Pressable> : <Pressable onPress={()=>void remove(person.id)} style={styles.decline}><Text style={styles.declineText}>Remove</Text></Pressable>}
      </View>)}
    </ScrollView>
  </View>;
}

const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:colors.bg},content:{padding:14,paddingBottom:150},tabs:{flexDirection:"row",gap:7,marginBottom:14,flexWrap:"wrap"},tab:{paddingHorizontal:11,paddingVertical:10,borderRadius:14,backgroundColor:colors.panel},tabActive:{backgroundColor:"#251f55",borderWidth:1,borderColor:colors.accent},tabText:{color:colors.muted,fontSize:11,fontWeight:"800"},tabTextActive:{color:colors.text},card:{flexDirection:"row",alignItems:"center",backgroundColor:colors.panel,borderWidth:1,borderColor:colors.border,borderRadius:17,padding:12,marginBottom:10},avatar:{width:48,height:48,borderRadius:24,marginRight:11},avatarFallback:{width:48,height:48,borderRadius:24,backgroundColor:colors.panel2,alignItems:"center",justifyContent:"center",marginRight:11},avatarText:{color:colors.text,fontWeight:"900"},flex:{flex:1,minWidth:0},name:{color:colors.text,fontWeight:"900",fontSize:14},handle:{color:colors.muted,fontSize:11,marginTop:3},bio:{color:colors.muted,fontSize:11,marginTop:4},actions:{gap:6},accept:{backgroundColor:colors.accent,paddingHorizontal:11,paddingVertical:9,borderRadius:11},buttonText:{color:"#fff",fontWeight:"900",fontSize:11},decline:{backgroundColor:colors.panel2,borderWidth:1,borderColor:colors.border,paddingHorizontal:10,paddingVertical:9,borderRadius:11},declineText:{color:colors.muted,fontWeight:"800",fontSize:11},empty:{color:colors.muted,textAlign:"center",paddingVertical:60}
});
