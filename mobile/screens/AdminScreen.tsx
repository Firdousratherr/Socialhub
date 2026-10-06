import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader } from "../components/MobileShell";
import { apiFetch } from "../lib/api";

type Flag = { id: string; key: string; enabled: boolean; description?: string | null };
type Dashboard = {
  stats: Record<string, number>;
  recentUsers?: Array<{ id: string; name: string; username?: string | null; createdAt: string; isActive: boolean; role: string }>;
};

function count(value?: number) {
  return typeof value === "number" ? value.toLocaleString() : "0";
}

export default function AdminScreen({ onMenu }: { onMenu: () => void }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [adminSessionCount, setAdminSessionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      await apiFetch<{ allowed: boolean }>("/api/admin/mobile-owner");
      const [dash, controls] = await Promise.all([
        apiFetch<Dashboard>("/api/admin/dashboard"),
        apiFetch<{ flags: Flag[]; adminSessions?: unknown[] }>("/api/admin/control-center"),
      ]);
      setDashboard(dash);
      setFlags(controls.flags ?? []);
      setAdminSessionCount(controls.adminSessions?.length ?? 0);
    } catch (e) {
      Alert.alert("Admin", e instanceof Error ? e.message : "Admin access is unavailable for this account.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleFlag = (flag: Flag) => {
    const next = !flag.enabled;
    Alert.alert(
      "Change platform switch?",
      flag.key + " will be turned " + (next ? "on" : "off") + ". This writes an audited admin change on the server.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: next ? "Enable" : "Disable",
          style: next ? "default" : "destructive",
          onPress: async () => {
            try {
              await apiFetch("/api/admin/control-center", {
                method: "PATCH",
                body: JSON.stringify({ kind: "flag", key: flag.key, enabled: next, description: "Changed from Socialhub Android admin panel." }),
              });
              setFlags((items) => items.map((item) => item.id === flag.id ? { ...item, enabled: next } : item));
            } catch (e) {
              Alert.alert("Admin", e instanceof Error ? e.message : "Unable to update platform switch.");
            }
          },
        },
      ],
    );
  };

  const stats = dashboard?.stats ?? {};

  return (
    <View style={styles.screen}>
      <AppHeader title="Owner console" subtitle="Owner-only audited platform operations." onMenu={onMenu} action="↻" onAction={() => void load(true)} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#725cff" />}
      >
        {loading ? <ActivityIndicator color="#725cff" /> : null}
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Owner/admin controls only</Text>
          <Text style={styles.noticeBody}>
            This panel uses the same server-side permission checks as the web admin area. Every platform-switch change is logged.
            It does not provide covert access to a user's camera, microphone, screen, files, notifications, or other apps.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Live platform metrics</Text>
        <View style={styles.grid}>
          {[
            ["Users", stats.users],
            ["Active", stats.activeUsers],
            ["Posts", stats.posts],
            ["Messages", stats.messages],
            ["Stories", stats.stories],
            ["Reports", stats.pendingReports],
            ["Likes", stats.likes],
            ["Comments", stats.comments],
          ].map(([label, value]) => (
            <View key={String(label)} style={styles.statCard}>
              <Text style={styles.statValue}>{count(value as number)}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Admin sessions</Text>
          <Text style={styles.meta}>{adminSessionCount} active admin/moderator sessions currently visible to this permission scope.</Text>
        </View>

        <Text style={styles.sectionTitle}>Feature switches</Text>
        {flags.length ? flags.map((flag) => (
          <View key={flag.id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.copy}>
                <Text style={styles.cardTitle}>{flag.key}</Text>
                {flag.description ? <Text style={styles.meta}>{flag.description}</Text> : null}
              </View>
              <Pressable onPress={() => toggleFlag(flag)} style={[styles.switch, flag.enabled && styles.switchOn]}>
                <View style={[styles.knob, flag.enabled && styles.knobOn]} />
              </Pressable>
            </View>
            <Text style={[styles.state, flag.enabled ? styles.on : styles.off]}>{flag.enabled ? "ENABLED" : "DISABLED"}</Text>
          </View>
        )) : <Text style={styles.meta}>No feature switches are configured.</Text>}

        {dashboard?.recentUsers?.length ? (
          <>
            <Text style={styles.sectionTitle}>Recent users</Text>
            {dashboard.recentUsers.map((user) => (
              <View key={user.id} style={styles.card}>
                <Text style={styles.cardTitle}>{user.name}</Text>
                <Text style={styles.meta}>@{user.username ?? "socialhub"} · {user.role} · {user.isActive ? "active" : "inactive"}</Text>
              </View>
            ))}
          </>
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
  sectionTitle: { color: "#f8f8ff", fontSize: 18, fontWeight: "900", marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: { flexGrow: 1, flexBasis: "22%", minWidth: 90, padding: 13, borderRadius: 15, backgroundColor: "#111118", borderWidth: 1, borderColor: "#252531" },
  statValue: { color: "#f8f8ff", fontSize: 20, fontWeight: "900" },
  statLabel: { color: "#8d8d9b", fontSize: 11, marginTop: 4 },
  card: { padding: 14, borderRadius: 17, backgroundColor: "#111118", borderWidth: 1, borderColor: "#252531" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  copy: { flex: 1, minWidth: 0 },
  cardTitle: { color: "#f8f8ff", fontSize: 14, fontWeight: "900" },
  meta: { color: "#8d8d9b", fontSize: 12, lineHeight: 18, marginTop: 4 },
  state: { fontSize: 10, fontWeight: "900", marginTop: 9 },
  on: { color: "#69d79b" },
  off: { color: "#ff8b8b" },
  switch: { width: 54, height: 31, borderRadius: 16, padding: 3, justifyContent: "center", backgroundColor: "#2a2a35" },
  switchOn: { backgroundColor: "#725cff" },
  knob: { width: 25, height: 25, borderRadius: 13, backgroundColor: "#ddd" },
  knobOn: { alignSelf: "flex-end", backgroundColor: "#fff" },
});
