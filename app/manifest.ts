import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pagger | PDF & Document Reader Workspace",
    short_name: "Pagger",
    description: "Distraction-free document reading, stylus ink drawing, e-signatures, notes, and study tools.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0f172a",
    theme_color: "#4f46e5",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
