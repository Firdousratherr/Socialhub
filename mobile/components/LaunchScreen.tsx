import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { BrandMark } from "./BrandMark";
import { colors } from "../theme";

export default function LaunchScreen({ onFinished }: { onFinished: () => void }) {
  const scale = useRef(new Animated.Value(0.78)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const markTranslate = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(markTranslate, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 520, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.45, duration: 360, useNativeDriver: true }),
      ]),
    ]);

    animation.start();
    const timer = setTimeout(onFinished, 980);
    return () => clearTimeout(timer);
  }, [glow, markTranslate, onFinished, opacity, scale]);

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.orb,
          {
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.48] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.25] }) }],
          },
        ]}
      />
      <Animated.View style={{ opacity, transform: [{ translateY: markTranslate }, { scale }] }}>
        <BrandMark size={96} />
        <Text style={styles.brand}>Socialhub</Text>
        <Text style={styles.tagline}>Connect. Share. Belong.</Text>
      </Animated.View>
      <View style={styles.bottomHint}>
        <View style={styles.dot} />
        <Text style={styles.hint}>Your people. Your space.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.accent,
  },
  brand: {
    marginTop: 20,
    color: colors.text,
    textAlign: "center",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
  },
  tagline: {
    marginTop: 6,
    color: colors.muted,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
  },
  bottomHint: {
    position: "absolute",
    bottom: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accentBright,
  },
  hint: {
    color: colors.subtle,
    fontSize: 11,
    fontWeight: "700",
  },
});
