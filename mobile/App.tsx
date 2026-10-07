import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader, MenuDrawer, type MobileRoute } from "./components/MobileShell";
import FriendsScreen from "./screens/FriendsScreen";
import SettingsScreen from "./screens/SettingsScreen";
import SavedScreen from "./screens/SavedScreen";
import SecurityScreen from "./screens/SecurityScreen";
import AdminScreen from "./screens/AdminScreen";
import VideoMedia from "./components/VideoMedia";
import { Share } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import PermissionOnboarding from "./components/PermissionOnboarding";
import { authClient } from "./lib/auth-client";
import { apiFetch, uploadMedia } from "./lib/api";
import { configurePushNotifications, subscribeToNotificationOpen, unregisterPushDevice } from "./lib/push";
import { startPresenceHeartbeat } from "./lib/presence";
import { startRealtime, subscribeRealtime } from "./lib/realtime";
import type {
  Conversation,
  Message,
  Notification,
  Post,
  Profile,
  SearchUser,
  Story,
  User,
} from "./types";

type Tab = MobileRoute;

const BRAND_ICON = require("./assets/icon.png");
const PERMISSION_ONBOARDING_KEY = "socialhub:permissions-intro:v2";

const colors = {
  bg: "#08080c",
  panel: "#111118",
  panel2: "#171720",
  border: "#252531",
  text: "#f8f8ff",
  muted: "#8d8d9b",
  accent: "#725cff",
  accentSoft: "#251f55",
  success: "#69d79b",
  danger: "#ff7474",
};

SplashScreen.setOptions({ duration: 650 });
void SplashScreen.preventAutoHideAsync().catch(() => {});

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return date.toLocaleDateString();
}

function initials(user?: User | null) {
  return user?.name?.trim()?.[0]?.toUpperCase() ?? "S";
}

function Avatar({ user, size = 44 }: { user?: User | null; size?: number }) {
  return user?.image ? (
    <Image source={{ uri: user.image }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.avatarInitial}>{initials(user)}</Text>
    </View>
  );
}

