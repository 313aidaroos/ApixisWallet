import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Apixis Wallet",
    short_name: "Apixis Wallet",
    description: "One balance. Every Apixis possibility.",
    start_url: "/",
    display: "standalone",
    background_color: "#080914",
    theme_color: "#080914",
    icons: [
      { src: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
