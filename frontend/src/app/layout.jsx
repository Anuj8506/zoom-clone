import "@livekit/components-styles";
import "./globals.css";
import EntryGate from "@/components/layout/EntryGate";

export const metadata = {
  title: "Zoom Clone | Meet simply",
  description:
    "A simple video meeting app. Start, join, and schedule your next conversation.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <EntryGate>{children}</EntryGate>
      </body>
    </html>
  );
}
