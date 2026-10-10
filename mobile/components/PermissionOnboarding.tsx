import React, { useEffect, useState } from "react";
import { Image, Modal, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { getDevicePermissionState, requestDevicePermission, type DevicePermissionState } from "../lib/device-permissions";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";

const BRAND_ICON = require("../assets/icon.png");
const permissionMeta: Array<{ key: keyof DevicePermissionState; title: string; body: string; icon: string }> = [
  { key: "photos", title: "Photos & videos", body: "Choose media for posts, stories, profile images and sharing.", icon: "▣" },
  { key: "camera", title: "Camera", body: "Take photos/videos and use the camera during video calls.", icon: "◉" },
  { key: "microphone", title: "Microphone", body: "Record audio and use your microphone during voice/video calls.", icon: "◌" },
  { key: "notifications", title: "Notifications", body: "Receive messages, call alerts and important Socialhub activity.", icon: "!" },
];

export default function PermissionOnboarding({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [permissions, setPermissions] = useState<DevicePermissionState>({ photos: false, camera: false, microphone: false, notifications: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    void getDevicePermissionState().then((next) => { if (active) setPermissions(next); }).catch(() => {});
    return () => { active = false; };
  }, [visible]);

  const requestOne = async (key: keyof DevicePermissionState) => {
    if (busy || permissions[key]) return;
    setBusy(true);
    try {
      await requestDevicePermission(key);
      setPermissions(await getDevicePermissionState());
    } catch {
      // Android owns the final permission decision; the settings page can retry.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="dark-content" backgroundColor=colors.bg />
        <View style={styles.scrim} />
        <View style={styles.card}>
          <Image source={BRAND_ICON} style={styles.logo} />
          <Text style={styles.eyebrow}>SOCIALHUB PERMISSIONS</Text>
          <Text style={styles.title}>Allow the features you want to use.</Text>
          <Text style={styles.body}>Android will show a separate system prompt for each sensitive permission. Socialhub never accesses the camera, microphone or other device data without the user's permission.</Text>
          <View style={styles.list}>
            {permissionMeta.map((item) => {
              const allowed = permissions[item.key];
              return <Pressable
                key={item.key}
                onPress={() => void requestOne(item.key)}
                disabled={busy || allowed}
                style={styles.permissionRow}
                accessibilityRole="button"
                accessibilityLabel={allowed ? item.title + " allowed" : "Allow " + item.title}
              >
                <View style={styles.permissionIcon}><Text style={styles.iconText}>{item.icon}</Text></View>
                <View style={styles.copy}><Text style={styles.permissionTitle}>{item.title}</Text><Text style={styles.permissionBody}>{item.body}</Text></View>
                <Text style={[styles.status, allowed ? styles.granted : styles.pending]}>{allowed ? "Allowed" : "Allow"}</Text>
              </Pressable>;
            })}
          </View>
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Files use Android's system picker</Text>
            <Text style={styles.noticeBody}>Socialhub does not request broad storage access. When a file feature is used, Android's picker lets you choose exactly what to share.</Text>
          </View>
          <Pressable disabled={busy} onPress={onDone} style={styles.primary}><Text style={styles.primaryText}>Continue</Text></Pressable>
          <Pressable disabled={busy} onPress={onDone} style={styles.secondary}><Text style={styles.secondaryText}>Skip for now</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.bg,justifyContent:"flex-end"},
  scrim:{...StyleSheet.absoluteFill,backgroundColor:"rgba(0,0,0,0.72)"},
  card:{margin:14,padding:18,borderRadius:28,backgroundColor:colors.panel,borderWidth:1,borderColor:"#2c2c39",maxHeight:"92%"},
  logo:{width:64,height:64,borderRadius:19,alignSelf:"center",marginBottom:12},
  eyebrow:{color:colors.accent,fontSize:10,fontWeight:"900",letterSpacing:1.3,textAlign:"center"},
  title:{color:colors.text,fontSize:24,lineHeight:29,fontWeight:"900",textAlign:"center",marginTop:6},
  body:{color:"#a6a6b3",fontSize:12,lineHeight:18,textAlign:"center",marginTop:9},
  list:{marginTop:12},
  permissionRow:{padding:10,borderRadius:15,backgroundColor:colors.panel2,borderWidth:1,borderColor:"#292936",flexDirection:"row",alignItems:"center",marginTop:7},
  permissionIcon:{width:38,height:38,borderRadius:12,backgroundColor:colors.accentSoft,alignItems:"center",justifyContent:"center"},
  iconText:{color:colors.accent,fontSize:18,fontWeight:"900"},
  copy:{flex:1,minWidth:0,marginLeft:10},
  permissionTitle:{color:colors.text,fontSize:12,fontWeight:"900"},
  permissionBody:{color:colors.muted,fontSize:10,lineHeight:14,marginTop:2},
  status:{fontSize:9,fontWeight:"900",marginLeft:7},
  granted:{color:colors.success},pending:{color:"#c1bdca"},
  notice:{marginTop:9,padding:11,borderRadius:15,backgroundColor:colors.accentSoft,borderWidth:1,borderColor:colors.accentSoft},
  noticeTitle:{color:colors.accent,fontSize:11,fontWeight:"900"},
  noticeBody:{color:"#9c98ad",fontSize:10,lineHeight:15,marginTop:3},
  primary:{minHeight:48,borderRadius:15,backgroundColor:colors.accent,alignItems:"center",justifyContent:"center",marginTop:11},
  primaryText:{color:"#fff",fontWeight:"900",fontSize:13},
  secondary:{minHeight:42,alignItems:"center",justifyContent:"center",marginTop:2},
  secondaryText:{color:colors.accent,fontWeight:"800",fontSize:12},
});
