import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { AppHeader } from "../components/MobileShell";
import { apiFetch } from "../lib/api";

type Session = {
  id: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  isCurrent: boolean;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

export default function SecurityScreen({ onMenu }: { onMenu: () => void }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mediaStatus, setMediaStatus] = useState<string>("Checking…");
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionData, media] = await Promise.all([
        apiFetch<{ sessions: Session[] }>("/api/security/sessions"),
        ImagePicker.getMediaLibraryPermissionsAsync(),
      ]);
      setSessions(sessionData.sessions ?? []);
      setMediaStatus(media.granted ? "Allowed" : media.canAskAgain ? "Not granted" : "Blocked in Android settings");
    } catch (e) {
      Alert.alert("Security", e instanceof Error ? e.message : "Unable to load security information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const reviewMediaPermission = async () => {
    const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
    setMediaStatus(result.granted ? "Allowed" : result.canAskAgain ? "Not granted" : "Blocked in Android settings");
  };

  const revokeOtherSessions = () => {
    Alert.alert(
      "Sign out other devices",
      "This ends every other Socialhub web/app session for your account. Your current device stays signed in.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out others",
          style: "destructive",
          onPress: async () => {
            setRevoking(true);
            try {
              const result = await apiFetch<{ revoked: number }>("/api/security/sessions", {
                method: "DELETE",
                body: JSON.stringify({ allOther: true }),
              });
              Alert.alert("Security", String(result.revoked) + " other session" + (result.revoked === 1 ? "" : "s") + " revoked.");
              await load();
            } catch (e) {
              Alert.alert("Security", e instanceof Error ? e.message : "Unable to revoke sessions.");
            } finally {
              setRevoking(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="Security" subtitle="Account sessions and device permissions." onMenu={onMenu} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Privacy-first device controls</Text>
          <Text style={styles.noticeBody}>
            Socialhub does not silently capture your camera, microphone, screen, files, notifications, or activity in other apps.
            Any future support or screen-sharing flow must be visible and explicitly approved on the device.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>This device</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Android</Text>
          <Text style={styles.meta}>Platform: {Platform.OS}</Text>
          <Text style={styles.meta}>OS/API: {String(Platform.Version)}</Text>
          <Text style={styles.meta}>Media library access: {mediaStatus}</Text>
          <Pressable style={styles.button} onPress={() => void reviewMediaPermission()}>
            <Text style={styles.buttonText}>Review media permission</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Support sessions</Text>
          <Text style={styles.meta}>
            Remote support is consent-based. A support session must be started by you and remain visibly active with an explicit stop control.
          </Text>
          <Text style={styles.meta}>No hidden camera or microphone capture is available.</Text>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Signed-in sessions</Text>
          <Text style={styles.count}>{sessions.length}</Text>
        </View>

        {loading ? <ActivityIndicator color="#725cff" /> : null}
        {sessions.map((session) => (
          <View key={session.id} style={[styles.card, session.isCurrent && styles.currentCard]}>
            <View style={styles.sectionRow}>
              <Text style={styles.cardTitle}>{session.isCurrent ? "Current device" : "Other session"}</Text>
              {session.isCurrent ? <Text style={styles.current}>ACTIVE</Text> : null}
            </View>
            <Text style={styles.meta}>Last active: {formatDate(session.updatedAt)}</Text>
            <Text style={styles.meta}>Created: {formatDate(session.createdAt)}</Text>
            {session.ipAddress ? <Text style={styles.meta}>IP: {session.ipAddress}</Text> : null}
            {session.userAgent ? <Text numberOfLines={2} style={styles.meta}>{session.userAgent}</Text> : null}
          </View>
        ))}

        {sessions.filter((session) => !session.isCurrent).length ? (
          <Pressable style={styles.dangerButton} disabled={revoking} onPress={revokeOtherSessions}>
            <Text style={styles.dangerText}>{revoking ? "Revoking…" : "Sign out all other sessions"}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#08080c" },
  content: { padding: 16, paddingBottom: 140, gap: 12 },
  notice: { padding: 15, borderRadius: 18, backgroundColor: "#161126", borderWidth: 1, borderColor: "#352c68" },
  noticeTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  noticeBody: { color: "#aaa5bb", lineHeight: 19, marginTop: 7 },
  sectionTitle: { color: "#f8f8ff", fontSize: 18, fontWeight: "900" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  count: { color: "#9d91ff", fontWeight: "900" },
  card: { padding: 15, borderRadius: 18, backgroundColor: "#111118", borderWidth: 1, borderColor: "#252531" },
  currentCard: { borderColor: "#725cff" },
  cardTitle: { color: "#f8f8ff", fontWeight: "900", fontSize: 15 },
  meta: { color: "#8d8d9b", lineHeight: 18, marginTop: 5 },
  current: { color: "#69d79b", fontSize: 11, fontWeight: "900" },
  button: { alignSelf: "flex-start", marginTop: 12, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12, backgroundColor: "#725cff" },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  dangerButton: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#6d3238", backgroundColor: "#241115" },
  dangerText: { color: "#ff8b8b", fontWeight: "900" },
});
