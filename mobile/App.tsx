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
import { AppHeader, DetailHeader, MenuDrawer, type MobileRoute } from "./components/MobileShell";
import FriendsScreen from "./screens/FriendsScreen";
import SettingsScreen from "./screens/SettingsScreen";
import SavedScreen from "./screens/SavedScreen";
import SecurityScreen from "./screens/SecurityScreen";
import AdminScreen from "./screens/AdminScreen";
import CallsScreen from "./screens/CallsScreen";
import VideoMedia from "./components/VideoMedia";
import { Share } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import PermissionOnboarding from "./components/PermissionOnboarding";
import LaunchScreen from "./components/LaunchScreen";
import { BrandMark } from "./components/BrandMark";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./theme";
import CallScreen, { IncomingCallPrompt, type NativeCall } from "./components/CallScreen";
import InCallManager from "react-native-incall-manager";
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

const PERMISSION_ONBOARDING_KEY = "socialhub:permissions-intro:v2";

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
  loading = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, secondary && styles.secondaryButton, disabled && styles.disabledButton]}
    >
      {loading ? <ActivityIndicator color={secondary ? colors.text : "#fff"} /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

function AuthScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const insets = useSafeAreaInsets();
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
    <View style={[styles.authScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
        <BrandMark size={96} style={styles.authBrandMark} />
        <Text style={styles.authBrand}>Socialhub</Text>
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
            <PrimaryButton label="Sign in" onPress={() => void signIn()} disabled={busy} loading={busy} />
            <PrimaryButton label="Continue with Google" onPress={() => void google()} disabled={busy} loading={busy} secondary />
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
            <PrimaryButton label="Create account" onPress={() => void signUp()} disabled={busy} loading={busy} />
            <Pressable onPress={() => { resetMessages(); setMode("signin"); }}>
              <Text style={styles.authSwitch}>Already have an account? <Text style={styles.linkText}>Sign in</Text></Text>
            </Pressable>
          </>
        ) : null}

        {mode === "forgot" ? (
          <>
            <PrimaryButton label="Send reset code" onPress={() => void requestReset()} disabled={busy} loading={busy} />
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
              loading={busy}
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
    </View>
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
  const insets = useSafeAreaInsets();
  const reactions = Array.isArray(post.reactions) ? post.reactions : [];
  const displayCounts = post.displayCounts ?? { likes: 0, comments: 0, shares: 0 };

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
      const nextCounts = reactions.map((item) => ({ ...item }));
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
        {reactions.length ? <Text style={styles.reactionSummary}>{reactions.filter(r => r.count > 0).map(r => `${r.emoji} ${formatCount(r.count)}`).join("  ")}</Text> : null}
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
        <KeyboardAvoidingView style={styles.commentOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top}>
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
            <View style={[styles.commentComposer, { paddingBottom: Math.max(insets.bottom, 10) }]}><TextInput value={commentText} onChangeText={setCommentText} placeholder="Write a comment…" placeholderTextColor={colors.muted} style={styles.commentInput} multiline/><Pressable onPress={() => void sendComment()} style={styles.sendButton}><Text style={styles.sendButtonText}>➤</Text></Pressable></View>
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
        <PrimaryButton label={busy ? "Posting…" : "Post"} onPress={() => void submit()} disabled={busy || (!content.trim() && !asset)} loading={busy} />
      </View>
    </View>
  );
}

function StoryCreate({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
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
      <View style={[styles.sheet, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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
          <PrimaryButton label={busy ? "Publishing…" : "Publish story"} onPress={() => void submit()} disabled={busy || !asset} loading={busy} />
        </ScrollView>
      </View>
    </Modal>
  );
}
\n\nfunction HomeScreen({
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
  const [feedMode, setFeedMode] = useState<"FOR_YOU" | "FOLLOWING" | "FRIENDS" | "LATEST" | "SAVED">("FOR_YOU");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const query = new URLSearchParams({ take: "20", mode: feedMode });
      const [postData, storyData] = await Promise.all([
        apiFetch<{ posts?: Post[] }>("/api/" + (feedMode === "FOR_YOU" ? "feed/recommended?take=20" : "posts?" + query.toString())),
        apiFetch<{ stories?: Story[] }>("/api/stories"),
      ]);
      setPosts(postData.posts ?? []);
      setStories(storyData.stories ?? []);
    } catch (e) {
      Alert.alert("Feed", e instanceof Error ? e.message : "Unable to load your feed.");
      if (!isRefresh) {
        setPosts([]);
        setStories([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [feedMode]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const unsubscribe = subscribeRealtime((event) => {
      if (event.type === "message.created" || event.type === "post.created") void load(true);
    });
    return () => unsubscribe();
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
      <View style={styles.feedModeRow}>
        {[
          ["FOR_YOU", "For You"],
          ["FOLLOWING", "Following"],
          ["FRIENDS", "Friends"],
          ["LATEST", "Latest"],
          ["SAVED", "Saved"],
        ].map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setFeedMode(value as typeof feedMode)}
            style={[styles.feedModeChip, feedMode === value && styles.feedModeChipActive]}
            accessibilityRole="button"
          >
            <Text style={[styles.feedModeText, feedMode === value && styles.feedModeTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

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
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No posts to show here yet.</Text> : null}
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
\nfunction DiscoverScreen({
  onMenu,
  initialQuery,
  onDeepLinkHandled,
  onOpenProfile,
}: {
  onMenu: () => void;
  initialQuery?: string;
  onDeepLinkHandled: () => void;
  onOpenProfile: (usernameOrId: string) => void;
}) {
  type HashtagResult = { tag: string; count?: number };
  type Trend = { tag: string; posts: number };

  const [query, setQuery] = useState(initialQuery ?? "");
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [hashtags, setHashtags] = useState<HashtagResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchUser[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHome, setLoadingHome] = useState(true);

  const loadExplore = useCallback(async () => {
    setLoadingHome(true);
    try {
      const [people, trendData] = await Promise.all([
        apiFetch<{ users?: SearchUser[] }>("/api/users?suggestions=true&take=8"),
        apiFetch<{ trends?: Trend[] }>("/api/discover/trends"),
      ]);
      setSuggestions((people.users ?? []).filter((u) => !u.isFriend && !u.isFollowing && (u.friendRequestStatus ?? "NONE") === "NONE"));
      setTrends(trendData.trends ?? []);
    } catch {
      setSuggestions([]);
      setTrends([]);
    } finally {
      setLoadingHome(false);
    }
  }, []);

  const search = useCallback(async (value: string) => {
    const term = value.trim();
    if (!term) {
      setUsers([]);
      setPosts([]);
      setHashtags([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{ users?: SearchUser[]; posts?: Post[]; hashtags?: HashtagResult[] }>(
        `/api/search?q=${encodeURIComponent(term)}&take=20`,
      );
      setUsers(data.users ?? []);
      setPosts(data.posts ?? []);
      setHashtags(data.hashtags ?? []);
    } catch (e) {
      setUsers([]);
      setPosts([]);
      setHashtags([]);
      Alert.alert("Discover", e instanceof Error ? e.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExplore();
  }, [loadExplore]);

  useEffect(() => {
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery);
      onDeepLinkHandled();
    }
  }, [initialQuery, query, onDeepLinkHandled]);

  useEffect(() => {
    const timeout = query.trim() ? setTimeout(() => void search(query), 260) : null;
    return () => {
      if (timeout) clearTimeout(timeout);
    };
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
      } else if (user.canSendFriendRequest) {
        await apiFetch("/api/friend-requests", {
          method: "POST",
          body: JSON.stringify({ receiverId: user.id }),
        });
      }
      await search(query);
      await loadExplore();
    } catch (e) {
      Alert.alert("Friends", e instanceof Error ? e.message : "Unable to update friendship.");
    }
  };

  const personCard = (user: SearchUser, suggested = false) => (
    <Pressable
      key={user.id}
      style={styles.userCard}
      onPress={() => onOpenProfile(user.username ?? user.id)}
    >
      <Avatar user={user} size={50} />
      <View style={styles.flex}>
        <View style={styles.row}>
          <Text numberOfLines={1} style={styles.userName}>{user.name}</Text>
          {user.isVerified ? <Ionicons name="checkmark-circle" size={14} color={colors.accentBright} /> : null}
        </View>
        <Text numberOfLines={1} style={styles.userHandle}>
          @{user.username ?? "socialhub"} · {formatCount(user.displayCounts?.followers ?? 0)} followers
        </Text>
        {user.bio ? <Text numberOfLines={1} style={styles.muted}>{user.bio}</Text> : null}
      </View>
      {!suggested && user.isFriend ? (
        <Text style={styles.successText}>Friends</Text>
      ) : !suggested && user.friendRequestStatus === "OUTGOING_PENDING" ? (
        <Text style={styles.muted}>Pending</Text>
      ) : !suggested && user.friendRequestStatus === "INCOMING_PENDING" ? (
        <Pressable style={styles.miniButton} onPress={(event) => { event.stopPropagation(); void friendRequest(user); }}>
          <Text style={styles.miniButtonText}>Accept</Text>
        </Pressable>
      ) : user.canSendFriendRequest ? (
        <Pressable style={styles.miniButton} onPress={(event) => { event.stopPropagation(); void friendRequest(user); }}>
          <Text style={styles.miniButtonText}>Add</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <AppHeader title="Discover" subtitle="People, posts, hashtags and trends." onMenu={onMenu} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.discoverHero}>
          <View style={styles.discoverHeroRow}>
            <View style={styles.discoverHeroBadge}><Ionicons name="sparkles-outline" size={16} color={colors.accentBright} /></View>
            <Text style={styles.discoverEyebrow}>DISCOVER</Text>
          </View>
          <Text style={styles.discoverTitle}>Find your people</Text>
          <Text style={styles.discoverSubtitle}>Explore creators, conversations and topics worth following.</Text>
        </View>

        <View style={styles.discoverSearchWrap}>
          <Ionicons name="search" size={19} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search people, usernames, posts or #hashtags"
            placeholderTextColor={colors.muted}
            style={styles.discoverSearchInput}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} style={styles.discoverClear}>
              <Ionicons name="close" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {loading || loadingHome ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null}

        {!query.trim() ? (
          <>
            <SectionHeader title="Suggested for you" action="Refresh" onAction={() => void loadExplore()} />
            {suggestions.length ? suggestions.slice(0, 6).map((user) => personCard(user, true)) : (
              <View style={styles.discoverEmptyCard}>
                <Ionicons name="compass-outline" size={30} color={colors.accent} />
                <Text style={styles.discoverEmptyTitle}>Your discovery space is ready</Text>
                <Text style={styles.emptySmall}>Search for a person, post or hashtag to start exploring.</Text>
              </View>
            )}

            <SectionHeader title="Trending now" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendRow}>
              {trends.length ? trends.map((trend) => (
                <Pressable key={trend.tag} style={styles.trendChip} onPress={() => setQuery(trend.tag)}>
                  <Text style={styles.trendRank}>#{trends.indexOf(trend) + 1}</Text>
                  <Text style={styles.trendTag}>{trend.tag}</Text>
                  <Text style={styles.trendCount}>{trend.posts}</Text>
                </Pressable>
              )) : (
                <View style={styles.trendEmpty}><Text style={styles.muted}>No active trends yet.</Text></View>
              )}
            </ScrollView>
          </>
        ) : (
          <>
            <SectionHeader title="People" action={`${users.length} results`} />
            {users.length ? users.map((user) => personCard(user)) : <Text style={styles.emptySmall}>No people found.</Text>}

            <SectionHeader title="Posts" action={`${posts.length} results`} />
            {posts.length ? posts.map((post) => (
              <PostCard key={post.id} post={post} onChanged={(next) => setPosts((items) => items.map((item) => item.id === next.id ? next : item))} />
            )) : <Text style={styles.emptySmall}>No matching posts found.</Text>}

            <SectionHeader title="Hashtags" action={`${hashtags.length} results`} />
            {hashtags.length ? hashtags.map((item) => (
              <Pressable key={item.tag} style={styles.hashtagCard} onPress={() => setQuery(item.tag)}>
                <View style={styles.hashtagIcon}><Ionicons name="pricetag-outline" size={18} color={colors.accentBright} /></View>
                <View style={styles.flex}>
                  <Text style={styles.hashtagTag}>{item.tag}</Text>
                  <Text style={styles.muted}>{item.count ?? 0} matching posts</Text>
                </View>
                <Ionicons name="chevron-forward" size={19} color={colors.muted} />
              </Pressable>
            )) : <Text style={styles.emptySmall}>No matching hashtags found.</Text>}
          </>
        )}
      </ScrollView>
    </View>
  );
}
\n\nfunction CallOverlay({ currentUserId }: { currentUserId: string }) {
  const [incoming, setIncoming] = useState<NativeCall | null>(null);
  const [active, setActive] = useState<NativeCall | null>(null);
  const [activeIsIncoming, setActiveIsIncoming] = useState(false);
  const incomingRef = useRef<NativeCall | null>(null);
  const activeRef = useRef<NativeCall | null>(null);

  useEffect(() => { incomingRef.current = incoming; }, [incoming]);
  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    const unsubscribe = subscribeRealtime((event) => {
      if (event.type === "call.incoming" && event.entityId && !activeRef.current && !incomingRef.current) {
        void apiFetch<{ call: NativeCall }>(`/api/calls/${event.entityId}`)
          .then((data) => {
            if (data.call.calleeId !== currentUserId || data.call.status !== "RINGING") return;
            setIncoming(data.call);
          })
          .catch(() => {});
      }

      if (event.type === "call.updated" && event.entityId) {
        const nextStatus = String(event.payload?.status ?? "");
        if (incomingRef.current?.id === event.entityId && ["DECLINED", "MISSED", "ENDED", "CANCELLED", "ACTIVE"].includes(nextStatus)) {
          setIncoming(null);
          if (nextStatus === "ACTIVE") {
            void apiFetch<{ call: NativeCall }>(`/api/calls/${event.entityId}`)
              .then((data) => {
                if (data.call.status === "ACTIVE") {
                  setActive(data.call);
                  setActiveIsIncoming(true);
                }
              })
              .catch(() => {});
          }
        }
        if (activeRef.current?.id === event.entityId && ["DECLINED", "MISSED", "ENDED", "CANCELLED"].includes(nextStatus)) {
          setActive(null);
        }
      }
    });
    return unsubscribe;
  }, [currentUserId]);

  useEffect(() => {
    if (!incoming) {
      try { InCallManager.stopRingtone(); } catch {}
      return;
    }
    try { InCallManager.startRingtone("_DEFAULT_"); } catch {}
    return () => {
      try { InCallManager.stopRingtone(); } catch {}
    };
  }, [incoming?.id]);

  if (active) {
    const remoteUser = active.callerId === currentUserId ? active.callee : active.caller;
    if (!remoteUser) return null;
    return (
      <View style={StyleSheet.absoluteFill}>
        <CallScreen
          call={active}
          currentUserId={currentUserId}
          remoteUser={remoteUser}
          incoming={false}
          incoming={activeIsIncoming}
          onFinished={() => { setActive(null); setActiveIsIncoming(false); }}
        />
      </View>
    );
  }

  if (!incoming || !incoming.caller) return null;

  const accept = async () => {
    try {
      await apiFetch(`/api/calls/${incoming.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "accept" }),
      });
      try { InCallManager.stopRingtone(); } catch {}
      setIncoming(null);
      setActive(incoming);
      setActiveIsIncoming(true);
    } catch (error) {
      Alert.alert("Call", error instanceof Error ? error.message : "Unable to accept the call.");
    }
  };

  const decline = async () => {
    try {
      await apiFetch(`/api/calls/${incoming.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "decline" }),
      });
    } catch {}
    try { InCallManager.stopRingtone(); } catch {}
    setIncoming(null);
  };

  return (
    <IncomingCallPrompt
      call={incoming}
      caller={incoming.caller}
      onAccept={() => void accept()}
      onDecline={() => void decline()}
    />
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
  const [conversationQuery, setConversationQuery] = useState("");

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
        title="Messages"
        subtitle={includeArchived ? "Archived conversations." : "Your private conversations."}
        onMenu={onMenu}
        action={includeArchived ? "Active" : "Archived"}
        onAction={() => setIncludeArchived((value) => !value)}
      />
      <View style={styles.messageListToolbar}>
        <TextInput
          value={conversationQuery}
          onChangeText={setConversationQuery}
          placeholder="Search conversations…"
          placeholderTextColor={colors.muted}
          style={styles.messageSearchInput}
        />
      </View>
      {loading ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null}
      <FlatList
        data={conversations.filter((item) => {
          const memberName = conversationName(item, currentUserId).toLowerCase();
          const preview = item.messages?.[0]?.content?.toLowerCase() ?? "";
          const q = conversationQuery.trim().toLowerCase();
          return !q || memberName.includes(q) || preview.includes(q);
        })}
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
              <Avatar user={member} size={56} />
              <View style={styles.flex}>
                <View style={styles.conversationTopRow}>
                  <Text numberOfLines={1} style={styles.conversationName}>{conversationName(item, currentUserId)}</Text>
                  {last?.createdAt ? <Text style={styles.conversationTime}>{formatTime(last.createdAt)}</Text> : null}
                </View>
                <View style={styles.conversationPreviewRow}>
                  <Text numberOfLines={1} style={styles.conversationPreview}>{last?.content || "Start the conversation"}</Text>
                  {item.unreadCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{formatCount(item.unreadCount)}</Text></View> : null}
                </View>
                {me?.archivedAt ? <Text style={styles.archivedLabel}>ARCHIVED</Text> : null}
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
  const [typingUsers, setTypingUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [activeCall, setActiveCall] = useState<NativeCall | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const other = conversation.members.find((member) => member.userId !== currentUserId)?.user;
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Message>>(null);
  const draftKey = "socialhub:message-draft:" + conversation.id;

  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(draftKey).then((draft) => {
      if (active && draft) setText(draft);
    }).catch(() => {});
    return () => { active = false; };
  }, [draftKey]);

  const reactToMessage = async (messageId: string, emoji = "❤️") => {
    const current = messages.find((message) => message.id === messageId);
    const existing = current?.reactions?.find((reaction) => reaction.userId === currentUserId);
    try {
      const data = await apiFetch<{ reaction?: { id: string; emoji: string; userId: string } }>(
        "/api/messages/" + messageId + "/reaction",
        existing
          ? { method: "DELETE" }
          : { method: "POST", body: JSON.stringify({ emoji }) },
      );
      setMessages((items) => items.map((message) => {
        if (message.id !== messageId) return message;
        const reactions = message.reactions ?? [];
        return {
          ...message,
          reactions: existing
            ? reactions.filter((reaction) => reaction.userId !== currentUserId)
            : [...reactions, data.reaction!],
        };
      }));
    } catch {}
  };

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
    const unsubscribe = subscribeRealtime((event) => {
      if (event.type === "message.created" && event.conversationId === conversation.id) {
        void load();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [load, conversation.id]);

  useEffect(() => {
    const pollTyping = async () => {
      try {
        const data = await apiFetch<{ typing: Array<{ id: string; name: string }> }>("/api/conversations/" + conversation.id + "/typing");
        setTypingUsers(data.typing ?? []);
      } catch {}
    };
    void pollTyping();
    const timer = setInterval(() => void pollTyping(), 1_500);
    return () => clearInterval(timer);
  }, [conversation.id]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      void apiFetch("/api/conversations/" + conversation.id + "/typing", { method: "DELETE" }).catch(() => {});
    };
  }, [conversation.id]);

  const updateTyping = (value: string) => {
    setText(value);
    if (value.trim()) void SecureStore.setItemAsync(draftKey, value).catch(() => {});
    else void SecureStore.deleteItemAsync(draftKey).catch(() => {});
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (!value.trim()) {
      void apiFetch("/api/conversations/" + conversation.id + "/typing", { method: "DELETE" }).catch(() => {});
      return;
    }
    void apiFetch("/api/conversations/" + conversation.id + "/typing", {
      method: "POST",
      body: JSON.stringify({ typing: true }),
    }).catch(() => {});
    typingTimerRef.current = setTimeout(() => {
      void apiFetch("/api/conversations/" + conversation.id + "/typing", { method: "DELETE" }).catch(() => {});
    }, 4_500);
  };

  const startCall = async (type: "AUDIO" | "VIDEO") => {
    if (!other?.id || conversation.isGroup || activeCall) return;
    try {
      const data = await apiFetch<{ call: NativeCall }>(`/api/conversations/${conversation.id}/calls`, {
        method: "POST",
        body: JSON.stringify({ type }),
      });
      setActiveCall(data.call);
    } catch (error) {
      Alert.alert("Call", error instanceof Error ? error.message : "Unable to start the call.");
    }
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  if (activeCall) {
    const remoteUser = activeCall.callerId === currentUserId ? activeCall.callee : activeCall.caller;
    if (remoteUser) {
      return (
        <CallScreen
          call={activeCall}
          currentUserId={currentUserId}
          remoteUser={remoteUser}
          incoming={false}
          onFinished={() => setActiveCall(null)}
        />
      );
    }
  }

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
        void SecureStore.deleteItemAsync(draftKey).catch(() => {});
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
      void SecureStore.deleteItemAsync(draftKey).catch(() => {});
      void apiFetch("/api/conversations/" + conversation.id + "/typing", { method: "DELETE" }).catch(() => {});
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
      void SecureStore.deleteItemAsync(draftKey).catch(() => {});
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
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back" style={styles.chatBackButton}>
          <Text style={styles.chatBackIcon}>‹</Text>
        </Pressable>
        <Avatar user={other} size={46} />
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.chatTitle}>{conversationName(conversation, currentUserId)}</Text>
          <Text numberOfLines={1} style={styles.chatSubtitle}>{conversation.isGroup ? conversation.members.length + " members" : "@" + (other?.username ?? "socialhub")}</Text>
        </View>
        <View style={styles.chatStatusPill}><Text style={styles.chatStatusText}>Chat</Text></View>
      </View>
      <KeyboardAvoidingView
        style={styles.chatKeyboard}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
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
              <Text style={styles.messageTime}>
                {formatTime(item.createdAt)}{item.editedAt && !item.deletedAt ? " · edited" : ""}
                {item.senderId === currentUserId && !item.deletedAt && conversation.members.some((member) => member.userId !== currentUserId && member.lastReadAt && new Date(member.lastReadAt).getTime() >= new Date(item.createdAt).getTime()) ? " · Seen" : ""}
              </Text>
              {!item.deletedAt ? (
                <View style={styles.messageReactionRow}>
                  {(item.reactions ?? []).slice(0, 4).map((reaction) => (
                    <Pressable key={reaction.id} onPress={() => void reactToMessage(item.id, reaction.emoji)} style={styles.messageReactionChip}>
                      <Text style={styles.messageReactionText}>{reaction.emoji}</Text>
                    </Pressable>
                  ))}
                  <Pressable onPress={() => void reactToMessage(item.id, "❤️")} style={styles.messageReactionAdd}>
                    <Ionicons name="add" size={14} color={colors.muted} />
                  </Pressable>
                </View>
              ) : null}
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
        {typingUsers.length ? <Text style={styles.typingIndicator}>{typingUsers.length === 1 ? `${typingUsers[0].name} is typing…` : `${typingUsers.length} people are typing…`}</Text> : null}
        <View style={[styles.messageComposer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Pressable onPress={() => void sendAttachment()} disabled={attachmentBusy} style={styles.attachButton}>
            <Text style={styles.attachButtonText}>{attachmentBusy ? "…" : "＋"}</Text>
          </Pressable>
          <TextInput
            value={text}
            onChangeText={updateTyping}
            placeholder={editing ? "Edit message…" : "Type a message…"}
            placeholderTextColor={colors.muted}
            style={styles.messageInput}
            multiline
            blurOnSubmit={false}
            textAlignVertical="top"
            returnKeyType="default"
          />
          <Pressable onPress={() => void send()} style={styles.sendButton}>
            <Text style={styles.sendButtonText}>↑</Text>
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

type VisitorProfileData = Profile & {
  isFollowing?: boolean;
  isMuted?: boolean;
  isFriend?: boolean;
  friendRequestStatus?: "SELF" | "FRIENDS" | "OUTGOING_PENDING" | "INCOMING_PENDING" | "NONE";
  friendRequestId?: string | null;
  canMessage?: boolean;
  canSendFriendRequest?: boolean;
  canFollow?: boolean;
};

type RelationshipPerson = User & { id: string; username?: string | null };

function VisitorProfileScreen({
  username,
  onBack,
  onOpenMessages,
}: {
  username: string;
  onBack: () => void;
  onOpenMessages: (conversationId: string) => void;
}) {
  const [profile, setProfile] = useState<VisitorProfileData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [relationshipView, setRelationshipView] = useState<"followers" | "following" | "mutual" | "friends" | null>(null);
  const [relationshipPeople, setRelationshipPeople] = useState<RelationshipPerson[]>([]);
  const [relationshipHidden, setRelationshipHidden] = useState(false);
  const [relationshipLoading, setRelationshipLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ profile: VisitorProfileData }>(
        "/api/users/" + encodeURIComponent(username),
      );
      setProfile(data.profile);
      const postsData = await apiFetch<{ posts?: Post[] }>(
        "/api/users/" + encodeURIComponent(data.profile.username ?? username) + "/posts?take=20",
      );
      setPosts(postsData.posts ?? []);
    } catch (e) {
      setProfile(null);
      setError(e instanceof Error ? e.message : "Unable to load this profile.");
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => { void load(); }, [load]);

  const mutate = async (fn: () => Promise<void>, label: string) => {
    setAction(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update this profile.");
    } finally {
      setAction(null);
    }
  };

  const toggleFollow = () => {
    if (!profile || !profile.canFollow) return;
    void mutate(async () => {
      const response = await apiFetch<{ following?: boolean }>(
        "/api/users/" + profile.id + "/follow",
        { method: profile.isFollowing ? "DELETE" : "POST" },
      );
      setProfile((current) => current ? {
        ...current,
        isFollowing: Boolean(response.following),
        visibleCounts: {
          ...current.visibleCounts,
          followers: Math.max(0, current.visibleCounts.followers + (response.following ? 1 : -1)),
        },
      } : current);
    }, "follow");
  };

  const sendFriend = () => {
    if (!profile || !profile.canSendFriendRequest) return;
    void mutate(async () => {
      const data = await apiFetch<{ friendRequest?: { id?: string } }>("/api/friend-requests", {
        method: "POST",
        body: JSON.stringify({ receiverId: profile.id }),
      });
      setProfile((current) => current ? { ...current, friendRequestStatus: "OUTGOING_PENDING", friendRequestId: data.friendRequest?.id ?? null } : current);
    }, "friend");
  };

  const cancelFriend = () => {
    if (!profile?.friendRequestId) return;
    void mutate(async () => {
      await apiFetch("/api/friend-requests/" + encodeURIComponent(profile.friendRequestId as string), { method: "DELETE" });
      setProfile((current) => current ? { ...current, friendRequestStatus: "NONE", friendRequestId: null } : current);
    }, "cancel-friend");
  };

  const acceptFriend = () => {
    if (!profile?.friendRequestId) return;
    void mutate(async () => {
      await apiFetch("/api/friend-requests/" + encodeURIComponent(profile.friendRequestId as string), {
        method: "PATCH",
        body: JSON.stringify({ status: "ACCEPTED" }),
      });
      setProfile((current) => current ? {
        ...current,
        friendRequestStatus: "FRIENDS",
        friendRequestId: null,
        isFriend: true,
        isFollowing: true,
      } : current);
    }, "accept-friend");
  };

  const declineFriend = () => {
    if (!profile?.friendRequestId) return;
    void mutate(async () => {
      await apiFetch("/api/friend-requests/" + encodeURIComponent(profile.friendRequestId as string), {
        method: "PATCH",
        body: JSON.stringify({ status: "DECLINED" }),
      });
      setProfile((current) => current ? { ...current, friendRequestStatus: "NONE", friendRequestId: null } : current);
    }, "decline-friend");
  };

  const unfriend = () => {
    if (!profile) return;
    Alert.alert("Unfriend", "Remove this person from your friends?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void mutate(async () => {
          await apiFetch("/api/friends/" + encodeURIComponent(profile.id), { method: "DELETE" });
          setProfile((current) => current ? {
            ...current,
            friendRequestStatus: "NONE",
            isFriend: false,
            isFollowing: false,
          } : current);
        }, "unfriend"),
      },
    ]);
  };

  const openConversation = () => {
    if (!profile?.canMessage) return;
    void mutate(async () => {
      const data = await apiFetch<{ conversation: Conversation }>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ memberIds: [profile.id], isGroup: false }),
      });
      onOpenMessages(data.conversation.id);
    }, "message");
  };

  const toggleMute = () => {
    if (!profile) return;
    void mutate(async () => {
      const data = await apiFetch<{ muted?: boolean }>("/api/users/" + profile.id + "/mute", {
        method: profile.isMuted ? "DELETE" : "POST",
      });
      setProfile((current) => current ? { ...current, isMuted: Boolean(data.muted) } : current);
    }, "mute");
  };

  const report = () => {
    if (!profile) return;
    Alert.alert(
      "Report profile",
      "Report this profile for spam, abuse, or misleading content?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit report",
          onPress: () => void mutate(async () => {
            await apiFetch("/api/users/" + profile.id + "/report", {
              method: "POST",
              body: JSON.stringify({ reason: "Reported from Android profile actions" }),
            });
          }, "report"),
        },
      ],
    );
  };

  const block = () => {
    if (!profile) return;
    Alert.alert("Block profile", "This person's content will stop appearing for you.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: () => void mutate(async () => {
          await apiFetch("/api/users/" + profile.id + "/block", { method: "POST" });
          onBack();
        }, "block"),
      },
    ]);
  };

  const shareProfile = async () => {
    if (!profile) return;
    try {
      await Share.share({
        title: "Socialhub profile",
        message: "https://socialhublive.vercel.app/profile/" + encodeURIComponent(profile.username ?? username),
      });
    } catch {}
  };

  const openRelationships = async (view: "followers" | "following" | "mutual" | "friends") => {
    if (!profile) return;
    setRelationshipView(view);
    setRelationshipLoading(true);
    setRelationshipHidden(false);
    try {
      const endpoint = view === "friends"
        ? "/api/users/" + profile.id + "/friends"
        : "/api/users/" + profile.id + "/relationships";
      const data = await apiFetch<Record<string, unknown>>(endpoint);
      if (view === "friends") {
        setRelationshipPeople((data.friends ?? []) as RelationshipPerson[]);
        setRelationshipHidden(Boolean(data.hidden));
      } else {
        setRelationshipPeople((data[view] ?? []) as RelationshipPerson[]);
      }
    } catch (e) {
      setRelationshipPeople([]);
      setRelationshipHidden(false);
      Alert.alert("Profile", e instanceof Error ? e.message : "Unable to load this list.");
    } finally {
      setRelationshipLoading(false);
    }
  };

  if (loading) {
    return <View style={styles.screen}><DetailHeader title="Profile" subtitle="Loading profile…" onBack={onBack} /><ActivityIndicator color={colors.accent} style={styles.loader} /></View>;
  }

  if (!profile) {
    return <View style={styles.screen}><DetailHeader title="Profile" subtitle={error || "Unavailable"} onBack={onBack} /><Text style={styles.empty}>{error || "Profile unavailable."}</Text></View>;
  }

  const friendState = profile.friendRequestStatus ?? "NONE";

  return (
    <View style={styles.screen}>
      <DetailHeader
        title={profile.name || "Profile"}
        subtitle={"@" + (profile.username ?? username)}
        onBack={onBack}
        action="⋯"
        onAction={() => Alert.alert("Profile actions", "Choose an action.", [
          { text: profile.isMuted ? "Unmute" : "Mute", onPress: toggleMute },
          { text: "Share profile", onPress: () => void shareProfile() },
          { text: "Report", onPress: report },
          { text: "Block", style: "destructive", onPress: block },
          { text: "Cancel", style: "cancel" },
        ])}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileVisitorHero}>
          {profile.coverImage ? <Image source={{ uri: profile.coverImage }} style={styles.profileCoverVisitor} resizeMode="cover" /> : <View style={styles.profileCoverVisitorPlaceholder} />}
          <View style={styles.profileVisitorIdentity}>
            <Avatar user={profile} size={92} />
            <View style={styles.visitorTitleWrap}>
              <View style={styles.row}>
                <Text style={styles.profileName}>{profile.name}</Text>
                {profile.isVerified ? <Ionicons name="checkmark-circle" size={18} color={colors.accentBright} /> : null}
              </View>
              <Text style={styles.userHandle}>@{profile.username ?? "socialhub"}</Text>
            </View>
          </View>
          {profile.bio ? <Text style={styles.profileBio}>{profile.bio}</Text> : null}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.statsGrid}>
          <Stat label="Posts" value={profile.visibleCounts.posts} />
          <Pressable onPress={() => void openRelationships("followers")} style={styles.statCard}><Text style={styles.statValue}>{formatCount(profile.visibleCounts.followers)}</Text><Text style={styles.userHandle}>Followers</Text></Pressable>
          <Pressable onPress={() => void openRelationships("following")} style={styles.statCard}><Text style={styles.statValue}>{formatCount(profile.visibleCounts.following)}</Text><Text style={styles.userHandle}>Following</Text></Pressable>
          <Pressable onPress={() => void openRelationships("mutual")} style={styles.statCard}><Text style={styles.statValue}>{formatCount(profile.visibleCounts.profileViews)}</Text><Text style={styles.userHandle}>Views</Text></Pressable>
        </View>

        <View style={styles.visitorActions}>
          {profile.canMessage ? <Pressable disabled={Boolean(action)} onPress={openConversation} style={styles.visitorPrimaryAction}><Ionicons name="chatbubble-ellipses-outline" size={17} color="#fff" /><Text style={styles.visitorPrimaryText}>{action === "message" ? "Opening…" : "Message"}</Text></Pressable> : null}
          {profile.canFollow ? <Pressable disabled={Boolean(action)} onPress={toggleFollow} style={styles.visitorSecondaryAction}><Ionicons name={profile.isFollowing ? "person-remove-outline" : "person-add-outline"} size={17} color={colors.text} /><Text style={styles.visitorSecondaryText}>{action === "follow" ? "Updating…" : profile.isFollowing ? "Following" : "Follow"}</Text></Pressable> : null}
          {friendState === "FRIENDS" ? <Pressable onPress={unfriend} style={styles.visitorSecondaryAction}><Ionicons name="people-outline" size={17} color={colors.text} /><Text style={styles.visitorSecondaryText}>Friends</Text></Pressable> : null}
          {friendState === "OUTGOING_PENDING" ? <Pressable onPress={cancelFriend} style={styles.visitorSecondaryAction}><Text style={styles.visitorSecondaryText}>{action === "cancel-friend" ? "Cancelling…" : "Request sent"}</Text></Pressable> : null}
          {friendState === "INCOMING_PENDING" ? (
            <>
              <Pressable onPress={acceptFriend} style={styles.visitorPrimaryAction}><Text style={styles.visitorPrimaryText}>{action === "accept-friend" ? "Accepting…" : "Accept"}</Text></Pressable>
              <Pressable onPress={declineFriend} style={styles.visitorDangerAction}><Text style={styles.visitorDangerText}>Decline</Text></Pressable>
            </>
          ) : null}
          {friendState === "NONE" && profile.canSendFriendRequest ? <Pressable onPress={sendFriend} style={styles.visitorSecondaryAction}><Ionicons name="person-add-outline" size={17} color={colors.text} /><Text style={styles.visitorSecondaryText}>{action === "friend" ? "Sending…" : "Add friend"}</Text></Pressable> : null}
        </View>

        <View style={styles.profileInfoRow}>
          <Pressable onPress={() => void openRelationships("friends")} style={styles.infoChip}><Ionicons name="people-outline" size={15} color={colors.accentBright} /><Text style={styles.infoChipText}>Friends</Text></Pressable>
          <View style={styles.infoChip}><Ionicons name="shield-checkmark-outline" size={15} color={colors.accentBright} /><Text style={styles.infoChipText}>{profile.isPrivate ? "Private" : "Public"} account</Text></View>
          {profile.location ? <View style={styles.infoChip}><Ionicons name="location-outline" size={15} color={colors.accentBright} /><Text numberOfLines={1} style={styles.infoChipText}>{profile.location}</Text></View> : null}
        </View>

        <SectionHeader title="Posts" />
        {posts.length ? posts.map((post) => <PostCard key={post.id} post={post} onChanged={(next) => setPosts((current) => current.map((item) => item.id === next.id ? next : item))} />) : <View style={styles.discoverEmptyCard}><Ionicons name="images-outline" size={28} color={colors.accent} /><Text style={styles.discoverEmptyTitle}>{profile.isPrivate && friendState !== "FRIENDS" ? "Posts are private" : "No public posts yet"}</Text><Text style={styles.emptySmall}>There are no posts available here.</Text></View>}
      </ScrollView>

      <Modal visible={relationshipView !== null} transparent animationType="slide" onRequestClose={() => setRelationshipView(null)}>
        <View style={styles.relationshipOverlay}>
          <Pressable style={styles.commentScrim} onPress={() => setRelationshipView(null)} />
          <View style={styles.relationshipSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>{relationshipView === "followers" ? "Followers" : relationshipView === "following" ? "Following" : relationshipView === "mutual" ? "Mutual connections" : "Friends"}</Text>
                <Text style={styles.subtitle}>Real account relationships</Text>
              </View>
              <Pressable onPress={() => setRelationshipView(null)}><Ionicons name="close" size={22} color={colors.text} /></Pressable>
            </View>
            {relationshipLoading ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : relationshipHidden ? <Text style={styles.emptySmall}>This list is private.</Text> : (
              <ScrollView contentContainerStyle={styles.relationshipList}>
                {relationshipPeople.length ? relationshipPeople.map((person) => (
                  <View key={person.id} style={styles.relationshipRow}>
                    <Avatar user={person} size={44} />
                    <View style={styles.flex}><Text style={styles.userName}>{person.name}</Text><Text style={styles.userHandle}>@{person.username ?? "member"}</Text></View>
                  </View>
                )) : <Text style={styles.emptySmall}>No accounts to show.</Text>}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
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
            <PrimaryButton label={busy ? "Saving…" : "Save changes"} onPress={() => void save()} disabled={busy || mediaBusy !== null} loading={busy} />
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
  const [launching, setLaunching] = useState(true);
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
    else if (deepLink.kind === "profile") setTab("Profile");
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
    const unsubscribe = subscribeRealtime(() => {
      void refreshUnread();
    });
    return () => {
      unsubscribe();
    };
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
    if (!booting && permissionsReady) void SplashScreen.hideAsync().catch(() => {});
  }, [booting, permissionsReady]);

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
    try {
      await unregisterPushDevice();
    } catch {
      // Push cleanup is best-effort; do not block account sign-out.
    }
    try {
      await authClient.signOut();
    } finally {
      setDrawerOpen(false);
      setSignedIn(false);
      setSessionUser(null);
      setTab("Home");
      setHideBottomNav(false);
      setDeepLink(null);
    }
  }, []);

  if (booting || !permissionsReady) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.accent} /></View>
      </View>
    );
  }

  if (launching) {
    return <LaunchScreen onFinished={() => setLaunching(false)} />;
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
          onOpenProfile={(usernameOrId) => { setDeepLink({ kind: "profile", id: usernameOrId }); setTab("Profile"); }}
        />
      ) : null}
      {tab === "Friends" ? <FriendsScreen onMenu={openMenu} /> : null}
      {tab === "Calls" ? <CallsScreen onMenu={openMenu} /> : null}
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
      {tab === "Profile" ? (
        deepLink?.kind === "profile" && deepLink.id !== sessionUser?.username ? (
          <VisitorProfileScreen
            username={deepLink.id}
            onBack={() => { setDeepLink(null); setTab("Discover"); }}
            onOpenMessages={(conversationId) => { setDeepLink({ kind: "message", id: conversationId }); setTab("Messages"); }}
          />
        ) : (
          <ProfileScreen onMenu={openMenu} onSignedOut={() => { setSignedIn(false); setSessionUser(null); }} />
        )
      ) : null}
      {tab === "Settings" ? <SettingsScreen onMenu={openMenu} isOwner={Boolean(sessionUser?.isOwner)} onOpenAdmin={() => navigate("Admin")} onSignedOut={() => { setSignedIn(false); setSessionUser(null); }} /> : null}
      {tab === "Saved" ? <SavedScreen onMenu={openMenu} /> : null}
      {tab === "Security" ? <SecurityScreen onMenu={openMenu} /> : null}
      {tab === "Admin" && sessionUser?.isOwner ? <AdminScreen onMenu={openMenu} /> : null}

      <CallOverlay currentUserId={sessionUser.id} />

      {!hideBottomNav ? (
        <View style={[styles.bottomNav, { bottom: Math.max(insets.bottom + 8, 10) }]}>
          <NavItem icon="home-outline" activeIcon="home" label="Home" active={tab === "Home"} onPress={() => navigate("Home")} />
          <NavItem icon="people-outline" activeIcon="people" label="Friends" active={tab === "Friends"} onPress={() => navigate("Friends")} badge={badge(unread.friendRequests)} />
          <NavItem icon="chatbubble-ellipses-outline" activeIcon="chatbubble-ellipses" label="Messages" active={tab === "Messages"} onPress={() => navigate("Messages")} badge={badge(unread.messages)} />
          <NavItem icon="notifications-outline" activeIcon="notifications" label="Alerts" active={tab === "Notifications"} onPress={() => navigate("Notifications")} badge={badge(unread.notifications)} />
          <NavItem icon="person-outline" activeIcon="person" label="Profile" active={tab === "Profile"} onPress={() => navigate("Profile")} />
        </View>
      ) : null}

      <MenuDrawer
        visible={drawerOpen}
        route={tab}
        userName={sessionUser?.name}
        onClose={() => setDrawerOpen(false)}
        onNavigate={navigate}
        onSignOut={() => void signOut()}
        isOwner={Boolean(sessionUser?.isOwner)}
      />
    </View>
  );
}

