import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Socialhub",
    short_name: "Socialhub",
    description: "A modern social network for posts, stories, messaging and communities.",
    start_url: "/home",
    display: "standalone",
    background_color: "#08080c",
    theme_color: "#08080c",
    orientation: "portrait",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}
