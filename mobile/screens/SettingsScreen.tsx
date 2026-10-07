import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { AppHeader } from "../components/MobileShell";
import { apiFetch } from "../lib/api";
import { authClient } from "../lib/auth-client";
import { registerPushDevice, unregisterPushDevice } from "../lib/push";
import type { Profile } from "../types";

const colors={bg:"#08080c",panel:"#111118",panel2:"#171720",border:"#252531",text:"#f8f8ff",muted:"#8d8d9b",accent:"#725cff",success:"#69d79b",danger:"#ff7474"};

export default function SettingsScreen({ onMenu, onSignedOut, isOwner, onOpenAdmin }:{onMenu:()=>void;onSignedOut:()=>void;isOwner:boolean;onOpenAdmin:()=>void}) {
 const [profile,setProfile]=useState<Profile|null>(null);
 const [form,setForm]=useState({name:"",username:"",bio:""});
 const [privateAccount,setPrivateAccount]=useState(false);
 const [privacy,setPrivacy]=useState({showFriendsList:true,showFollowersList:true,showFollowingList:true,allowMessagesEveryone:true,allowFriendRequests:true,showActiveStatus:true});
 const [preferences,setPreferences]=useState<Record<string,boolean>>({});
 const [editing,setEditing]=useState(false);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [pushEnabled,setPushEnabled]=useState(false);
 const [pushBusy,setPushBusy]=useState(false);

 const load=useCallback(async()=>{
  try{
   const [p,pr,prefs,devices]=await Promise.all([
    apiFetch<{profile:Profile}>("/api/profile"),
    apiFetch<{settings:any}>("/api/privacy-settings"),
    apiFetch<{preferences:Record<string,boolean>}>("/api/notification-preferences")
   ]);
   setProfile(p.profile);setForm({name:p.profile.name,username:p.profile.username||"",bio:p.profile.bio||""});
   setPrivateAccount(Boolean(p.profile.isPrivate));setPrivacy(pr.settings||privacy);setPreferences(prefs.preferences||{});setPushEnabled(Boolean(devices.devices?.some((device)=>device.enabled)));
  }catch(e){Alert.alert("Settings",e instanceof Error?e.message:"Unable to load settings.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load()},[load]);

 const setPush=async(v:boolean)=>{
  setPushBusy(true);
  try{
   if(v){
    const result=await registerPushDevice();
    if(!result.granted){Alert.alert("Notifications","Android notification permission was not granted.");return;}
    setPushEnabled(Boolean(result.registered));
   }else{
    await unregisterPushDevice();
    setPushEnabled(false);
   }
  }catch(e){Alert.alert("Notifications",e instanceof Error?e.message:"Unable to update device notifications.");}
  finally{setPushBusy(false);}
 };

 const saveProfile=async()=>{
  setBusy(true);
  try{const r=await apiFetch<{profile:Profile}>("/api/profile",{method:"PATCH",body:JSON.stringify({name:form.name.trim(),username:form.username.trim(),bio:form.bio.trim()})});setProfile(r.profile);setEditing(false);}
  catch(e){Alert.alert("Settings",e instanceof Error?e.message:"Unable to save profile.");}
  finally{setBusy(false);}
 };
 const setPrivate=async(v:boolean)=>{setPrivateAccount(v);try{await apiFetch("/api/privacy-settings",{method:"PATCH",body:JSON.stringify({isPrivate:v})});}catch(e){setPrivateAccount(!v);Alert.alert("Privacy",e instanceof Error?e.message:"Unable to update privacy.");}};
 const setPrivacyValue=async(key:string,v:boolean)=>{const old={...privacy};setPrivacy({...privacy,[key]:v});try{await apiFetch("/api/privacy-settings",{method:"PATCH",body:JSON.stringify({[key]:v})});}catch(e){setPrivacy(old);Alert.alert("Privacy",e instanceof Error?e.message:"Unable to update privacy.");}};
 const setPreference=async(key:string,v:boolean)=>{setPreferences({...preferences,[key]:v});try{await apiFetch("/api/notification-preferences",{method:"PATCH",body:JSON.stringify({[key]:v})});}catch(e){setPreferences({...preferences,[key]:!v});Alert.alert("Notifications",e instanceof Error?e.message:"Unable to update notification preference.");}};
 const signOut=async()=>{await authClient.signOut();onSignedOut();};

 if(loading)return <View style={styles.screen}><AppHeader title="Settings" subtitle="Account, privacy and security." onMenu={onMenu}/><ActivityIndicator color={colors.accent} style={{marginTop:40}}/></View>;

 return <View style={styles.screen}>
  <AppHeader title="Settings" subtitle="Account, privacy and security." onMenu={onMenu}/>
  <ScrollView contentContainerStyle={styles.content}>
   {profile?<View style={styles.card}>
    <Text style={styles.sectionLabel}>ACCOUNT</Text><Text style={styles.heading}>Your profile</Text>
    {editing?<><TextInput value={form.name} onChangeText={v=>setForm({...form,name:v})} placeholder="Name" placeholderTextColor={colors.muted} style={styles.input}/><TextInput value={form.username} onChangeText={v=>setForm({...form,username:v})} placeholder="Username" placeholderTextColor={colors.muted} autoCapitalize="none" style={styles.input}/><TextInput value={form.bio} onChangeText={v=>setForm({...form,bio:v})} placeholder="Bio" placeholderTextColor={colors.muted} multiline style={[styles.input,{minHeight:90,textAlignVertical:"top"}]}/><Pressable onPress={()=>void saveProfile()} disabled={busy} style={styles.primary}><Text style={styles.primaryText}>{busy?"Saving…":"Save changes"}</Text></Pressable></>:<><Text style={styles.value}>{profile.name}</Text><Text style={styles.muted}>@{profile.username||"member"}</Text><Text style={styles.muted}>{profile.bio||"No bio yet."}</Text><Pressable onPress={()=>setEditing(true)} style={styles.secondary}><Text style={styles.secondaryText}>Edit profile</Text></Pressable></>}
   </View>:null}
   <SettingCard title="Privacy & presence" subtitle="Control how other people can interact with you.">
    <Row label="Private account" description="Only approved followers can see your posts." value={privateAccount} onChange={setPrivate}/>
    <Row label="Show friends list" description="Allow people to open your friends list." value={privacy.showFriendsList} onChange={v=>void setPrivacyValue("showFriendsList",v)}/>
    <Row label="Show followers list" description="Allow people to see your followers." value={privacy.showFollowersList} onChange={v=>void setPrivacyValue("showFollowersList",v)}/>
    <Row label="Show following list" description="Allow people to see who you follow." value={privacy.showFollowingList} onChange={v=>void setPrivacyValue("showFollowingList",v)}/>
    <Row label="Messages from everyone" description="Allow new people to start conversations." value={privacy.allowMessagesEveryone} onChange={v=>void setPrivacyValue("allowMessagesEveryone",v)}/>
    <Row label="Friend requests" description="Allow people to send you friend requests." value={privacy.allowFriendRequests} onChange={v=>void setPrivacyValue("allowFriendRequests",v)}/>
    <Row label="Show active status" description="Let people see when you are active in Socialhub." value={privacy.showActiveStatus} onChange={v=>void setPrivacyValue("showActiveStatus",v)}/>
   </SettingCard>
   <SettingCard title="Notifications" subtitle="Choose which activity reaches your account.">
    <Row label="Push notifications on this device" description="Enable Android notifications for new messages, requests and Socialhub activity." value={pushEnabled} disabled={pushBusy} onChange={v=>void setPush(v)}/>
    {["likes","comments","follows","friendRequests","friendAccepted","messages","mentions","shares","storyReplies","storyReactions","system"].map(k=><Row key={k} label={k.replace(/[A-Z]/g,m=>" "+m).replace(/^./,m=>m.toUpperCase())} value={Boolean(preferences[k])} onChange={v=>void setPreference(k,v)}/>)}
   </SettingCard>
   {isOwner?<SettingCard title="Owner console" subtitle="This entry is visible only to the Socialhub owner account.">
    <View style={styles.notice}><Text style={styles.noticeTitle}>Private administration</Text><Text style={styles.muted}>The admin control center is removed from normal navigation and guarded by the server for the owner account.</Text></View>
    <Pressable onPress={onOpenAdmin} style={styles.primary}><Text style={styles.primaryText}>Open Owner Console</Text></Pressable>
   </SettingCard>:null}
   <SettingCard title="Security & privacy" subtitle="The Android app only requests device permissions when a feature needs them.">
    <View style={styles.notice}><Text style={styles.noticeTitle}>Consent-first device access</Text><Text style={styles.muted}>Camera, photos, microphone, location and screen sharing are never accessed silently. Android's permission UI and an explicit Socialhub consent flow are required before a supported feature can use them.</Text></View>
    <Text style={styles.sectionLabel}>DATA</Text><Text style={styles.muted}>Account export, active sessions, blocked/muted accounts and verification controls will stay aligned with the website security center.</Text>
   </SettingCard>
   <Pressable onPress={()=>void signOut()} style={styles.signOut}><Text style={styles.signOutText}>Sign out</Text></Pressable>
   <Text style={styles.version}>Socialhub Android · privacy-first native shell</Text>
  </ScrollView>
 </View>;
}

function SettingCard({title,subtitle,children}:{title:string;subtitle:string;children:React.ReactNode}){return <View style={styles.card}><Text style={styles.sectionLabel}>{title.toUpperCase()}</Text><Text style={styles.heading}>{title}</Text><Text style={styles.muted}>{subtitle}</Text><View style={styles.divider}/>{children}</View>}
function Row({label,description,value,onChange,disabled}:{label:string;description?:string;value:boolean;onChange:(v:boolean)=>void;disabled?:boolean}){return <View style={styles.row}><View style={styles.flex}><Text style={styles.rowLabel}>{label}</Text>{description?<Text style={styles.muted}>{description}</Text>:null}</View><Switch disabled={disabled} value={value} onValueChange={onChange} trackColor={{false:"#34343f",true:"#5f4fe4"}} thumbColor="#fff"/></View>}

const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:colors.bg},content:{padding:14,paddingBottom:150,gap:12},card:{backgroundColor:colors.panel,borderWidth:1,borderColor:colors.border,borderRadius:20,padding:16},sectionLabel:{color:"#a99cff",fontSize:10,fontWeight:"900",letterSpacing:1.2},heading:{color:colors.text,fontSize:19,fontWeight:"900",marginTop:4,marginBottom:4},value:{color:colors.text,fontSize:17,fontWeight:"800",marginTop:10},muted:{color:colors.muted,fontSize:12,lineHeight:18,marginTop:3},input:{backgroundColor:colors.panel2,borderWidth:1,borderColor:colors.border,color:colors.text,borderRadius:14,paddingHorizontal:14,paddingVertical:13,marginTop:10},primary:{backgroundColor:colors.accent,borderRadius:14,minHeight:48,alignItems:"center",justifyContent:"center",marginTop:10},primaryText:{color:"#fff",fontWeight:"900"},secondary:{backgroundColor:colors.panel2,borderWidth:1,borderColor:colors.border,borderRadius:13,minHeight:44,alignItems:"center",justifyContent:"center",marginTop:12},secondaryText:{color:colors.text,fontWeight:"800"},divider:{height:1,backgroundColor:colors.border,marginVertical:12},row:{flexDirection:"row",alignItems:"center",gap:12,paddingVertical:12,borderBottomWidth:1,borderBottomColor:colors.border},rowLabel:{color:colors.text,fontWeight:"800",fontSize:13},flex:{flex:1,minWidth:0},notice:{backgroundColor:"#18152a",borderWidth:1,borderColor:"#3a326d",borderRadius:16,padding:13,marginBottom:12},noticeTitle:{color:"#c8c0ff",fontWeight:"900",fontSize:13},signOut:{backgroundColor:colors.panel,borderWidth:1,borderColor:"#4b2b35",borderRadius:18,minHeight:52,alignItems:"center",justifyContent:"center"},signOutText:{color:colors.danger,fontWeight:"900"},version:{color:"#666674",textAlign:"center",fontSize:10,paddingBottom:20}
});