function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction}>
          <Text style={styles.linkText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, secondary && styles.secondaryButton, disabled && styles.disabledButton]}
    >
      {disabled ? <ActivityIndicator color={secondary ? colors.text : "#fff"} /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

function AuthScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup" | "otp" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [otpType, setOtpType] = useState<"sign-in" | "email-verification" | "forget-password">("sign-in");

  const resetMessages = () => {
    setError("");
    setMessage("");
  };

  const run = async (fn: () => Promise<{ error?: { message?: string } | null }>) => {
    setBusy(true);
    resetMessages();
    try {
      const result = await fn();
      if (result?.error) setError(result.error.message ?? "Something went wrong.");
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const signIn = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    const result = await run(() => authClient.signIn.email({
      email: email.trim(),
      password,
      rememberMe: true,
    }));
    if (result && !result.error) onSignedIn();
  };

  const signUp = async () => {
    if (!name.trim() || !email.trim() || password.length < 8) {
      setError("Enter your name, email, and a password with at least 8 characters.");
      return;
    }
    const result = await run(() => authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
      callbackURL: "/",
    }));
    if (result && !result.error) {
      setOtpType("email-verification");
      setMode("otp");
      setMessage("We sent a verification code to your email.");
    }
  };

  const sendOtp = async (type = otpType) => {
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    const result = await run(() => authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type,
    }));
    if (result && !result.error) setMessage("Verification code sent.");
  };

  const verifySignInOtp = async () => {
    if (otp.length < 4) {
      setError("Enter the verification code.");
      return;
    }
    const result = await run(() => authClient.signIn.emailOtp({
      email: email.trim(),
      otp,
      name: name.trim() || undefined,
    }));
    if (result && !result.error) onSignedIn();
  };

  const verifyEmail = async () => {
    if (otp.length < 4) {
      setError("Enter the verification code.");
      return;
    }
    const result = await run(() => authClient.emailOtp.verifyEmail({
      email: email.trim(),
      otp,
    }));
    if (result && !result.error) {
      setMessage("Email verified. You can sign in now.");
      setMode("signin");
    }
  };

  const requestReset = async () => {
    if (!email.trim()) {
      setError("Enter your account email.");
      return;
    }
    const result = await run(() => authClient.emailOtp.requestPasswordReset({ email: email.trim() }));
    if (result && !result.error) {
      setOtpType("forget-password");
      setMode("otp");
      setMessage("Password reset code sent.");
    }
  };

  const resetPassword = async () => {
    if (otp.length < 4 || newPassword.length < 8) {
      setError("Enter the OTP and a new password with at least 8 characters.");
      return;
    }
    const result = await run(() => authClient.emailOtp.resetPassword({
      email: email.trim(),
      otp,
      password: newPassword,
    }));
    if (result && !result.error) {
      setMessage("Password reset successfully. Sign in with your new password.");
      setMode("signin");
      setPassword("");
      setNewPassword("");
      setOtp("");
    }
  };

  const google = async () => {
    setBusy(true);
    resetMessages();
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
      if (result.error) {
        setError(result.error.message ?? "Google sign-in failed.");
        return;
      }
      const session = await authClient.getSession();
      if (session.data?.user) onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : mode === "otp" ? "Enter verification code" : "Welcome back";

  return (
    <SafeAreaView style={styles.authScreen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Image source={BRAND_ICON} style={styles.logoImage} resizeMode="contain" />
        </View>
        <Text style={styles.authBrand}>SocialHub</Text>
        <Text style={styles.authSubtitle}>{title}</Text>

        {mode === "signup" ? (
          <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.muted} style={styles.input} />
        ) : null}

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        {mode !== "otp" && mode !== "forgot" ? (
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            style={styles.input}
            secureTextEntry
          />
        ) : null}

        {mode === "otp" ? (
          <>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              placeholder="6-digit code"
              placeholderTextColor={colors.muted}
              style={styles.input}
              keyboardType="number-pad"
              maxLength={8}
            />
            {otpType === "forget-password" ? (
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New password"
                placeholderTextColor={colors.muted}
                style={styles.input}
                secureTextEntry
              />
            ) : null}
          </>
        ) : null}

        {message ? <Text style={styles.successText}>{message}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {mode === "signin" ? (
          <>
            <PrimaryButton label="Sign in" onPress={() => void signIn()} disabled={busy} />
            <PrimaryButton label="Continue with Google" onPress={() => void google()} disabled={busy} secondary />
            <View style={styles.authRow}>
              <Pressable onPress={() => { resetMessages(); setOtpType("sign-in"); setMode("otp"); }}>
                <Text style={styles.linkText}>Use email OTP</Text>
              </Pressable>
              <Pressable onPress={() => { resetMessages(); setMode("forgot"); }}>
                <Text style={styles.linkText}>Forgot password?</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => { resetMessages(); setMode("signup"); }}>
              <Text style={styles.authSwitch}>New to SocialHub? <Text style={styles.linkText}>Create account</Text></Text>
            </Pressable>
          </>
        ) : null}

        {mode === "signup" ? (
          <>
            <PrimaryButton label="Create account" onPress={() => void signUp()} disabled={busy} />
            <Pressable onPress={() => { resetMessages(); setMode("signin"); }}>
              <Text style={styles.authSwitch}>Already have an account? <Text style={styles.linkText}>Sign in</Text></Text>
            </Pressable>
          </>
        ) : null}

        {mode === "forgot" ? (
          <>
            <PrimaryButton label="Send reset code" onPress={() => void requestReset()} disabled={busy} />
            <Pressable onPress={() => { resetMessages(); setMode("signin"); }}>
              <Text style={styles.authSwitch}>Back to <Text style={styles.linkText}>sign in</Text></Text>
            </Pressable>
          </>
        ) : null}

        {mode === "otp" ? (
          <>
            <PrimaryButton
              label={otpType === "forget-password" ? "Reset password" : otpType === "email-verification" ? "Verify email" : "Sign in with OTP"}
              onPress={() => void (otpType === "forget-password" ? resetPassword() : otpType === "email-verification" ? verifyEmail() : verifySignInOtp())}
              disabled={busy}
            />
            <Pressable onPress={() => void sendOtp()}>
              <Text style={styles.authSwitch}>Didn't receive it? <Text style={styles.linkText}>Resend code</Text></Text>
            </Pressable>
            <Pressable onPress={() => { resetMessages(); setMode("signin"); }}>
              <Text style={styles.authSwitch}>Back to <Text style={styles.linkText}>sign in</Text></Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PostCard({
  post,
  onChanged,
}: {
  post: Post;
  onChanged: (next: Post) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comments, setComments] = useState<Array<{ id: string; content: string; createdAt: string; author: User }>>([]);
  const [commentText, setCommentText] = useState("");
  const [reactionOpen, setReactionOpen] = useState(false);

  const mutatePost = async (action: "like" | "save") => {
    if (busy) return;
    setBusy(true);
    try {
      const liked = action === "like" ? post.liked : post.saved;
      const endpoint = action === "like" ? `/api/posts/${post.id}/like` : `/api/posts/${post.id}/save`;
      const data = await apiFetch<{ liked?: boolean; count?: number; saved?: boolean }>(endpoint, {
        method: liked ? "DELETE" : "POST",
        body: action === "save" ? JSON.stringify({}) : undefined,
      });
      onChanged({
        ...post,
        liked: action === "like" ? Boolean(data.liked) : post.liked,
        saved: action === "save" ? Boolean(data.saved) : post.saved,
        displayCounts: action === "like" && typeof data.count === "number"
          ? { ...post.displayCounts, likes: data.count }
          : post.displayCounts,
      });
    } catch (e) {
      Alert.alert("Socialhub", e instanceof Error ? e.message : "Unable to update post.");
    } finally {
      setBusy(false);
    }
  };

  const loadComments = async () => {
    try {
      const data = await apiFetch<{ comments: Array<{ id: string; content: string; createdAt: string; author: User }> }>(`/api/posts/${post.id}/comments?take=30`);
      setComments(data.comments ?? []);
      setCommentOpen(true);
    } catch (e) {
      Alert.alert("Comments", e instanceof Error ? e.message : "Unable to load comments.");
    }
  };

  const sendComment = async () => {
    const content = commentText.trim();
    if (!content) return;
    try {
      const data = await apiFetch<{ comment: { id: string; content: string; createdAt: string; author: User }; commentCount: number }>(`/api/posts/${post.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setComments((items) => [...items, data.comment]);
      setCommentText("");
      onChanged({ ...post, displayCounts: { ...post.displayCounts, comments: data.commentCount } });
    } catch (e) {
      Alert.alert("Comments", e instanceof Error ? e.message : "Unable to comment.");
    }
  };

  const react = async (emoji: string) => {
    try {
      const current = post.myReaction;
      const data = current === emoji
        ? await apiFetch<{ reaction: null }>(`/api/posts/${post.id}/reaction`, { method: "DELETE" })
        : await apiFetch<{ reaction: { emoji: string } }>(`/api/posts/${post.id}/reaction`, {
            method: "POST",
            body: JSON.stringify({ emoji }),
          });
      const nextEmoji = "reaction" in data && data.reaction ? data.reaction.emoji : null;
      const nextCounts = post.reactions.map((item) => ({ ...item }));
      if (current) {
        const index = nextCounts.findIndex((item) => item.emoji === current);
        if (index >= 0) nextCounts[index] = { ...nextCounts[index], count: Math.max(0, nextCounts[index].count - 1) };
      }
      if (nextEmoji) {
        const index = nextCounts.findIndex((item) => item.emoji === nextEmoji);
        if (index >= 0) nextCounts[index] = { ...nextCounts[index], count: nextCounts[index].count + 1 };
        else nextCounts.push({ emoji: nextEmoji, count: 1 });
      }
      onChanged({ ...post, myReaction: nextEmoji, reactions: nextCounts });
      setReactionOpen(false);
    } catch (e) {
      Alert.alert("Reaction", e instanceof Error ? e.message : "Unable to update reaction.");
    }
  };

  const sharePost = async () => {
    try {
      await Share.share({ message: `${post.content || "Shared a Socialhub post"}\nhttps://socialhublive.vercel.app/home#post-${post.id}` });
      const data = await apiFetch<{ shareCount: number }>(`/api/posts/${post.id}/share`, { method: "POST" });
      onChanged({ ...post, displayCounts: { ...post.displayCounts, shares: data.shareCount } });
    } catch (e) {
      if (!(e instanceof Error && e.message.includes("cancel"))) Alert.alert("Share", e instanceof Error ? e.message : "Unable to share.");
    }
  };

  return (
    <>
      <View style={styles.postCard}>
        <View style={styles.row}>
          <Avatar user={post.author} />
          <View style={styles.flex}>
            <Text style={styles.userName}>{post.author.name}</Text>
            <Text style={styles.userHandle}>@{post.author.username ?? "socialhub"} · {formatTime(post.createdAt)}</Text>
          </View>
          <Pressable onPress={() => setReactionOpen((v) => !v)} style={styles.reactionMenuButton}><Text style={styles.actionText}>☺</Text></Pressable>
        </View>
        {post.content ? <Text style={styles.postText}>{post.content}</Text> : null}
        {post.mediaUrl ? <Image source={{ uri: post.mediaUrl }} style={styles.postMedia} resizeMode="cover" /> : null}
        {post.reactions.length ? <Text style={styles.reactionSummary}>{post.reactions.filter(r => r.count > 0).map(r => `${r.emoji} ${formatCount(r.count)}`).join("  ")}</Text> : null}
        <View style={styles.metricsRow}>
          <Text style={styles.muted}>{formatCount(post.displayCounts.likes)} likes</Text>
          <Text style={styles.muted}>{formatCount(post.displayCounts.comments)} comments</Text>
          <Text style={styles.muted}>{formatCount(post.displayCounts.shares)} shares</Text>
        </View>
        <View style={styles.actionRow}>
          <Pressable style={styles.actionButton} onPress={() => void mutatePost("like")}><Text style={[styles.actionText, post.liked && styles.activeAction]}>{post.liked ? "♥ Liked" : "♡ Like"}</Text></Pressable>
          <Pressable style={styles.actionButton} onPress={() => void loadComments()}><Text style={styles.actionText}>💬 Comment</Text></Pressable>
          <Pressable style={styles.actionButton} onPress={() => void sharePost()}><Text style={styles.actionText}>↗ Share</Text></Pressable>
          <Pressable style={styles.actionButton} onPress={() => void mutatePost("save")}><Text style={[styles.actionText, post.saved && styles.activeAction]}>🔖 {post.saved ? "Saved" : "Save"}</Text></Pressable>
        </View>
        {reactionOpen ? <View style={styles.reactionPicker}>{["❤️","😂","😮","😢","🔥","👍"].map(e => <Pressable key={e} onPress={() => void react(e)} style={styles.reactionPickerItem}><Text style={styles.reactionPickerEmoji}>{e}</Text></Pressable>)}</View> : null}
      </View>
      <Modal visible={commentOpen} transparent animationType="slide" onRequestClose={() => setCommentOpen(false)}>
        <KeyboardAvoidingView style={styles.commentOverlay} behavior={Platform.OS === "ios" ? "padding" : "padding"}>
          <Pressable style={styles.commentScrim} onPress={() => setCommentOpen(false)} />
          <View style={styles.commentSheet}>
            <View style={styles.commentHeader}><Text style={styles.sheetTitle}>Comments</Text><Pressable onPress={() => setCommentOpen(false)}><Text style={styles.closeText}>×</Text></Pressable></View>
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.commentList}
              renderItem={({ item }) => <View style={styles.commentRow}><Avatar user={item.author} size={36}/><View style={styles.flex}><Text style={styles.commentAuthor}>{item.author.name}</Text><Text style={styles.commentBody}>{item.content}</Text><Text style={styles.userHandle}>{formatTime(item.createdAt)}</Text></View></View>}
              ListEmptyComponent={<Text style={styles.emptySmall}>No comments yet.</Text>}
            />
            <View style={styles.commentComposer}><TextInput value={commentText} onChangeText={setCommentText} placeholder="Write a comment…" placeholderTextColor={colors.muted} style={styles.commentInput} multiline/><Pressable onPress={() => void sendComment()} style={styles.sendButton}><Text style={styles.sendButtonText}>➤</Text></Pressable></View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
function StoryTray({
  stories,
  onOpen,
  onCreate,
}: {
  stories: Story[];
  onOpen: (index: number) => void;
  onCreate: () => void;
}) {
  return (
    <View style={styles.storyTray}>
      <Pressable style={styles.storyItem} onPress={onCreate}>
        <View style={styles.storyCreate}><Text style={styles.storyCreateText}>＋</Text></View>
        <Text style={styles.storyLabel}>Your story</Text>
      </Pressable>
      {stories.map((story, index) => (
        <Pressable key={story.id} style={styles.storyItem} onPress={() => onOpen(index)}>
          <View style={[styles.storyRing, !story.hasViewed && styles.storyRingUnread]}>
            <Avatar user={story.author} size={58} />
          </View>
          <Text numberOfLines={1} style={styles.storyLabel}>{story.author.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function StoryViewer({
  stories,
  initialIndex,
  onClose,
  onRefresh,
}: {
  stories: Story[];
  initialIndex: number;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [detail, setDetail] = useState<Record<string, {
    reactionCounts: { emoji: string; count: number }[];
    replyCount: number;
    viewCount: number;
  }>>({});
  const [reply, setReply] = useState("");
  const current = stories[index];
  const insets = useSafeAreaInsets();

  const loadDetail = useCallback(async () => {
    if (!current) return;
    try {
      await apiFetch(`/api/stories/${current.id}`, { method: "POST", body: JSON.stringify({}) });
      const data = await apiFetch<{
        reactionCounts: { emoji: string; count: number }[];
        replyCount: number;
        viewCount: number;
      }>(`/api/stories/${current.id}`);
      setDetail((prev) => ({ ...prev, [current.id]: data }));
      onRefresh();
    } catch {
      // Story may expire between tray load and open.
    }
  }, [current, onRefresh]);

  useEffect(() => { void loadDetail(); }, [loadDetail]);

  if (!current) return null;

  const doReaction = async (emoji: string) => {
    try {
      await apiFetch(`/api/stories/${current.id}`, {
        method: "POST",
        body: JSON.stringify({ action: "reaction", emoji }),
      });
      void loadDetail();
    } catch (e) {
      Alert.alert("Story", e instanceof Error ? e.message : "Unable to react.");
    }
  };

  const sendReply = async () => {
    if (!reply.trim()) return;
    try {
      await apiFetch(`/api/stories/${current.id}`, {
        method: "POST",
        body: JSON.stringify({ action: "reply", content: reply.trim() }),
      });
      setReply("");
      void loadDetail();
    } catch (e) {
      Alert.alert("Story", e instanceof Error ? e.message : "Unable to reply.");
    }
  };

  const move = (direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0) return setIndex(stories.length - 1);
    if (next >= stories.length) return setIndex(0);
    setIndex(next);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.storyModal}>
        <View style={[styles.storyTop, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={onClose}><Text style={styles.closeText}>✕</Text></Pressable>
          <View style={styles.flex}>
            <Text style={styles.storyViewerName}>{current.author.name}</Text>
            <Text style={styles.muted}>{formatTime(current.createdAt)}</Text>
          </View>
          <Text style={styles.muted}>{(detail[current.id]?.viewCount ?? current.viewCount)} views</Text>
        </View>

        <View style={styles.storyMediaArea}>
          {current.mediaType === "IMAGE" ? (
            <Image source={{ uri: current.mediaUrl }} style={styles.storyMedia} resizeMode="contain" />
          ) : (
            <VideoMedia uri={current.mediaUrl} height={390} autoPlay loop />
          )}
          <Pressable style={styles.storyTapLeft} onPress={() => move(-1)} />
          <Pressable style={styles.storyTapRight} onPress={() => move(1)} />
        </View>

        <View style={[styles.storyBottom, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          {current.caption ? <Text style={styles.storyCaption}>{current.caption}</Text> : null}
          <View style={styles.reactionsRow}>
            {["❤️", "😂", "😮", "😢", "🔥", "👍"].map((emoji) => (
              <Pressable key={emoji} onPress={() => void doReaction(emoji)} style={styles.reactionChip}>
                <Text style={styles.reactionText}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={reply}
            onChangeText={setReply}
            placeholder="Reply to this story…"
            placeholderTextColor={colors.muted}
            style={styles.storyReplyInput}
            onSubmitEditing={() => void sendReply()}
            returnKeyType="send"
          />
          <View style={styles.storyStats}>
            <Text style={styles.muted}>{detail[current.id]?.replyCount ?? current.replyCount} replies</Text>
            <Text style={styles.muted}>{current.reactionCount} reactions</Text>
            <Text style={styles.muted}>Swipe-like taps: left / right</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MediaPickerButton({
  label,
  onPicked,
}: {
  label: string;
  onPicked: (asset: ImagePicker.ImagePickerAsset) => void;
}) {
  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow SocialHub to access your media so you can share photos and videos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: false,
      quality: 1,
      selectionLimit: 1,
    });
    if (!result.canceled && result.assets[0]) onPicked(result.assets[0]);
  };
  return (
    <Pressable style={styles.mediaPickerButton} onPress={() => void pick()}>
      <Text style={styles.actionText}>＋ {label}</Text>
    </Pressable>
  );
}

function CreatePost({ onCreated }: { onCreated: (post: Post) => void }) {
  const [content, setContent] = useState("");
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [visibility, setVisibility] = useState<"PUBLIC" | "FRIENDS" | "PRIVATE">("PUBLIC");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!content.trim() && !asset) return;
    setBusy(true);
    try {
      let mediaUrl: string | undefined;
      if (asset) {
        const mime = asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg");
        const fileName = asset.fileName ?? `socialhub-${Date.now()}${asset.type === "video" ? ".mp4" : ".jpg"}`;
        const upload = await uploadMedia(asset.uri, mime, fileName);
        mediaUrl = upload.url;
      }
      const data = await apiFetch<{ post: Post; liked?: boolean; saved?: boolean }>("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          content: content.trim() || null,
          mediaUrl: mediaUrl ?? null,
          visibility,
        }),
      });
      onCreated({
        ...data.post,
        liked: false,
        saved: false,
        reactions: [],
        displayCounts: data.post.displayCounts ?? { likes: 0, comments: 0, shares: 0 },
      });
      setContent("");
      setAsset(null);
    } catch (e) {
      Alert.alert("Create post", e instanceof Error ? e.message : "Unable to create post.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.composer}>
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="What's happening?"
        placeholderTextColor={colors.muted}
        style={styles.composerInput}
        multiline
      />
      {asset ? (
        <View style={styles.selectedMedia}>
          <Text style={styles.muted}>{asset.type === "video" ? "Video attached" : "Image attached"}</Text>
          <Pressable onPress={() => setAsset(null)}><Text style={styles.dangerText}>Remove</Text></Pressable>
        </View>
      ) : null}
      <View style={styles.visibilityRow}>
        {[
          ["PUBLIC", "Public"],
          ["FRIENDS", "Friends"],
          ["PRIVATE", "Only me"],
        ].map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setVisibility(value as "PUBLIC" | "FRIENDS" | "PRIVATE")}
            style={[styles.visibilityChip, visibility === value && styles.visibilityChipActive]}
          >
            <Text style={[styles.visibilityText, visibility === value && styles.visibilityTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.composerActions}>
        <MediaPickerButton label="Media" onPicked={setAsset} />
        <PrimaryButton label={busy ? "Posting…" : "Post"} onPress={() => void submit()} disabled={busy || (!content.trim() && !asset)} />
      </View>
    </View>
  );
}

function StoryCreate({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!asset) {
      Alert.alert("Story", "Choose a photo or video first.");
      return;
    }
    setBusy(true);
    try {
      const mime = asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg");
      const fileName = asset.fileName ?? `story-${Date.now()}${asset.type === "video" ? ".mp4" : ".jpg"}`;
      const upload = await uploadMedia(asset.uri, mime, fileName);
      await apiFetch("/api/stories", {
        method: "POST",
        body: JSON.stringify({
          mediaUrl: upload.url,
          mediaType: upload.mediaType,
          caption: caption.trim() || null,
          audience: "PUBLIC",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000 - 60_000).toISOString(),
        }),
      });
      onCreated();
      onClose();
    } catch (e) {
      Alert.alert("Story", e instanceof Error ? e.message : "Unable to create story.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Create story</Text>
          <Pressable onPress={onClose}><Text style={styles.closeText}>✕</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetContent}>
          <MediaPickerButton label={asset ? "Change media" : "Choose media"} onPicked={setAsset} />
          {asset ? (
            asset.type === "image" ? (
              <Image source={{ uri: asset.uri }} style={styles.previewMedia} resizeMode="cover" />
            ) : (
              <View style={styles.videoPreview}><Text style={styles.videoIcon}>▶</Text><Text style={styles.storyCaption}>Video selected</Text></View>
            )
          ) : null}
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Add a caption…"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <PrimaryButton label={busy ? "Publishing…" : "Publish story"} onPress={() => void submit()} disabled={busy || !asset} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function HomeScreen({
  onMenu,
  initialPostId,
  initialStoryId,
  onDeepLinkHandled,
}: {
  onMenu: () => void;
  initialPostId?: string;
  initialStoryId?: string;
  onDeepLinkHandled: () => void;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [postData, storyData] = await Promise.all([
        apiFetch<{ posts: Post[] }>("/api/posts?take=20&mode=FOR_YOU"),
        apiFetch<{ stories: Story[] }>("/api/stories"),
      ]);
      setPosts(postData.posts);
      setStories(storyData.stories);
    } catch (e) {
      Alert.alert("Feed", e instanceof Error ? e.message : "Unable to load your feed.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return subscribeRealtime((event) => {
      if (event.type === "message.created") void load();
    });
  }, [load]);

  const [storyIndex, setStoryIndex] = useState<number | null>(null);
  const [creatingStory, setCreatingStory] = useState(false);
  const [handledPostId, setHandledPostId] = useState<string | null>(null);

  useEffect(() => {
    if (!initialStoryId || !stories.length || storyIndex !== null) return;
    const index = stories.findIndex((story) => story.id === initialStoryId);
    if (index >= 0) {
      setStoryIndex(index);
      onDeepLinkHandled();
    }
  }, [initialStoryId, stories, storyIndex, onDeepLinkHandled]);

  useEffect(() => {
    if (!initialPostId || !posts.length || handledPostId === initialPostId) return;
    const target = posts.find((post) => post.id === initialPostId);
    if (!target) return;
    setPosts([target, ...posts.filter((post) => post.id !== initialPostId)]);
    setHandledPostId(initialPostId);
    onDeepLinkHandled();
  }, [initialPostId, posts, handledPostId, onDeepLinkHandled]);

  const replacePost = (next: Post) => setPosts((current) => current.map((post) => post.id === next.id ? next : post));

  return (
    <View style={styles.screen}>
      <AppHeader title="Socialhub" subtitle="Your people, your feed." onMenu={onMenu} action="↻" onAction={() => void load(true)} />

      {loading && !posts.length ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null}

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} onChanged={replacePost} />}
        ListHeaderComponent={
          <View>
            <StoryTray stories={stories} onOpen={setStoryIndex} onCreate={() => setCreatingStory(true)} />
            <CreatePost onCreated={(post) => setPosts((current) => [post, ...current])} />
          </View>
        }
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No posts to show yet.</Text> : null}
        contentContainerStyle={styles.feed}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
      />

      {storyIndex !== null ? (
        <StoryViewer
          stories={stories}
          initialIndex={storyIndex}
          onClose={() => setStoryIndex(null)}
          onRefresh={() => void load(true)}
        />
      ) : null}
      {creatingStory ? (
        <StoryCreate
          onCreated={() => void load(true)}
          onClose={() => setCreatingStory(false)}
        />
      ) : null}
    </View>
  );
}

function DiscoverScreen({
  onMenu,
  initialQuery,
  onDeepLinkHandled,
}: {
  onMenu: () => void;
  initialQuery?: string;
  onDeepLinkHandled: () => void;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (value: string) => {
    setLoading(true);
    try {
      const data = await apiFetch<{ users: SearchUser[]; posts: Post[] }>(`/api/search?q=${encodeURIComponent(value.trim())}&take=20`);
      setUsers(data.users);
      setPosts(data.posts);
    } catch (e) {
      Alert.alert("Discover", e instanceof Error ? e.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery);
      onDeepLinkHandled();
    }
  }, [initialQuery, query, onDeepLinkHandled]);

  useEffect(() => {
    const timeout = setTimeout(() => void search(query), query ? 250 : 0);
    return () => clearTimeout(timeout);
  }, [query, search]);

  const friendRequest = async (user: SearchUser) => {
    try {
      if (user.friendRequestStatus === "INCOMING_PENDING") {
        const requests = await apiFetch<{ received: { id: string; sender: User }[] }>("/api/friend-requests");
        const request = requests.received.find((item) => item.sender.id === user.id);
        if (!request) return;
        await apiFetch(`/api/friend-requests/${request.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "ACCEPTED" }),
        });
        Alert.alert("Friends", "Friend request accepted.");
      } else if (user.canSendFriendRequest) {
        await apiFetch("/api/friend-requests", {
          method: "POST",
          body: JSON.stringify({ receiverId: user.id }),
        });
        Alert.alert("Friends", "Friend request sent.");
      }
      await search(query);
    } catch (e) {
      Alert.alert("Friends", e instanceof Error ? e.message : "Unable to update friendship.");
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="Discover" subtitle="Find people and posts." onMenu={onMenu} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search people, usernames or posts…"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          autoCapitalize="none"
        />
        {loading ? <ActivityIndicator color={colors.accent} /> : null}

        <SectionHeader title="People" />
        {users.length ? users.map((user) => (
          <View key={user.id} style={styles.userCard}>
            <Avatar user={user} size={46} />
            <View style={styles.flex}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userHandle}>@{user.username ?? "socialhub"} · {formatCount(user.displayCounts?.followers ?? 0)} followers</Text>
            </View>
            {user.isFriend ? (
              <Text style={styles.successText}>Friends</Text>
            ) : user.friendRequestStatus === "OUTGOING_PENDING" ? (
              <Text style={styles.muted}>Pending</Text>
            ) : user.friendRequestStatus === "INCOMING_PENDING" ? (
              <Pressable style={styles.miniButton} onPress={() => void friendRequest(user)}><Text style={styles.miniButtonText}>Accept</Text></Pressable>
            ) : user.canSendFriendRequest ? (
              <Pressable style={styles.miniButton} onPress={() => void friendRequest(user)}><Text style={styles.miniButtonText}>Add</Text></Pressable>
            ) : null}
          </View>
        )) : <Text style={styles.emptySmall}>No people found.</Text>}

        <SectionHeader title="Posts" />
        {posts.map((post) => <PostCard key={post.id} post={post} onChanged={(next) => setPosts((items) => items.map((item) => item.id === next.id ? next : item))} />)}
      </ScrollView>
    </View>
  );
}

function conversationName(conversation: Conversation, currentUserId: string) {
  if (conversation.isGroup) return conversation.title || "Group conversation";
  return conversation.members.find((member) => member.userId !== currentUserId)?.user.name ?? "Conversation";
}

function MessagingScreen({
  currentUserId,
  onMenu,
  onChildStateChange,
  initialConversationId,
  onDeepLinkHandled,
}: {
  currentUserId: string;
  onMenu: () => void;
  onChildStateChange: (hidden: boolean) => void;
  initialConversationId?: string;
  onDeepLinkHandled: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const path = includeArchived ? "/api/conversations?includeArchived=true" : "/api/conversations";
      const data = await apiFetch<{ conversations: Conversation[] }>(path);
      setConversations(data.conversations);
      if (initialConversationId) {
        const target = data.conversations.find((item) => item.id === initialConversationId);
        if (target) {
          setSelected(target);
          onDeepLinkHandled();
        }
      }
    } catch (e) {
      Alert.alert("Messages", e instanceof Error ? e.message : "Unable to load conversations.");
    } finally {
      setLoading(false);
    }
  }, [includeArchived, initialConversationId, onDeepLinkHandled]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    onChildStateChange(Boolean(selected));
    return () => onChildStateChange(false);
  }, [selected, onChildStateChange]);

  const controlConversation = async (item: Conversation) => {
    const me = item.members.find((member) => member.userId === currentUserId);
    const archived = Boolean(me?.archivedAt);
    Alert.alert(
      conversationName(item, currentUserId),
      "Choose a conversation action.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: archived ? "Unarchive" : "Archive",
          onPress: async () => {
            try {
              await apiFetch("/api/conversations/" + item.id + "/messages", {
                method: "PATCH",
                body: JSON.stringify({ action: archived ? "unarchive" : "archive" }),
              });
              await load();
            } catch (e) {
              Alert.alert("Messages", e instanceof Error ? e.message : "Unable to update conversation.");
            }
          },
        },
        {
          text: "Mute 7 days",
          onPress: async () => {
            try {
              await apiFetch("/api/conversations/" + item.id + "/messages", {
                method: "PATCH",
                body: JSON.stringify({ action: "mute" }),
              });
              Alert.alert("Messages", "Conversation muted for 7 days.");
            } catch (e) {
              Alert.alert("Messages", e instanceof Error ? e.message : "Unable to mute conversation.");
            }
          },
        },
        {
          text: "Mark read",
          onPress: async () => {
            try {
              await apiFetch("/api/conversations/" + item.id + "/messages", {
                method: "PATCH",
                body: JSON.stringify({ action: "read" }),
              });
              await load();
            } catch (e) {
              Alert.alert("Messages", e instanceof Error ? e.message : "Unable to mark conversation as read.");
            }
          },
        },
      ],
    );
  };

  if (selected) {
    return (
      <ChatScreen
        conversation={selected}
        currentUserId={currentUserId}
        onBack={() => { setSelected(null); void load(); }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        title={includeArchived ? "Archived messages" : "Messages"}
        subtitle="Private conversations."
        onMenu={onMenu}
        action={includeArchived ? "Active" : "Archived"}
        onAction={() => setIncludeArchived((value) => !value)}
      />
      {loading ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null}
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.feed}
        renderItem={({ item }) => {
          const member = item.members.find((m) => m.userId !== currentUserId)?.user;
          const last = item.messages?.[0];
          const me = item.members.find((m) => m.userId === currentUserId);
          return (
            <Pressable
              style={styles.conversationCard}
              onPress={() => setSelected(item)}
              onLongPress={() => void controlConversation(item)}
            >
              <Avatar user={member} size={50} />
              <View style={styles.flex}>
                <View style={styles.row}>
                  <Text style={styles.userName}>{conversationName(item, currentUserId)}</Text>
                  {me?.archivedAt ? <Text style={styles.muted}>ARCHIVED</Text> : null}
                  {item.unreadCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{formatCount(item.unreadCount)}</Text></View> : null}
                </View>
                <Text numberOfLines={1} style={styles.userHandle}>{last?.content || "Start the conversation"}</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No conversations yet.</Text> : null}
      />
    </View>
  );
}

function ChatScreen({
  conversation,
  currentUserId,
  onBack,
}: {
  conversation: Conversation;
  currentUserId: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const other = conversation.members.find((member) => member.userId !== currentUserId)?.user;
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ messages: Message[] }>("/api/conversations/" + conversation.id + "/messages");
      setMessages(data.messages);
      await apiFetch("/api/conversations/" + conversation.id + "/messages", {
        method: "PATCH",
        body: JSON.stringify({ action: "read" }),
      });
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
    } catch (e) {
      Alert.alert("Messages", e instanceof Error ? e.message : "Unable to load chat.");
    } finally {
      setLoading(false);
    }
  }, [conversation.id]);

  useEffect(() => {
    void load();
    return subscribeRealtime((event) => {
      if (event.type === "message.created" && event.conversationId === conversation.id) {
        void load();
      }
    });
  }, [load, conversation.id]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const send = async () => {
    if (editing) {
      if (!text.trim()) return;
      try {
        const data = await apiFetch<{ message: Message }>("/api/messages/" + editing.id, {
          method: "PATCH",
          body: JSON.stringify({ action: "edit", content: text.trim() }),
        });
        setMessages((current) => current.map((item) => item.id === editing.id ? data.message : item));
        setEditing(null);
        setText("");
      } catch (e) {
        Alert.alert("Messages", e instanceof Error ? e.message : "Unable to edit.");
      }
      return;
    }

    if (!text.trim()) return;
    try {
      const data = await apiFetch<{ message: Message }>("/api/conversations/" + conversation.id + "/messages", {
        method: "POST",
        body: JSON.stringify({
          content: text.trim(),
          attachments: [],
          replyToId: replyingTo?.id,
        }),
      });
      setMessages((current) => [...current, data.message]);
      setText("");
      setReplyingTo(null);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      Alert.alert("Messages", e instanceof Error ? e.message : "Unable to send.");
    }
  };

  const sendAttachment = async () => {
    setAttachmentBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Messages", "Allow photo access to attach an image.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const upload = await uploadMedia(asset.uri, asset.mimeType ?? "image/jpeg", asset.fileName ?? "message.jpg");
      const data = await apiFetch<{ message: Message }>("/api/conversations/" + conversation.id + "/messages", {
        method: "POST",
        body: JSON.stringify({
          content: text.trim(),
          attachments: [upload.url],
          replyToId: replyingTo?.id,
        }),
      });
      setMessages((current) => [...current, data.message]);
      setText("");
      setReplyingTo(null);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      Alert.alert("Messages", e instanceof Error ? e.message : "Unable to attach image.");
    } finally {
      setAttachmentBusy(false);
    }
  };

  const removeMessage = async (message: Message) => {
    try {
      await apiFetch("/api/messages/" + message.id, { method: "DELETE" });
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, deletedAt: new Date().toISOString(), content: "" } : item));
    } catch (e) {
      Alert.alert("Messages", e instanceof Error ? e.message : "Unable to delete message.");
    }
  };

  const messageActions = (message: Message) => {
    if (message.deletedAt) {
      Alert.alert("Message", "This message has been deleted.", [{ text: "Close" }]);
      return;
    }
    const buttons: Array<{ text: string; style?: "default" | "cancel" | "destructive"; onPress?: () => void }> = [
      { text: "Reply", onPress: () => setReplyingTo(message) },
    ];
    if (message.senderId === currentUserId) {
      buttons.push({
        text: "Edit",
        onPress: () => {
          setEditing(message);
          setReplyingTo(null);
          setText(message.content);
        },
      });
      buttons.push({
        text: "Delete",
        style: "destructive",
        onPress: () => void removeMessage(message),
      });
    }
    buttons.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Message actions", "Reply, edit, or delete this message.", buttons);
  };

  return (
    <View style={styles.chatScreen}>
      <View style={[styles.chatHeader, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Avatar user={other} size={40} />
        <View style={styles.flex}>
          <Text style={styles.userName}>{conversationName(conversation, currentUserId)}</Text>
          <Text style={styles.userHandle}>{conversation.isGroup ? conversation.members.length + " members" : "@" + (other?.username ?? "socialhub")}</Text>
        </View>
      </View>
      <KeyboardAvoidingView
        style={styles.chatKeyboard}
        behavior={Platform.OS === "android" ? "height" : "padding"}
        keyboardVerticalOffset={0}
      >
        {loading ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={styles.chatListFlex}
          contentContainerStyle={styles.chatList}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <Pressable
              onLongPress={() => messageActions(item)}
              style={[styles.messageBubble, item.senderId === currentUserId ? styles.myBubble : styles.theirBubble]}
            >
              {item.replyTo ? (
                <View style={styles.replyPreview}>
                  <Text style={styles.replyPreviewTitle}>Reply</Text>
                  <Text numberOfLines={2} style={styles.replyPreviewText}>{item.replyTo.content || "Message"}</Text>
                </View>
              ) : null}
              {item.attachments?.map((attachment) => (
                <Image key={attachment.id} source={{ uri: attachment.url }} style={styles.messageAttachment} resizeMode="cover" />
              ))}
              <Text style={styles.messageText}>{item.deletedAt ? "Message deleted" : item.content}</Text>
              <Text style={styles.messageTime}>{formatTime(item.createdAt)}{item.editedAt && !item.deletedAt ? " · edited" : ""}</Text>
            </Pressable>
          )}
          ListEmptyComponent={!loading ? <Text style={styles.emptySmall}>No messages yet. Start the conversation.</Text> : null}
        />
        {(replyingTo || editing) ? (
          <View style={styles.composeContext}>
            <View style={styles.flex}>
              <Text style={styles.composeContextTitle}>{editing ? "Editing message" : "Replying"}</Text>
              <Text numberOfLines={1} style={styles.composeContextText}>{(editing || replyingTo)?.content || "Message"}</Text>
            </View>
            <Pressable onPress={() => { setReplyingTo(null); setEditing(null); setText(""); }}>
              <Text style={styles.linkText}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={[styles.messageComposer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Pressable onPress={() => void sendAttachment()} disabled={attachmentBusy} style={styles.attachButton}>
            <Text style={styles.attachButtonText}>{attachmentBusy ? "…" : "+"}</Text>
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={editing ? "Edit message…" : "Type a message…"}
            placeholderTextColor={colors.muted}
            style={styles.messageInput}
            multiline
            blurOnSubmit={false}
          />
          <Pressable onPress={() => void send()} style={styles.sendButton}>
            <Text style={styles.sendButtonText}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function NotificationsScreen({ onMenu }: { onMenu: () => void }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ notifications: Notification[] }>("/api/notifications");
      setItems(data.notifications);
    } catch (e) {
      Alert.alert("Notifications", e instanceof Error ? e.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markAll = async () => {
    try {
      await apiFetch("/api/notifications", { method: "PATCH", body: JSON.stringify({ markAll: true }) });
      setItems((current) => current.map((item) => ({ ...item, readAt: new Date().toISOString() })));
    } catch (e) {
      Alert.alert("Notifications", e instanceof Error ? e.message : "Unable to mark notifications as read.");
    }
  };

  const markRead = async (item: Notification) => {
    if (item.readAt) return;
    try {
      await apiFetch("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ notificationId: item.id }),
      });
      setItems((current) => current.map((value) => value.id === item.id ? { ...value, readAt: new Date().toISOString() } : value));
    } catch (e) {
      Alert.alert("Notifications", e instanceof Error ? e.message : "Unable to mark notification as read.");
    }
  };

  const visible = filter === "UNREAD" ? items.filter((item) => !item.readAt) : items;

  return (
    <View style={styles.screen}>
      <AppHeader title="Notifications" subtitle="Stay up to date." onMenu={onMenu} action="Mark all" onAction={() => void markAll()} />
      <View style={styles.notificationFilters}>
        {["ALL", "UNREAD"].map((value) => (
          <Pressable
            key={value}
            onPress={() => setFilter(value === "UNREAD" ? "UNREAD" : "ALL")}
            style={[styles.visibilityChip, filter === value && styles.visibilityChipActive]}
          >
            <Text style={[styles.visibilityText, filter === value && styles.visibilityTextActive]}>
              {value === "ALL" ? "All" : "Unread"}
            </Text>
          </Pressable>
        ))}
      </View>
      {loading ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null}
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.feed}
        renderItem={({ item }) => (
          <Pressable onPress={() => void markRead(item)} style={[styles.notificationCard, !item.readAt && styles.unreadCard]}>
            <Avatar user={item.actor} size={42} />
            <View style={styles.flex}>
              <Text style={styles.notificationTitle}>{item.title || notificationLabel(item.type)}</Text>
              <Text style={styles.notificationBody}>{item.body || "You have a new SocialHub activity."}</Text>
              <Text style={styles.userHandle}>{formatTime(item.createdAt)}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>{filter === "UNREAD" ? "No unread notifications." : "No notifications yet."}</Text> : null}
      />
    </View>
  );
}

function notificationLabel(type: string) {
  switch (type) {
    case "LIKE": return "Someone liked your post";
    case "COMMENT": return "Someone commented on your post";
    case "FOLLOW": return "New follower";
    case "FRIEND_REQUEST": return "New friend request";
    case "FRIEND_ACCEPTED": return "Friend request accepted";
    case "MESSAGE": return "New message";
    case "MENTION": return "You were mentioned";
    case "STORY_REPLY": return "New story reply";
    case "STORY_REACTION": return "New story reaction";
    default: return "New SocialHub notification";
  }
}

function ProfileScreen({ onSignedOut, onMenu }: { onSignedOut: () => void; onMenu: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState<"image" | "coverImage" | null>(null);
  const [form, setForm] = useState({ name: "", username: "", bio: "" });

  const load = useCallback(async () => {
    try {
      const [profileData, postData] = await Promise.all([
        apiFetch<{ profile: Profile }>("/api/profile"),
        apiFetch<{ posts: Post[] }>("/api/posts?take=20&mode=LATEST"),
      ]);
      setProfile(profileData.profile);
      setForm({
        name: profileData.profile.name,
        username: profileData.profile.username ?? "",
        bio: profileData.profile.bio ?? "",
      });
      setPosts(postData.posts.filter((post) => post.author.id === profileData.profile.id));
    } catch (e) {
      Alert.alert("Profile", e instanceof Error ? e.message : "Unable to load profile.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const pickProfileMedia = async (field: "image" | "coverImage") => {
    setMediaBusy(field);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Profile", "Allow photo access to update your profile media.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
        allowsEditing: field === "image",
        aspect: field === "image" ? [1, 1] : [16, 9],
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const upload = await uploadMedia(asset.uri, asset.mimeType ?? "image/jpeg", asset.fileName ?? field + ".jpg");
      const data = await apiFetch<{ profile: Profile }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ [field]: upload.url }),
      });
      setProfile(data.profile);
    } catch (e) {
      Alert.alert("Profile", e instanceof Error ? e.message : "Unable to update profile media.");
    } finally {
      setMediaBusy(null);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const data = await apiFetch<{ profile: Profile }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          username: form.username.trim(),
          bio: form.bio.trim(),
        }),
      });
      setProfile(data.profile);
      setEditing(false);
    } catch (e) {
      Alert.alert("Profile", e instanceof Error ? e.message : "Unable to save profile.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await authClient.signOut();
    onSignedOut();
  };

  if (!profile) {
    return <View style={styles.screen}><ActivityIndicator color={colors.accent} style={styles.loader} /></View>;
  }

  return (
    <View style={styles.screen}>
      <AppHeader title="Profile" subtitle="Your Socialhub identity." onMenu={onMenu} action={editing ? "Cancel" : "Edit"} onAction={() => setEditing((value) => !value)} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileHero}>
          {profile.coverImage ? <Image source={{ uri: profile.coverImage }} style={styles.profileCover} resizeMode="cover" /> : null}
          <Avatar user={profile} size={86} />
          <Text style={styles.profileName}>{profile.name}</Text>
          <Text style={styles.userHandle}>@{profile.username ?? "socialhub"}</Text>
          {profile.bio ? <Text style={styles.profileBio}>{profile.bio}</Text> : null}
        </View>
        <View style={styles.statsGrid}>
          <Stat label="Posts" value={profile.visibleCounts.posts} />
          <Stat label="Followers" value={profile.visibleCounts.followers} />
          <Stat label="Following" value={profile.visibleCounts.following} />
          <Stat label="Views" value={profile.visibleCounts.profileViews} />
        </View>

        {editing ? (
          <View style={styles.editPanel}>
            <TextInput value={form.name} onChangeText={(name) => setForm((f) => ({ ...f, name }))} placeholder="Name" placeholderTextColor={colors.muted} style={styles.input} />
            <TextInput value={form.username} onChangeText={(username) => setForm((f) => ({ ...f, username }))} placeholder="Username" placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="none" />
            <TextInput value={form.bio} onChangeText={(bio) => setForm((f) => ({ ...f, bio }))} placeholder="Bio" placeholderTextColor={colors.muted} style={[styles.input, styles.bioInput]} multiline />
            <View style={styles.mediaEditRow}>
              <Pressable style={styles.mediaEditButton} disabled={mediaBusy !== null} onPress={() => void pickProfileMedia("image")}>
                <Text style={styles.mediaEditText}>{mediaBusy === "image" ? "Updating…" : "Change photo"}</Text>
              </Pressable>
              <Pressable style={styles.mediaEditButton} disabled={mediaBusy !== null} onPress={() => void pickProfileMedia("coverImage")}>
                <Text style={styles.mediaEditText}>{mediaBusy === "coverImage" ? "Updating…" : "Change cover"}</Text>
              </Pressable>
            </View>
            <PrimaryButton label={busy ? "Saving…" : "Save changes"} onPress={() => void save()} disabled={busy || mediaBusy !== null} />
          </View>
        ) : null}

        <SectionHeader title="Your recent posts" />
        {posts.map((post) => <PostCard key={post.id} post={post} onChanged={(next) => setPosts((current) => current.map((item) => item.id === next.id ? next : item))} />)}

        <PrimaryButton label="Sign out" onPress={() => void signOut()} secondary />
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{formatCount(value)}</Text>
      <Text style={styles.userHandle}>{label}</Text>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <RootContent />
    </SafeAreaProvider>
  );
}

type DeepLinkTarget =
  | { kind: "post"; id: string }
  | { kind: "story"; id: string }
  | { kind: "message"; id: string }
  | { kind: "profile"; id: string };

function RootContent() {
  const insets = useSafeAreaInsets();
  const [booting, setBooting] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("Home");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hideBottomNav, setHideBottomNav] = useState(false);
  const [unread, setUnread] = useState({ messages: 0, notifications: 0, friendRequests: 0 });
  const [deepLink, setDeepLink] = useState<DeepLinkTarget | null>(null);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [showPermissionOnboarding, setShowPermissionOnboarding] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      const session = await authClient.getSession();
      const user = session.data?.user as User | undefined;
      if (!user) {
        setSessionUser(null);
        setSignedIn(false);
        return;
      }
      let enrichedUser: User = user;
      try {
        const profile = await apiFetch<{ profile: User }>("/api/profile");
        enrichedUser = { ...user, ...profile.profile };
      } catch {
        // Preserve the authenticated Better Auth identity when profile enrichment is unavailable.
      }
      setSessionUser(enrichedUser);
      setSignedIn(true);
    } catch {
      setSessionUser(null);
      setSignedIn(false);
    } finally {
      setBooting(false);
    }
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!signedIn) return;
    try {
      const data = await apiFetch<{ messages: number; notifications: number; friendRequests: number }>("/api/unread-summary");
      setUnread(data);
    } catch {}
  }, [signedIn]);

  const parseDeepLink = useCallback((url: string) => {
    try {
      const parsed = Linking.parse(url);
      const rawPath = parsed.path ?? "";
      const parts = [parsed.hostname ?? "", ...rawPath.split("/").filter(Boolean)].filter(Boolean);
      const kind = (parts[0] ?? "").toLowerCase();
      const id = parts[1] ?? "";
      if (!id) return;
      if (["post", "posts"].includes(kind)) setDeepLink({ kind: "post", id });
      else if (["story", "stories"].includes(kind)) setDeepLink({ kind: "story", id });
      else if (["message", "messages", "conversation", "conversations"].includes(kind)) setDeepLink({ kind: "message", id });
      else if (["profile", "user", "users"].includes(kind)) setDeepLink({ kind: "profile", id });
    } catch {}
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => parseDeepLink(url));
    void Linking.getInitialURL().then((url) => {
      if (url) parseDeepLink(url);
    });
    return () => subscription.remove();
  }, [parseDeepLink]);

  useEffect(() => {
    if (!signedIn || !deepLink) return;
    if (deepLink.kind === "message") setTab("Messages");
    else if (deepLink.kind === "profile") setTab("Discover");
    else setTab("Home");
  }, [signedIn, deepLink]);

  const onDeepLinkHandled = useCallback(() => setDeepLink(null), []);

  useEffect(() => {
    configurePushNotifications();
    const subscription = subscribeToNotificationOpen(parseDeepLink);
    return () => subscription.remove();
  }, [parseDeepLink]);

  useEffect(() => {
    if (!signedIn) return;
    return startPresenceHeartbeat();
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) return;
    return startRealtime();
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) return;
    return subscribeRealtime(() => {
      void refreshUnread();
    });
  }, [signedIn, refreshUnread]);

  useEffect(() => { void refreshSession(); }, [refreshSession]);

  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(PERMISSION_ONBOARDING_KEY)
      .then((value) => {
        if (!active) return;
        setShowPermissionOnboarding(!value);
        setPermissionsReady(true);
      })
      .catch(() => {
        if (!active) return;
        setShowPermissionOnboarding(true);
        setPermissionsReady(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!booting) void SplashScreen.hideAsync().catch(() => {});
  }, [booting]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (drawerOpen) { setDrawerOpen(false); return true; }
      if (!hideBottomNav && tab !== "Home") { setTab("Home"); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [booting, drawerOpen, hideBottomNav, tab]);
  useEffect(() => {
    if (!signedIn) return;
    void refreshUnread();
    const timer = setInterval(() => void refreshUnread(), 20_000);
    return () => clearInterval(timer);
  }, [signedIn, refreshUnread]);

  const navigate = useCallback((route: MobileRoute) => {
    if (route === "Admin" && !sessionUser?.isOwner) return;
    setHideBottomNav(false);
    setTab(route);
  }, [sessionUser?.isOwner]);

  const signOut = useCallback(async () => {
    await unregisterPushDevice();
    await authClient.signOut();
    setDrawerOpen(false);
    setSignedIn(false);
    setSessionUser(null);
    setTab("Home");
  }, []);

  if (booting || !permissionsReady) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.accent} /></View>
      </View>
    );
  }

  if (!signedIn) {
    return (
      <>
        <AuthScreen onSignedIn={() => void refreshSession()} />
        <PermissionOnboarding
          visible={showPermissionOnboarding}
          onDone={() => {
            setShowPermissionOnboarding(false);
            void SecureStore.setItemAsync(PERMISSION_ONBOARDING_KEY, "completed");
          }}
        />
      </>
    );
  }

  const badge = (value: number) => value > 0 ? (
    <View style={styles.badge}><Text style={styles.badgeText}>{formatCount(value)}</Text></View>
  ) : null;

  const openMenu = () => setDrawerOpen(true);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {tab === "Home" ? (
        <HomeScreen
          onMenu={openMenu}
          initialPostId={deepLink?.kind === "post" ? deepLink.id : undefined}
          initialStoryId={deepLink?.kind === "story" ? deepLink.id : undefined}
          onDeepLinkHandled={onDeepLinkHandled}
        />
      ) : null}
      {tab === "Discover" ? (
        <DiscoverScreen
          onMenu={openMenu}
          initialQuery={deepLink?.kind === "profile" ? deepLink.id : undefined}
          onDeepLinkHandled={onDeepLinkHandled}
        />
      ) : null}
      {tab === "Friends" ? <FriendsScreen onMenu={openMenu} /> : null}
      {tab === "Messages" && sessionUser ? (
        <MessagingScreen
          currentUserId={sessionUser.id}
          onMenu={openMenu}
          onChildStateChange={setHideBottomNav}
          initialConversationId={deepLink?.kind === "message" ? deepLink.id : undefined}
          onDeepLinkHandled={onDeepLinkHandled}
        />
      ) : null}
      {tab === "Notifications" ? <NotificationsScreen onMenu={openMenu} /> : null}
      {tab === "Profile" ? <ProfileScreen onMenu={openMenu} onSignedOut={() => { setSignedIn(false); setSessionUser(null); }} /> : null}
      {tab === "Settings" ? <SettingsScreen onMenu={openMenu} isOwner={Boolean(sessionUser?.isOwner)} onOpenAdmin={() => navigate("Admin")} onSignedOut={() => { setSignedIn(false); setSessionUser(null); }} /> : null}
      {tab === "Saved" ? <SavedScreen onMenu={openMenu} /> : null}
      {tab === "Security" ? <SecurityScreen onMenu={openMenu} /> : null}
      {tab === "Admin" && sessionUser?.isOwner ? <AdminScreen onMenu={openMenu} /> : null}

      {!hideBottomNav ? (
        <View style={[styles.bottomNav, { bottom: Math.max(insets.bottom + 8, 10) }]}>
          <NavItem icon="⌂" label="Home" active={tab === "Home"} onPress={() => navigate("Home")} />
          <NavItem icon="♧" label="Friends" active={tab === "Friends"} onPress={() => navigate("Friends")} badge={badge(unread.friendRequests)} />
          <NavItem icon="✉" label="Messages" active={tab === "Messages"} onPress={() => navigate("Messages")} badge={badge(unread.messages)} />
          <NavItem icon="♡" label="Alerts" active={tab === "Notifications"} onPress={() => navigate("Notifications")} badge={badge(unread.notifications)} />
          <NavItem icon="◉" label="Profile" active={tab === "Profile"} onPress={() => navigate("Profile")} />
        </View>
      ) : null}

      <MenuDrawer
        visible={drawerOpen}
        route={tab}
        userName={sessionUser?.name}
        onClose={() => setDrawerOpen(false)}
        onNavigate={navigate}
        onSignOut={() => void signOut()}
      />
    </View>
  );
}

function NavItem({
  icon,
  label,
  active,
  onPress,
  badge,
}: {
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={styles.navItem}>
      <View>
        <Text style={[styles.navIcon, active && styles.navActive]}>{icon}</Text>
        {badge ? <View style={styles.navBadge}>{badge}</View> : null}
      </View>
      <Text style={[styles.navLabel, active && styles.navActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  authScreen: { flex: 1, backgroundColor: colors.bg },
  authContent: { flexGrow: 1, justifyContent: "center", padding: 24, paddingBottom: 40 },
  logo: { width: 86, height: 86, borderRadius: 28, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", alignSelf: "center", overflow: "hidden" },
  logoImage: { width: 86, height: 86 },
  logoLetter: { color: "#fff", fontSize: 42, fontWeight: "900" },
  authBrand: { color: colors.text, fontSize: 34, fontWeight: "900", textAlign: "center", marginTop: 16 },
  authSubtitle: { color: colors.muted, textAlign: "center", marginTop: 6, marginBottom: 24, fontSize: 15 },
  authRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  authSwitch: { color: colors.muted, textAlign: "center", marginTop: 18 },
  input: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, color: colors.text, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 14, marginBottom: 12 },
  primaryButton: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent, paddingHorizontal: 16, marginTop: 6 },
  secondaryButton: { backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border },
  disabledButton: { opacity: 0.55 },
  primaryButtonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  successText: { color: colors.success, marginBottom: 10 },
  errorText: { color: colors.danger, marginBottom: 10 },
  dangerText: { color: colors.danger },
  linkText: { color: "#a99cff", fontWeight: "700" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  subtitle: { color: colors.muted, marginTop: 3 },
  refresh: { color: colors.text, fontSize: 30 },
  loader: { marginVertical: 18 },
  feed: { padding: 12, paddingBottom: 155 },
  scrollContent: { padding: 14, paddingBottom: 155 },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: 60 },
  emptySmall: { color: colors.muted, textAlign: "center", paddingVertical: 20 },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center" },
  avatarFallback: { backgroundColor: "#2a2937", alignItems: "center", justifyContent: "center", marginRight: 10 },
  avatarInitial: { color: "#fff", fontSize: 18, fontWeight: "900" },
  userName: { color: colors.text, fontWeight: "800", fontSize: 15 },
  userHandle: { color: colors.muted, marginTop: 3, fontSize: 12 },
  muted: { color: colors.muted, fontSize: 12 },
  postCard: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 14, marginBottom: 12 },
  postText: { color: colors.text, fontSize: 16, lineHeight: 23, marginTop: 12 },
  postMedia: { width: "100%", height: 260, borderRadius: 15, marginTop: 12, backgroundColor: colors.panel2 },
  metricsRow: { flexDirection: "row", gap: 18, paddingTop: 12, paddingBottom: 8 },
  actionRow: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  actionButton: { flex: 1, paddingVertical: 8, alignItems: "center" },
  actionText: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  activeAction: { color: colors.accent },
  composer: { backgroundColor: colors.panel, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 12 },
  composerInput: { minHeight: 80, color: colors.text, textAlignVertical: "top", padding: 4 },
  composerActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  visibilityRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  visibilityChip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border },
  visibilityChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  visibilityText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  visibilityTextActive: { color: colors.text },
  mediaPickerButton: { paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.panel2 },
  selectedMedia: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: colors.panel2 },
  storyTray: { flexDirection: "row", paddingVertical: 10, marginBottom: 2 },
  storyItem: { width: 76, alignItems: "center", marginRight: 8 },
  storyCreate: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel2, alignItems: "center", justifyContent: "center" },
  storyCreateText: { color: colors.text, fontSize: 30, lineHeight: 32 },
  storyRing: { width: 68, height: 68, borderRadius: 34, padding: 3, alignItems: "center", justifyContent: "center", backgroundColor: "#32323e" },
  storyRingUnread: { backgroundColor: colors.accent },
  storyLabel: { color: colors.muted, fontSize: 11, marginTop: 5, maxWidth: 70 },
  storyModal: { flex: 1, backgroundColor: "#050507" },
  storyTop: { flexDirection: "row", alignItems: "center", padding: 16, gap: 10 },
  closeText: { color: colors.text, fontSize: 22, fontWeight: "700", padding: 6 },
  storyViewerName: { color: colors.text, fontWeight: "800", fontSize: 15 },
  storyMediaArea: { flex: 1, position: "relative", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  storyMedia: { width: "100%", height: "68%" },
  storyTapLeft: { position: "absolute", top: 0, bottom: 0, left: 0, width: "35%" },
  storyTapRight: { position: "absolute", top: 0, bottom: 0, right: 0, width: "35%" },
  videoPlaceholder: { alignItems: "center", justifyContent: "center", gap: 8, padding: 30 },
  videoIcon: { color: colors.text, fontSize: 54 },
  videoText: { color: colors.text, fontSize: 20, fontWeight: "800" },
  storyBottom: { padding: 14, borderTopWidth: 1, borderTopColor: colors.border },
  storyCaption: { color: colors.text, marginBottom: 10, lineHeight: 20 },
  reactionsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  reactionChip: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel2, alignItems: "center", justifyContent: "center" },
  reactionText: { fontSize: 19 },
  reactionMenuButton: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel2 },
  reactionPicker: { flexDirection: "row", gap: 7, marginTop: 10, padding: 8, borderRadius: 15, backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border },
  reactionPickerItem: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel },
  reactionPickerEmoji: { fontSize: 20 },
  reactionSummary: { color: colors.muted, fontSize: 12, marginTop: 10 },
  commentOverlay: { flex: 1, justifyContent: "flex-end" },
  commentScrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.62)" },
  commentSheet: { height: "72%", backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.border, paddingBottom: 8 },
  commentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  commentList: { padding: 14, gap: 10 },
  commentRow: { flexDirection: "row", gap: 8, backgroundColor: colors.panel, borderRadius: 15, padding: 10 },
  commentAuthor: { color: colors.text, fontSize: 12, fontWeight: "900" },
  commentBody: { color: colors.text, fontSize: 13, lineHeight: 18, marginTop: 3 },
  commentComposer: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.panel },
  commentInput: { flex: 1, minHeight: 46, maxHeight: 110, color: colors.text, backgroundColor: colors.panel2, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11, textAlignVertical: "top" },
  storyReplyInput: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 16, color: colors.text, paddingHorizontal: 14, paddingVertical: 12 },
  storyStats: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  sheet: { flex: 1, backgroundColor: colors.bg, marginTop: 80, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.border },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
  sheetContent: { padding: 16, gap: 12, paddingBottom: 40 },
  previewMedia: { width: "100%", height: 320, borderRadius: 18 },
  videoPreview: { width: "100%", height: 220, backgroundColor: colors.panel2, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  searchInput: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 16, color: colors.text, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 18 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  userCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.panel, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 10 },
  miniButton: { backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11 },
  miniButtonText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  conversationCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 12, marginBottom: 10 },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  chatScreen: { flex: 1, backgroundColor: colors.bg },
  chatKeyboard: { flex: 1, backgroundColor: colors.bg },
  chatListFlex: { flex: 1 },
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  backText: { color: colors.text, fontSize: 38, lineHeight: 38, paddingHorizontal: 6 },
  chatList: { padding: 12, gap: 8, paddingBottom: 14 },
  messageBubble: { maxWidth: "82%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  myBubble: { alignSelf: "flex-end", backgroundColor: colors.accent },
  theirBubble: { alignSelf: "flex-start", backgroundColor: colors.panel2 },
  messageText: { color: "#fff", lineHeight: 20 },
  messageTime: { color: "rgba(255,255,255,0.58)", fontSize: 10, marginTop: 4, alignSelf: "flex-end" },
  messageAttachment: { width: 190, height: 150, borderRadius: 13, marginBottom: 7, backgroundColor: colors.panel },
  replyPreview: { borderLeftWidth: 3, borderLeftColor: colors.accent, paddingLeft: 8, marginBottom: 7 },
  replyPreviewTitle: { color: "#c5bcff", fontSize: 10, fontWeight: "900" },
  replyPreviewText: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 },
  composeContext: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.panel2, borderTopWidth: 1, borderTopColor: colors.border },
  composeContextTitle: { color: colors.accent, fontSize: 11, fontWeight: "900" },
  composeContextText: { color: colors.text, fontSize: 12, marginTop: 2 },
  attachButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.panel2, alignItems: "center", justifyContent: "center" },
  attachButtonText: { color: colors.text, fontSize: 24, fontWeight: "700" },
  messageComposer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.panel, minHeight: 70 },
  messageInput: { flex: 1, minHeight: 52, maxHeight: 140, color: colors.text, backgroundColor: colors.panel2, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 12, textAlignVertical: "top" },
  sendButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  sendButtonText: { color: "#fff", fontSize: 20, fontWeight: "900" },
  notificationFilters: { flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingTop: 10 },
  notificationCard: { flexDirection: "row", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 12, marginBottom: 10 },
  unreadCard: { borderColor: colors.accent, backgroundColor: "#151122" },
  notificationTitle: { color: colors.text, fontWeight: "800" },
  notificationBody: { color: colors.muted, marginTop: 4, lineHeight: 18 },
  profileHero: { alignItems: "center", paddingVertical: 18 },
  profileCover: { width: "100%", height: 150, borderRadius: 18, marginBottom: -26, backgroundColor: colors.panel2 },
  profileName: { color: colors.text, fontSize: 24, fontWeight: "900", marginTop: 10 },
  profileBio: { color: colors.muted, textAlign: "center", marginTop: 8, maxWidth: 320, lineHeight: 20 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  statCard: { flexGrow: 1, flexBasis: "22%", minWidth: 74, alignItems: "center", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, paddingVertical: 13, borderRadius: 14 },
  statValue: { color: colors.text, fontSize: 18, fontWeight: "900" },
  editPanel: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 12, marginBottom: 10 },
  mediaEditRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  mediaEditButton: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border },
  mediaEditText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  bioInput: { minHeight: 100, textAlignVertical: "top" },
  bottomNav: { position: "absolute", left: 12, right: 12, height: 72, backgroundColor: "#15151d", borderWidth: 1, borderColor: colors.border, borderRadius: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  navItem: { minWidth: 55, alignItems: "center", justifyContent: "center" },
  navIcon: { color: colors.muted, fontSize: 22, marginBottom: 2 },
  navLabel: { color: colors.muted, fontSize: 10 },
  navActive: { color: colors.text, fontWeight: "900" },
  navBadge: { position: "absolute", top: -6, right: -12 },
});
