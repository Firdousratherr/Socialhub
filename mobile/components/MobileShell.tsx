import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BrandMark } from "./BrandMark";
import { colors, radius } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";


export type MobileRoute = "Home" | "Discover" | "Friends" | "Messages" | "Calls" | "Notifications" | "Profile" | "Saved" | "Settings" | "Security" | "Admin";

export function AppHeader({
  title,
  subtitle,
  onMenu,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  onMenu: () => void;
  action?: string;
  onAction?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <BrandMark size={38} style={styles.headerBrandIcon} />
      <View style={styles.headerCopy}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} style={styles.headerAction}>
          <Text style={styles.actionText}>{action}</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onMenu}
        accessibilityRole="button"
        accessibilityLabel="Open Socialhub menu"
        hitSlop={6}
        style={styles.menuButton}
      >
        <Ionicons name="menu" size={25} color={colors.text} />
      </Pressable>
    </View>
  );
}

export function DetailHeader({
  title,
  subtitle,
  onBack,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  action?: string;
  onAction?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <BrandMark size={38} style={styles.headerBrandIcon} />
      <View style={styles.headerCopy}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action && onAction ? <Pressable onPress={onAction} style={styles.headerAction}><Text style={styles.actionText}>{action}</Text></Pressable> : <View style={styles.headerSpacer} />}
    </View>
  );
}

export function MenuDrawer({
  visible,
  route,
  userName,
  onClose,
  onNavigate,
  onSignOut,
  isOwner = false,
}: {
  visible: boolean;
  route: MobileRoute;
  userName?: string;
  onClose: () => void;
  onNavigate: (route: MobileRoute) => void;
  onSignOut: () => void;
  isOwner?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const items: Array<{ route: MobileRoute; label: string; icon: keyof typeof Ionicons.glyphMap; description: string }> = [
    { route: "Home", label: "Home", icon: "home-outline", description: "Your feed and stories" },
    { route: "Discover", label: "Discover", icon: "compass-outline", description: "People, posts and trends" },
    { route: "Friends", label: "Friends", icon: "people-outline", description: "Requests and connections" },
    { route: "Messages", label: "Messages", icon: "chatbubble-ellipses-outline", description: "Private conversations" },
    { route: "Calls", label: "Calls", icon: "call-outline", description: "Voice and video call history" },
    { route: "Notifications", label: "Notifications", icon: "notifications-outline", description: "Activity and requests" },
    { route: "Profile", label: "Profile", icon: "person-outline", description: "Your public identity" },
    { route: "Saved", label: "Saved posts", icon: "bookmark-outline", description: "Posts you saved for later" },
    { route: "Settings", label: "Settings", icon: "settings-outline", description: "Account, privacy and preferences" },
    { route: "Security", label: "Security", icon: "shield-checkmark-outline", description: "Sessions and device permissions" },
  ];
  if (isOwner) items.splice(items.length, 0, { route: "Admin", label: "Admin", icon: "construct-outline", description: "Platform controls and moderation" });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={[styles.drawer, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.drawerHeader}>
            <View style={styles.drawerBrandRow}>
              <BrandMark size={48} style={styles.drawerBrandIcon} />
              <View>
                <Text style={styles.brand}>Socialhub</Text>
                <Text style={styles.drawerUser}>{userName || "Your account"}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel="Close menu">
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.drawerList} showsVerticalScrollIndicator={false}>
            {items.map((item) => {
              const active = route === item.route;
              return (
                <Pressable
                  key={item.route}
                  onPress={() => { onNavigate(item.route); onClose(); }}
                  style={[styles.menuItem, active && styles.menuItemActive]}
                  accessibilityRole="button"
                >
                  <View style={[styles.menuIconBox, active && styles.menuIconBoxActive]}>
                    <Ionicons name={item.icon} size={21} color={active ? "#fff" : colors.muted} />
                  </View>
                  <View style={styles.menuItemCopy}>
                    <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>{item.label}</Text>
                    <Text style={styles.menuDescription}>{item.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                </Pressable>
              );
            })}
            <View style={styles.menuDivider} />
            <Pressable onPress={onSignOut} style={styles.signOutItem}>
              <View style={styles.menuIconBox}><Ionicons name="log-out-outline" size={21} color="#ff8b8b" /></View>
              <View style={styles.menuItemCopy}><Text style={styles.signOutText}>Sign out</Text><Text style={styles.menuDescription}>End this device session</Text></View>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 108,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 13,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 5,
    shadowColor: colors.black,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 5,
  },
  menuButton: { width: 46, height: 46, marginLeft: 10, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border },
  backButton: { width: 46, height: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border },
  headerBrandIcon: { marginRight: 1 },
  headerCopy: { flex: 1, minWidth: 0, paddingHorizontal: 10 },
  title: { color: colors.text, fontSize: 23, fontWeight: "900", letterSpacing: -0.4 },
  subtitle: { color: colors.muted, marginTop: 2, fontSize: 11 },
  headerAction: { minWidth: 46, minHeight: 42, paddingHorizontal: 8, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border },
  actionText: { color: colors.accent, fontWeight: "800", fontSize: 13 },
  headerSpacer: { width: 46 },
  overlay: { flex: 1, flexDirection: "row" },
  scrim: { flex: 1, backgroundColor: "rgba(17,24,39,0.48)" },
  drawer: { width: "84%", maxWidth: 370, backgroundColor: colors.bg, borderLeftWidth: 1, borderLeftColor: colors.border, shadowColor: colors.black, shadowOpacity: 0.16, shadowRadius: 28, elevation: 22 },
  drawerHeader: { paddingHorizontal: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.border },
  drawerBrandRow: { flexDirection: "row", alignItems: "center", minWidth: 0, flex: 1 },
  drawerBrandIcon: { marginRight: 11 },
  brand: { color: colors.text, fontSize: 23, fontWeight: "900" },
  drawerUser: { color: colors.muted, fontSize: 12, marginTop: 4 },
  closeButton: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel2 },
  closeText: { color: colors.text, fontSize: 30, lineHeight: 30 },
  drawerList: { padding: 12, gap: 5 },
  menuItem: { minHeight: 64, borderRadius: 16, flexDirection: "row", alignItems: "center", padding: 8 },
  menuItemActive: { backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border },
  menuIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel },
  menuIconBoxActive: { backgroundColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 9, elevation: 6 },
  menuItemIcon: { color: colors.muted, fontSize: 22 },
  menuItemIconActive: { color: "#fff" },
  menuItemCopy: { flex: 1, minWidth: 0, paddingHorizontal: 10 },
  menuLabel: { color: colors.text, fontSize: 14, fontWeight: "800" },
  menuLabelActive: { color: "#fff" },
  menuDescription: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  chevron: { color: colors.muted, fontSize: 25, paddingHorizontal: 6 },
  menuDivider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  signOutItem: { minHeight: 68, borderRadius: 17, flexDirection: "row", alignItems: "center", padding: 9, backgroundColor: "rgba(255,119,119,0.04)" },
  signOutIcon: { color: colors.danger, fontSize: 22 },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: "800" },
});
