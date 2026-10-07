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
import { apiFetch, uploadFile, uploadMedia } from "./lib/api";
import { pickAndUploadDocument } from "./lib/document-picker";
import { requestCameraPermission, requestMicrophonePermission } from "./lib/permissions";
import { AudioSession, LiveKitRoom, VideoTrack, useTracks, registerGlobals } from "@livekit/react-native";
import { Track } from "livekit-client";
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
const PERMISSION_ONBOARDING_KEY = "socialhub:permissions-intro:v1";

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

registerGlobals();

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

  useEffect(() => { void load(); }, [load]);

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

function CallRoomContent({ isVideo, title, onEnd }: { isVideo: boolean; title: string; onEnd: () => void }) {
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(isVideo);
  const tracks = useTracks([Track.Source.Camera]);
  useEffect(() => {
    void AudioSession.startAudioSession();
    return () => { void AudioSession.stopAudioSession(); };
  }, []);
  return (
    <View style={styles.callScreen}>
      <Text style={styles.callTitle}>{title}</Text>
      <Text style={styles.callStatus}>Connected call</Text>
      <View style={styles.callVideo}>
        {isVideo && cameraEnabled && tracks.length ? tracks.map((track, index) => (
          <VideoTrack key={track.publication.trackSid ?? String(index)} trackRef={track} style={styles.remoteVideo} />
        )) : <View style={styles.callPlaceholder}><Text style={styles.callPlaceholderText}>{isVideo ? "Camera off" : "Voice call"}</Text></View>}
      </View>
      <View style={styles.callControls}>
        <Pressable style={styles.callControl} onPress={() => setMicEnabled((value) => !value)}><Text style={styles.callControlText}>{micEnabled ? "Mute" : "Unmute"}</Text></Pressable>
        {isVideo ? <Pressable style={styles.callControl} onPress={() => setCameraEnabled((value) => !value)}><Text style={styles.callControlText}>{cameraEnabled ? "Camera off" : "Camera on"}</Text></Pressable> : null}
        <Pressable style={styles.endCall} onPress={onEnd}><Text style={styles.endCallText}>End</Text></Pressable>
      </View>
    </View>
  );
}

function ActiveCallView({ token, serverUrl, isVideo, title, onEnd }: { token: string; serverUrl: string; isVideo: boolean; title: string; onEnd: () => void }) {
  return (
    <Modal visible animationType="slide" onRequestClose={onEnd}>
      <LiveKitRoom serverUrl={serverUrl} token={token} connect audio video={isVideo}>
        <CallRoomContent isVideo={isVideo} title={title} onEnd={onEnd} />
      </LiveKitRoom>
    </Modal>
  );
}

