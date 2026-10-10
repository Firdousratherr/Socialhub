import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader } from "../components/MobileShell";
import { apiFetch } from "../lib/api";
import type { Post } from "../types";
import { colors } from "../theme";


export default function SavedScreen({onMenu}:{onMenu:()=>void}){
 const [posts,setPosts]=useState<Post[]>([]);
 const [loading,setLoading]=useState(true);
 const load=useCallback(async()=>{try{const d=await apiFetch<{posts:Post[]}>("/api/saved?take=30");setPosts(d.posts||[]);}catch(e){Alert.alert("Saved",e instanceof Error?e.message:"Unable to load saved posts.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load()},[load]);
 const unsave=async(id:string)=>{try{await apiFetch("/api/posts/"+id+"/save",{method:"DELETE"});setPosts(p=>p.filter(x=>x.id!==id));}catch(e){Alert.alert("Saved",e instanceof Error?e.message:"Unable to remove saved post.");}};
 return <View style={styles.screen}><AppHeader title="Saved posts" subtitle="Keep posts you want to revisit." onMenu={onMenu}/><ScrollView contentContainerStyle={styles.content}>{loading?<ActivityIndicator color={colors.accent} style={{marginTop:40}}/>:null}{!loading&&!posts.length?<Text style={styles.empty}>No saved posts yet.</Text>:null}{posts.map(p=><View key={p.id} style={styles.card}>{p.mediaUrl?<Image source={{uri:p.mediaUrl}} style={styles.media} resizeMode="cover"/>:null}<Text style={styles.author}>{p.author.name}</Text><Text style={styles.handle}>@{p.author.username||"socialhub"}</Text>{p.content?<Text style={styles.text}>{p.content}</Text>:null}<View style={styles.row}><Text style={styles.count}>{p.displayCounts.likes} likes · {p.displayCounts.comments} comments · {p.displayCounts.shares} shares</Text><Pressable onPress={()=>void unsave(p.id)} style={styles.button}><Text style={styles.buttonText}>Remove</Text></Pressable></View></View>)}</ScrollView></View>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:colors.bg},content:{padding:14,paddingBottom:150},card:{backgroundColor:colors.panel,borderWidth:1,borderColor:colors.border,borderRadius:19,padding:14,marginBottom:12},media:{width:"100%",height:220,borderRadius:15,marginBottom:12,backgroundColor:colors.panel2},author:{color:colors.text,fontWeight:"900",fontSize:15},handle:{color:colors.muted,fontSize:11,marginTop:3},text:{color:colors.text,fontSize:15,lineHeight:22,marginTop:12},row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:14,paddingTop:12,borderTopWidth:1,borderTopColor:colors.border},count:{color:colors.muted,fontSize:11,flex:1},button:{backgroundColor:colors.panel2,borderWidth:1,borderColor:colors.border,borderRadius:11,paddingHorizontal:12,paddingVertical:9},buttonText:{color:colors.text,fontSize:11,fontWeight:"800"},empty:{color:colors.muted,textAlign:"center",paddingVertical:70}});
