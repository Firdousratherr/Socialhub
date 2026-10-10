import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader } from "../components/MobileShell";
import { apiFetch } from "../lib/api";
import { colors } from "../theme";

type Flag = { id: string; key: string; enabled: boolean; description?: string | null };
type Dashboard = {
  stats: Record<string, number>;
  recentUsers?: Array<{ id: string; name: string; username?: string | null; createdAt: string; isActive: boolean; role: string }>;
  recentAudit?: Array<{ id: string; action: string; targetType?: string | null; targetId?: string | null; createdAt: string }>;
};
type RiskRow = { user: { id: string; name: string; username?: string | null; isActive: boolean; isVerified: boolean; role: string } | null; score: number; level: string; reports7d: number };
type Health = { database: string; latencyMs: number; configuration?: Record<string, boolean> };
type SecuritySession = {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  user: { id: string; name: string; username?: string | null; email: string; role: string; isActive: boolean };
};

function count(value?: number) {
  return typeof value === "number" ? value.toLocaleString() : "0";
}

export default function AdminScreen({ onMenu }: { onMenu: () => void }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [adminSessionCount, setAdminSessionCount] = useState(0);
  const [riskQueue, setRiskQueue] = useState<RiskRow[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [securitySessions, setSecuritySessions] = useState<SecuritySession[]>([]);
  const [revokingSession, setRevokingSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      await apiFetch<{ allowed: boolean }>("/api/admin/mobile-owner");
      const [dash, controls, riskResult, healthResult, sessionResult] = await Promise.all([
        apiFetch<Dashboard>("/api/admin/dashboard"),
        apiFetch<{ flags: Flag[]; adminSessions?: unknown[] }>("/api/admin/control-center"),
        apiFetch<{ risk: RiskRow[] }>("/api/admin/risk").catch(() => ({ risk: [] })),
        apiFetch<Health>("/api/admin/health").catch(() => null),
        apiFetch<{ sessions: SecuritySession[] }>("/api/admin/security/sessions").catch(() => ({ sessions: [] })),
      ]);
      setDashboard(dash);
      setFlags(controls.flags ?? []);
      setAdminSessionCount(controls.adminSessions?.length ?? 0);
      setRiskQueue(riskResult.risk ?? []);
      setHealth(healthResult);
      setSecuritySessions(sessionResult.sessions ?? []);
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
  const onlineWindow = 15 * 60 * 1000;
  const onlineSessions = securitySessions.filter((session) => Date.now() - new Date(session.updatedAt).getTime() <= onlineWindow);
  const uniqueSecurityUsers = new Set(securitySessions.map((session) => session.userId)).size;
  const revokeSession = (session: SecuritySession) => {
    Alert.alert(
      "Revoke session?",
      `This will sign out ${session.user.name} from that session. It does not access their camera, microphone, files, screen, calls, or other apps.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            setRevokingSession(session.id);
            try {
              await apiFetch("/api/admin/security/sessions", {
                method: "DELETE",
                body: JSON.stringify({ sessionId: session.id }),
              });
              setSecuritySessions((items) => items.filter((item) => item.id !== session.id));
            } catch (e) {
              Alert.alert("Security", e instanceof Error ? e.message : "Unable to revoke session.");
            } finally {
              setRevokingSession(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="Owner console" subtitle="Owner-only audited platform operations." onMenu={onMenu} action="↻" onAction={() => void load(true)} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
      >
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
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

        <Text style={styles.sectionTitle}>Device & Security Center</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Transparent session visibility</Text>
          <Text style={styles.meta}>Shows signed-in sessions reported by the server. “Online” means the session was updated within the last 15 minutes; it is not device surveillance.</Text>
          <View style={styles.grid}>
            {[
              ["Visible sessions", securitySessions.length],
              ["Recently active", onlineSessions.length],
              ["Users represented", uniqueSecurityUsers],
              ["Expiring soon", securitySessions.filter((session) => new Date(session.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000).length],
            ].map(([label, value]) => (
              <View key={String(label)} style={styles.statCard}>
                <Text style={styles.statValue}>{count(value as number)}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {securitySessions.slice(0, 12).map((session) => {
          const online = Date.now() - new Date(session.updatedAt).getTime() <= onlineWindow;
          return (
            <View key={session.id} style={styles.card}>
              <View style={styles.row}>
                <View style={styles.copy}>
                  <Text style={styles.cardTitle}>{session.user.name}</Text>
                  <Text style={styles.meta}>@{session.user.username ?? "member"} · {session.user.role} · {online ? "recently active" : "not recently active"}</Text>
                  <Text style={styles.meta}>Last activity: {new Date(session.updatedAt).toLocaleString()}</Text>
                  {session.ipAddress ? <Text style={styles.meta}>IP: {session.ipAddress}</Text> : null}
                  {session.userAgent ? <Text numberOfLines={2} style={styles.meta}>{session.userAgent}</Text> : null}
                </View>
                <Text style={[styles.state, online ? styles.on : styles.off]}>{online ? "ONLINE" : "IDLE"}</Text>
              </View>
              <Pressable disabled={revokingSession === session.id} onPress={() => revokeSession(session)} style={styles.revokeButton}>
                <Text style={styles.revokeText}>{revokingSession === session.id ? "Revoking…" : "Revoke session"}</Text>
              </Pressable>
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Safety & operations</Text>
        <View style={styles.grid}>
          {[
            ["Pending reports", stats.pendingReports],
            ["Verification queue", stats.pendingVerificationRequests],
            ["Risk queue", riskQueue.length],
            ["Admin sessions", adminSessionCount],
          ].map(([label, value]) => (
            <View key={String(label)} style={styles.statCard}>
              <Text style={styles.statValue}>{count(value as number)}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {riskQueue.slice(0, 5).map((item) => item.user ? (
          <View key={item.user.id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.copy}>
                <Text style={styles.cardTitle}>{item.user.name}</Text>
                <Text style={styles.meta}>@{item.user.username ?? "member"} · {item.reports7d} reports in 7 days</Text>
              </View>
              <Text style={[styles.riskBadge, item.level === "CRITICAL" ? styles.riskCritical : item.level === "HIGH" ? styles.riskHigh : styles.riskMedium]}>{item.level} · {item.score}</Text>
            </View>
          </View>
        ) : null)}

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.cardTitle}>System health</Text>
              <Text style={styles.meta}>{health ? `Database: ${health.database} · latency: ${health.latencyMs}ms` : "Health details unavailable for this permission scope."}</Text>
            </View>
            <Text style={[styles.state, health?.database === "healthy" ? styles.on : styles.off]}>{health?.database === "healthy" ? "HEALTHY" : "CHECK"}</Text>
          </View>
          {health?.configuration ? <Text style={styles.meta}>Configured: {Object.entries(health.configuration).filter(([, ok]) => ok).map(([key]) => key).join(", ") || "none"}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent admin audit</Text>
          {(dashboard?.recentAudit ?? []).slice(0, 6).map((event) => (
            <View key={event.id} style={styles.auditRow}>
              <Text style={styles.auditAction}>{event.action}</Text>
              <Text style={styles.meta}>{event.targetType ?? "PLATFORM"}{event.targetId ? ` · ${event.targetId}` : ""} · {new Date(event.createdAt).toLocaleString()}</Text>
            </View>
          ))}
          {!dashboard?.recentAudit?.length ? <Text style={styles.meta}>No recent admin audit events.</Text> : null}
        </View>

        <Pressable onPress={() => void Linking.openURL("https://socialhublive.vercel.app/admin")} style={styles.webAdminButton}>
          <Text style={styles.webAdminText}>Open full web admin workspace</Text>
        </Pressable>

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
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 140, gap: 12 },
  notice: { padding: 15, borderRadius: 18, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentSoft },
  noticeTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  noticeBody: { color: colors.muted, lineHeight: 19, marginTop: 7 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: { flexGrow: 1, flexBasis: "22%", minWidth: 90, padding: 13, borderRadius: 15, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 4 },
  card: { padding: 14, borderRadius: 17, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  copy: { flex: 1, minWidth: 0 },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  riskBadge: { fontSize: 10, fontWeight: "900", marginLeft: 8 },
  riskCritical: { color: "#ff7474" },
  riskHigh: { color: "#ffae63" },
  riskMedium: { color: "#e6cf66" },
  auditRow: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border },
  auditAction: { color: colors.text, fontSize: 12, fontWeight: "800" },
  webAdminButton: { minHeight: 50, borderRadius: 16, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginTop: 2 },
  webAdminText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  state: { fontSize: 10, fontWeight: "900", marginTop: 9 },
  on: { color: colors.success },
  off: { color: "#ff8b8b" },
  switch: { width: 54, height: 31, borderRadius: 16, padding: 3, justifyContent: "center", backgroundColor: colors.panel2 },
  switchOn: { backgroundColor: colors.accent },
  revokeButton: { minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: #FECACA, backgroundColor: #FEF2F2, alignItems: "center", justifyContent: "center", marginTop: 10 },
  revokeText: { color: "#ff9b9b", fontSize: 12, fontWeight: "900" },
  knob: { width: 25, height: 25, borderRadius: 13, backgroundColor: "#ddd" },
  knobOn: { alignSelf: "flex-end", backgroundColor: "#fff" },
});