function NavItem({
  icon,
  activeIcon,
  label,
  active,
  onPress,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.navItem, active && styles.navItemActive]}
    >
      <View style={styles.navIconWrap}>
        <Ionicons name={active ? activeIcon : icon} size={22} color={active ? colors.text : colors.muted} />
        {badge ? <View style={styles.navBadge}>{badge}</View> : null}
      </View>
      <Text style={[styles.navLabel, active && styles.navActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  discoverHero: { paddingHorizontal: 2, paddingTop: 8, paddingBottom: 8 },
  discoverHeroRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  discoverHeroBadge: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.border },
  discoverSearchWrap: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, marginBottom: 4 },
  discoverSearchInput: { flex: 1, minWidth: 0, color: colors.text, fontSize: 14, paddingVertical: 13 },
  discoverClear: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel2 },
  trendRow: { gap: 9, paddingBottom: 8 },
  trendChip: { minWidth: 118, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  trendRank: { color: colors.accentBright, fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  trendTag: { color: colors.text, marginTop: 5, fontSize: 13, fontWeight: "900" },
  trendCount: { color: colors.muted, marginTop: 3, fontSize: 10 },
  trendEmpty: { paddingVertical: 18, paddingHorizontal: 12 },
  hashtagCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 12, marginBottom: 10 },
  hashtagIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  hashtagTag: { color: colors.text, fontWeight: "900", fontSize: 14 },
  discoverEyebrow: { color: colors.accent, fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  discoverTitle: { color: colors.text, fontSize: 28, fontWeight: "900", marginTop: 4 },
  discoverSubtitle: { color: colors.muted, marginTop: 4, lineHeight: 18 },
  discoverEmptyCard: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 26, alignItems: "center", marginBottom: 14 },
  discoverEmptyIcon: { color: colors.accent, fontSize: 32 },
  discoverEmptyTitle: { color: colors.text, fontSize: 16, fontWeight: "900", marginTop: 8 },
  messageListToolbar: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  messageSearchInput: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 16, color: colors.text, paddingHorizontal: 15, paddingVertical: 13 },
  conversationTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  conversationName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "900" },
  conversationTime: { color: colors.muted, fontSize: 10 },
  conversationPreviewRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  conversationPreview: { flex: 1, color: colors.muted, fontSize: 12 },
  archivedLabel: { color: colors.accent, fontSize: 9, fontWeight: "900", marginTop: 6, letterSpacing: 0.8 },
  chatBackButton: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border },
  chatBackIcon: { color: colors.text, fontSize: 34, lineHeight: 34, marginTop: -3 },
  chatTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  chatSubtitle: { color: colors.muted, fontSize: 11, marginTop: 2 },
  chatStatusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.accentSoft },
  chatStatusText: { color: colors.accent, fontSize: 10, fontWeight: "900" },
  callButton: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border },
  callIcon: { color: colors.text, fontSize: 18, fontWeight: "900" },
  root: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  authScreen: { flex: 1, backgroundColor: colors.bg },
  authContent: { flexGrow: 1, justifyContent: "center", padding: 24, paddingBottom: 40 },
  authBrandMark: { alignSelf: "center" },
  logoLetter: { color: "#fff", fontSize: 42, fontWeight: "900" },
  authBrand: { color: colors.text, fontSize: 34, fontWeight: "900", textAlign: "center", marginTop: 14, letterSpacing: -0.8 },
  authSubtitle: { color: colors.muted, textAlign: "center", marginTop: 6, marginBottom: 24, fontSize: 14, fontWeight: "600" },
  authRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  authSwitch: { color: colors.muted, textAlign: "center", marginTop: 18 },
  input: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, color: colors.text, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 15, marginBottom: 12, minHeight: 52 },
  primaryButton: { minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent, paddingHorizontal: 16, marginTop: 6, shadowColor: colors.accent, shadowOpacity: 0.22, shadowRadius: 12, elevation: 5 },
  secondaryButton: { backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border },
  disabledButton: { opacity: 0.55 },
  primaryButtonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  successText: { color: colors.success, marginBottom: 10 },
  errorText: { color: colors.danger, marginBottom: 10 },
  dangerText: { color: colors.danger },
  linkText: { color: "#a99cff", fontWeight: "700" },
  header: { flexDirection: "row", alignItems: "center", minHeight: 104, paddingHorizontal: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  subtitle: { color: colors.muted, marginTop: 3 },
  refresh: { color: colors.text, fontSize: 30 },
  loader: { marginVertical: 18 },
  feed: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 170 },
  scrollContent: { padding: 14, paddingBottom: 170 },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: 60 },
  emptySmall: { color: colors.muted, textAlign: "center", paddingVertical: 20 },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center" },
  avatarFallback: { backgroundColor: "#2a2937", alignItems: "center", justifyContent: "center", marginRight: 10 },
  avatarInitial: { color: "#fff", fontSize: 18, fontWeight: "900" },
  userName: { color: colors.text, fontWeight: "800", fontSize: 15 },
  userHandle: { color: colors.muted, marginTop: 3, fontSize: 12 },
  muted: { color: colors.muted, fontSize: 12 },
  postCard: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 14, marginBottom: 12, shadowColor: colors.black, shadowOpacity: 0.18, shadowRadius: 16, elevation: 3 },
  postText: { color: colors.text, fontSize: 16, lineHeight: 23, marginTop: 12 },
  postMedia: { width: "100%", height: 260, borderRadius: 15, marginTop: 12, backgroundColor: colors.panel2 },
  metricsRow: { flexDirection: "row", gap: 18, paddingTop: 12, paddingBottom: 8 },
  actionRow: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  actionButton: { flex: 1, paddingVertical: 8, alignItems: "center" },
  actionText: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  activeAction: { color: colors.accent },
  composer: { backgroundColor: colors.panel, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 14, shadowColor: colors.black, shadowOpacity: 0.15, shadowRadius: 14, elevation: 2 },
  composerInput: { minHeight: 96, color: colors.text, textAlignVertical: "top", padding: 5, fontSize: 16, lineHeight: 23 },
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
  conversationCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 19, padding: 13, marginBottom: 10, shadowColor: colors.black, shadowOpacity: 0.16, shadowRadius: 12, elevation: 2 },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  chatScreen: { flex: 1, backgroundColor: colors.bg },
  chatKeyboard: { flex: 1, backgroundColor: colors.bg },
  chatListFlex: { flex: 1 },
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg },
  backText: { color: colors.text, fontSize: 38, lineHeight: 38, paddingHorizontal: 6 },
  chatList: { padding: 12, gap: 8, paddingBottom: 14 },
  messageBubble: { maxWidth: "84%", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 11, marginVertical: 2 },
  myBubble: { alignSelf: "flex-end", backgroundColor: colors.accent, borderBottomRightRadius: 7 },
  theirBubble: { alignSelf: "flex-start", backgroundColor: colors.panel2, borderBottomLeftRadius: 7 },
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
  typingIndicator: { color: colors.muted, fontSize: 11, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 2, backgroundColor: colors.bg },
  messageComposer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.panel, minHeight: 84 },
  messageInput: { flex: 1, minHeight: 54, maxHeight: 150, color: colors.text, backgroundColor: colors.panel2, borderRadius: 19, paddingHorizontal: 15, paddingVertical: 13, textAlignVertical: "top", fontSize: 15, lineHeight: 21 },
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
  bottomNav: { position: "absolute", left: 10, right: 10, height: 74, backgroundColor: "rgba(20,20,27,0.97)", borderWidth: 1, borderColor: colors.border, borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-around", shadowColor: "#000", shadowOpacity: 0.34, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 14 },
  navItem: { minWidth: 58, minHeight: 58, borderRadius: 17, alignItems: "center", justifyContent: "center", paddingHorizontal: 7 },
  navItemActive: { backgroundColor: colors.accentSoft },
  navIconWrap: { position: "relative", alignItems: "center", justifyContent: "center" },
  navIcon: { color: colors.muted, fontSize: 22, marginBottom: 2 },
  navLabel: { color: colors.muted, fontSize: 10, marginTop: 3, fontWeight: "700" },
  navActive: { color: colors.text, fontWeight: "900" },
  feedModeRow: { flexDirection: "row", paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, gap: 8 },
  feedModeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  feedModeChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  feedModeText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  feedModeTextActive: { color: colors.text },
  profileVisitorHero: { backgroundColor: colors.panel, borderRadius: 21, borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginBottom: 12 },
  profileCoverVisitor: { width: "100%", height: 172, backgroundColor: colors.panel2 },
  profileCoverVisitorPlaceholder: { width: "100%", height: 120, backgroundColor: colors.accentSoft },
  profileVisitorIdentity: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, marginTop: -46 },
  visitorTitleWrap: { flex: 1, minWidth: 0, paddingTop: 34 },
  visitorActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  visitorPrimaryAction: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 15, borderRadius: 14, backgroundColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.23, shadowRadius: 10, elevation: 4 },
  visitorPrimaryText: { color: colors.white, fontWeight: "900", fontSize: 12 },
  visitorSecondaryAction: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border },
  visitorSecondaryText: { color: colors.text, fontWeight: "800", fontSize: 12 },
  visitorDangerAction: { minHeight: 44, paddingHorizontal: 14, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,119,119,0.08)", borderWidth: 1, borderColor: "#61343B" },
  visitorDangerText: { color: colors.danger, fontWeight: "900", fontSize: 12 },
  profileInfoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  infoChip: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderRadius: 11, backgroundColor: colors.panel2 },
  infoChipText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  relationshipOverlay: { flex: 1, justifyContent: "flex-end" },
  relationshipSheet: { height: "72%", backgroundColor: colors.bg, borderTopLeftRadius: 25, borderTopRightRadius: 25, borderWidth: 1, borderColor: colors.border, paddingBottom: 10 },
  relationshipList: { padding: 14, paddingBottom: 40, gap: 8 },
  relationshipRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  navBadge: { position: "absolute", top: -6, right: -12 },
});
