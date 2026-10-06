import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { authClient } from "./lib/auth-client";
import { apiFetch } from "./lib/api";
import type { Post } from "./types";

type Tab = "Home" | "Discover" | "Messages" | "Notifications" | "Profile";

function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const signIn = async () => {
    setBusy(true);
    setError("");
    const result = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? "Unable to sign in.");
      return;
    }
    onSignedIn();
  };

  return (
    <SafeAreaView style={styles.auth}>
      <StatusBar style="light" />
      <View style={styles.logoCircle}><Text style={styles.logoText}>S</Text></View>
      <Text style={styles.brand}>SocialHub</Text>
      <Text style={styles.tagline}>Connect. Share. Discover.</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor="#777"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <TextInput
        secureTextEntry
        placeholder="Password"
        placeholderTextColor="#777"
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.primary} onPress={signIn} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Sign in</Text>}
      </Pressable>
      <Text style={styles.hint}>Use the same SocialHub account as the website.</Text>
    </SafeAreaView>
  );
}

function PostCard({ post }: { post: Post }) {
  return (
    <View style={styles.card}>
      <View style={styles.authorRow}>
        {post.author.image ? (
          <Image source={{ uri: post.author.image }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}><Text style={styles.avatarText}>{post.author.name?.[0] ?? "S"}</Text></View>
        )}
        <View>
          <Text style={styles.author}>{post.author.name}</Text>
          {post.author.username ? <Text style={styles.username}>@{post.author.username}</Text> : null}
        </View>
      </View>
      {post.content ? <Text style={styles.content}>{post.content}</Text> : null}
      {post.mediaUrl ? <Image source={{ uri: post.mediaUrl }} style={styles.media} resizeMode="cover" /> : null}
      <View style={styles.metrics}>
        <Text>♥ {formatCount(post.displayCounts.likes)}</Text>
        <Text>💬 {formatCount(post.displayCounts.comments)}</Text>
        <Text>↗ {formatCount(post.displayCounts.shares)}</Text>
      </View>
    </View>
  );
}

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ posts: Post[] }>("/api/posts?take=20&mode=FOR_YOU");
      setPosts(data.posts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load feed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>SocialHub</Text>
        <Pressable onPress={() => void load()}><Text style={styles.refresh}>↻</Text></Pressable>
      </View>
      {loading ? <ActivityIndicator style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={styles.feed}
        refreshing={loading}
        onRefresh={() => void load()}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No posts to show yet.</Text> : null}
      />
    </View>
  );
}

function Placeholder({ tab }: { tab: Tab }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderTitle}>{tab}</Text>
      <Text style={styles.placeholderText}>This native module is connected to SocialHub and ready for the next feature module.</Text>
    </View>
  );
}

export default function App() {
  const [signedIn, setSignedIn] = useState(false);
  const [tab, setTab] = useState<Tab>("Home");

  useEffect(() => {
    let mounted = true;
    authClient.getSession().then(({ data }) => {
      if (mounted) setSignedIn(Boolean(data?.user));
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  if (!signedIn) return <Login onSignedIn={() => setSignedIn(true)} />;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      {tab === "Home" ? <Home /> : <Placeholder tab={tab} />}
      <View style={styles.nav}>
        {(["Home", "Discover", "Messages", "Notifications", "Profile"] as Tab[]).map((item) => (
          <Pressable key={item} onPress={() => setTab(item)} style={styles.navItem}>
            <Text style={[styles.navIcon, tab === item && styles.navActive]}>{item === "Home" ? "⌂" : item === "Discover" ? "⌕" : item === "Messages" ? "✉" : item === "Notifications" ? "♡" : "◉"}</Text>
            <Text style={[styles.navLabel, tab === item && styles.navActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#09090d" },
  screen: { flex: 1, backgroundColor: "#09090d" },
  auth: { flex: 1, backgroundColor: "#09090d", justifyContent: "center", padding: 24 },
  logoCircle: { width: 72, height: 72, borderRadius: 22, backgroundColor: "#6d5dfc", alignSelf: "center", alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontSize: 42, fontWeight: "900" },
  brand: { color: "#fff", fontSize: 34, fontWeight: "800", textAlign: "center", marginTop: 18 },
  tagline: { color: "#999", textAlign: "center", marginBottom: 28, marginTop: 6 },
  input: { backgroundColor: "#15151c", color: "#fff", borderWidth: 1, borderColor: "#282832", borderRadius: 14, padding: 16, marginBottom: 12 },
  primary: { backgroundColor: "#6d5dfc", borderRadius: 14, padding: 16, alignItems: "center", marginTop: 6 },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  hint: { color: "#666", textAlign: "center", marginTop: 18 },
  error: { color: "#ff7373", paddingHorizontal: 4, paddingVertical: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: "#1d1d24" },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  refresh: { color: "#fff", fontSize: 28 },
  feed: { padding: 12, paddingBottom: 100 },
  loader: { marginTop: 24 },
  card: { backgroundColor: "#111117", borderWidth: 1, borderColor: "#20202a", borderRadius: 18, padding: 14, marginBottom: 12 },
  authorRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, marginRight: 10 },
  avatarFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#272735", alignItems: "center", justifyContent: "center", marginRight: 10 },
  avatarText: { color: "#fff", fontWeight: "800" },
  author: { color: "#fff", fontWeight: "700" },
  username: { color: "#777", marginTop: 2 },
  content: { color: "#eee", fontSize: 16, lineHeight: 23, marginBottom: 12 },
  media: { width: "100%", height: 260, borderRadius: 14, backgroundColor: "#191922" },
  metrics: { flexDirection: "row", gap: 22, paddingTop: 12 },
  metricsText: { color: "#999" },
  empty: { color: "#777", textAlign: "center", marginTop: 50 },
  nav: { position: "absolute", left: 10, right: 10, bottom: 10, height: 68, borderRadius: 22, backgroundColor: "#15151d", borderWidth: 1, borderColor: "#292934", flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  navItem: { alignItems: "center", justifyContent: "center", minWidth: 58 },
  navIcon: { color: "#777", fontSize: 21, marginBottom: 3 },
  navLabel: { color: "#777", fontSize: 10 },
  navActive: { color: "#fff", fontWeight: "800" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  placeholderTitle: { color: "#fff", fontSize: 30, fontWeight: "800", marginBottom: 12 },
  placeholderText: { color: "#888", textAlign: "center", lineHeight: 22 },
});
