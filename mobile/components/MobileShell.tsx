import React from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BRAND_ICON = require("../assets/icon.png");

const colors = {
  bg: "#08080c",
  panel: "#111118",
  panel2: "#171720",
  border: "#252531",
  text: "#f8f8ff",
  muted: "#8d8d9b",
  accent: "#725cff",
};

export type MobileRoute = "Home" | "Discover" | "Friends" | "Messages" | "Notifications" | "Profile" | "Saved" | "Settings" | "Security" | "Admin";

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
      <Pressable onPress={onMenu} accessibilityRole="button" accessibilityLabel="Open Socialhub menu" style={styles.menuButton}>
        <Text style={styles.menuIcon}>☰</Text>
      </Pressable>
      <Image source={BRAND_ICON} style={styles.headerBrandIcon} />
      <View style={styles.headerCopy}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} style={styles.headerAction}>
          <Text style={styles.actionText}>{action}</Text>
        </Pressable>
      ) : <View style={styles.headerSpacer} />}
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
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>
      <Image source={BRAND_ICON} style={styles.headerBrandIcon} />
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
}: {
  visible: boolean;
  route: MobileRoute;
  userName?: string;
  onClose: () => void;
  onNavigate: (route: MobileRoute) => void;
  onSignOut: () => void;
}) {
  const insets = useSafeAreaInsets();
  const items: Array<{ route: MobileRoute; label: string; icon: string; description: string }> = [
    { route: "Home", label: "Home", icon: "⌂", description: "Your feed and stories" },
    { route: "Discover", label: "Discover", icon: "⌕", description: "People, posts and trends" },
    { route: "Friends", label: "Friends", icon: "♧", description: "Requests and connections" },
    { route: "Messages", label: "Messages", icon: "✉", description: "Private conversations" },
    { route: "Notifications", label: "Notifications", icon: "♡", description: "Activity and requests" },
    { route: "Profile", label: "Profile", icon: "◉", description: "Your public identity" },
    { route: "Saved", label: "Saved posts", icon: "▱", description: "Posts you saved for later" },
    { route: "Settings", label: "Settings", icon: "⚙", description: "Account, privacy and preferences" },
    { route: "Security", label: "Security", icon: "◈", description: "Sessions and device permissions" },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={[styles.drawer, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.drawerHeader}>
            <View style={styles.drawerBrandRow}>
              <Image source={BRAND_ICON} style={styles.drawerBrandIcon} />
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
                    <Text style={[styles.menuItemIcon, active && styles.menuItemIconActive]}>{item.icon}</Text>
                  </View>
                  <View style={styles.menuItemCopy}>
                    <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>{item.label}</Text>
                    <Text style={styles.menuDescription}>{item.description}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              );
            })}
            <View style={styles.menuDivider} />
            <Pressable onPress={onSignOut} style={styles.signOutItem}>
              <View style={styles.menuIconBox}><Text style={styles.signOutIcon}>⇥</Text></View>
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
    minHeight: 100,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 13,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 5,
  },
  menuButton: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border },
  menuIcon: { color: colors.text, fontSize: 21, fontWeight: "800", lineHeight: 24 },
  backButton: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border },
  backIcon: { color: colors.text, fontSize: 38, lineHeight: 38, marginTop: -4 },
  headerBrandIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.panel2 },
  headerCopy: { flex: 1, minWidth: 0, paddingHorizontal: 10 },
  title: { color: colors.text, fontSize: 21, fontWeight: "900", letterSpacing: -0.25 },
  subtitle: { color: colors.muted, marginTop: 2, fontSize: 11 },
  headerAction: { minWidth: 46, minHeight: 42, paddingHorizontal: 8, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border },
  actionText: { color: "#a99cff", fontWeight: "800", fontSize: 13 },
  headerSpacer: { width: 46 },
  overlay: { flex: 1, flexDirection: "row" },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.68)" },
  drawer: { width: "84%", maxWidth: 360, backgroundColor: colors.bg, borderRightWidth: 1, borderRightColor: colors.border },
  drawerHeader: { paddingHorizontal: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.border },
  drawerBrandRow: { flexDirection: "row", alignItems: "center", minWidth: 0, flex: 1 },
  drawerBrandIcon: { width: 44, height: 44, borderRadius: 13, marginRight: 11 },
  brand: { color: colors.text, fontSize: 23, fontWeight: "900" },
  drawerUser: { color: colors.muted, fontSize: 12, marginTop: 4 },
  closeButton: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel2 },
  closeText: { color: colors.text, fontSize: 30, lineHeight: 30 },
  drawerList: { padding: 12, gap: 5 },
  menuItem: { minHeight: 60, borderRadius: 16, flexDirection: "row", alignItems: "center", padding: 8 },
  menuItemActive: { backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border },
  menuIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel },
  menuIconBoxActive: { backgroundColor: colors.accent },
  menuItemIcon: { color: colors.muted, fontSize: 22 },
  menuItemIconActive: { color: "#fff" },
  menuItemCopy: { flex: 1, minWidth: 0, paddingHorizontal: 10 },
  menuLabel: { color: colors.text, fontSize: 14, fontWeight: "800" },
  menuLabelActive: { color: "#fff" },
  menuDescription: { color: colors.muted, fontSize: 10, marginTop: 2 },
  chevron: { color: colors.muted, fontSize: 25, paddingHorizontal: 6 },
  menuDivider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  signOutItem: { minHeight: 68, borderRadius: 17, flexDirection: "row", alignItems: "center", padding: 9 },
  signOutIcon: { color: "#ff7474", fontSize: 22 },
  signOutText: { color: "#ff8b8b", fontSize: 15, fontWeight: "800" },
});
