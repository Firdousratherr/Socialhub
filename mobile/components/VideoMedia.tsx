import React from "react";
import { StyleSheet, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

export default function VideoMedia({
  uri,
  height = 320,
  autoPlay = false,
  loop = true,
}: {
  uri: string;
  height?: number;
  autoPlay?: boolean;
  loop?: boolean;
}) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = loop;
    if (autoPlay) instance.play();
  });

  return (
    <View style={[styles.container, { height }]}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        allowsFullscreen
        allowsPictureInPicture
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: "#050509",
  },
  video: {
    width: "100%",
    height: "100%",
  },
});
