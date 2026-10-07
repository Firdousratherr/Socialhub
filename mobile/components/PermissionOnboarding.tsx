import React, { useEffect, useState } from "react";
import { Image, Modal, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

const BRAND_ICON = require("../assets/icon.png");

export default function PermissionOnboarding({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone: () => void;
}) {
  const [status, setStatus] = useState<"undetermined" | "granted" | "denied">("undetermined");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    void ImagePicker.getMediaLibraryPermissionsAsync()
      .then((permission) => {
        if (active) setStatus(permission.status as "undetermined" | "granted" | "denied");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [visible]);

  const allowMedia = async () => {
    setBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setStatus(permission.status as "undetermined" | "granted" | "denied");
      onDone();
    } catch {
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#08080c" />
        <View style={styles.scrim} />
        <View style={styles.card}>
          <Image source={BRAND_ICON} style={styles.logo} />
          <Text style={styles.eyebrow}>PRIVACY & PERMISSIONS</Text>
          <Text style={styles.title}>Give Socialhub access only when you need it.</Text>
          <Text style={styles.body}>
            Socialhub uses device permissions only for features you choose. Photos and videos are used when you select media for posts, stories, or your profile.
          </Text>

          <View style={styles.permissionRow}>
            <View style={styles.permissionIcon}><Text style={styles.iconText}>▣</Text></View>
            <View style={styles.copy}>
              <Text style={styles.permissionTitle}>Photos & videos</Text>
              <Text style={styles.permissionBody}>
                {status === "granted" ? "Access is already allowed." : "Needed when you choose media from your device."}
              </Text>
            </View>
            <Text style={[styles.status, status === "granted" ? styles.granted : styles.pending]}>
              {status === "granted" ? "Allowed" : "Not set"}
            </Text>
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>No hidden device access</Text>
            <Text style={styles.noticeBody}>
              Camera, microphone, location, calls, notifications, files, and screen sharing are not accessed silently. Android will show its own permission prompt when a supported feature needs one.
            </Text>
          </View>

          <Pressable disabled={busy} onPress={() => void allowMedia()} style={styles.primary}>
            <Text style={styles.primaryText}>{busy ? "Requesting…" : "Allow photos & videos"}</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={onDone} style={styles.secondary}>
            <Text style={styles.secondaryText}>Not now</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#08080c", justifyContent: "flex-end" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)" },
  card: {
    margin: 14,
    padding: 20,
    borderRadius: 28,
    backgroundColor: "#111118",
    borderWidth: 1,
    borderColor: "#2c2c39",
  },
  logo: { width: 68, height: 68, borderRadius: 20, alignSelf: "center", marginBottom: 16 },
  eyebrow: { color: "#a99cff", fontSize: 10, fontWeight: "900", letterSpacing: 1.3, textAlign: "center" },
  title: { color: "#f8f8ff", fontSize: 25, lineHeight: 30, fontWeight: "900", textAlign: "center", marginTop: 7 },
  body: { color: "#a6a6b3", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 10 },
  permissionRow: { marginTop: 18, padding: 13, borderRadius: 17, backgroundColor: "#171720", borderWidth: 1, borderColor: "#292936", flexDirection: "row", alignItems: "center" },
  permissionIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#251f55", alignItems: "center", justifyContent: "center" },
  iconText: { color: "#b9afff", fontSize: 20, fontWeight: "900" },
  copy: { flex: 1, minWidth: 0, marginLeft: 11 },
  permissionTitle: { color: "#f8f8ff", fontSize: 13, fontWeight: "900" },
  permissionBody: { color: "#8d8d9b", fontSize: 11, lineHeight: 16, marginTop: 2 },
  status: { fontSize: 10, fontWeight: "900", marginLeft: 8 },
  granted: { color: "#69d79b" },
  pending: { color: "#c1bdca" },
  notice: { marginTop: 12, padding: 13, borderRadius: 16, backgroundColor: "#161126", borderWidth: 1, borderColor: "#352c68" },
  noticeTitle: { color: "#d1caff", fontSize: 12, fontWeight: "900" },
  noticeBody: { color: "#9c98ad", fontSize: 11, lineHeight: 17, marginTop: 4 },
  primary: { minHeight: 50, borderRadius: 15, backgroundColor: "#725cff", alignItems: "center", justifyContent: "center", marginTop: 14 },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  secondary: { minHeight: 45, alignItems: "center", justifyContent: "center", marginTop: 4 },
  secondaryText: { color: "#a99cff", fontWeight: "800", fontSize: 13 },
});
