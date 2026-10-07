import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors } from "../theme";

export function BrandMark({ size = 52, style }: { size?: number; style?: ViewStyle }) {
  const radius = Math.round(size * 0.28);
  return (
    <View
      accessibilityLabel="Socialhub"
      style={[
        styles.outer,
        {
          width: size,
          height: size,
          borderRadius: radius,
          shadowRadius: size * 0.35,
        },
        style,
      ]}
    >
      <View style={[styles.glow, { width: size * 0.86, height: size * 0.86, borderRadius: size * 0.25 }]} />
      <View
        style={[
          styles.mark,
          {
            width: size * 0.8,
            height: size * 0.8,
            borderRadius: size * 0.22,
          },
        ]}
      >
        <View
          style={[
            styles.inner,
            {
              width: size * 0.58,
              height: size * 0.58,
              borderRadius: size * 0.18,
            },
          ]}
        >
          <Text style={[styles.letter, { fontSize: size * 0.46, lineHeight: size * 0.5 }]}>S</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
    shadowColor: colors.accent,
    shadowOpacity: 0.34,
    elevation: 8,
  },
  glow: {
    position: "absolute",
    backgroundColor: "#3A2E86",
    opacity: 0.8,
  },
  mark: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    transform: [{ rotate: "8deg" }],
  },
  inner: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#5D45E8",
    transform: [{ rotate: "-8deg" }],
  },
  letter: {
    color: colors.white,
    fontWeight: "900",
    includeFontPadding: false,
  },
});
