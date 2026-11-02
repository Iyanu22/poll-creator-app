import type { Metadata } from "next";
import { Gabarito, Karla } from "next/font/google";
import "./globals.css";

const gabarito = Gabarito({
  variable: "--font-gabarito",
  subsets: ["latin"],
});

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Tiebreak",
    template: "%s · Tiebreak",
  },
  description:
    "Settle group decisions. Polls that live in the group chat: no accounts for voters, and a reveal worth screenshotting.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${gabarito.variable} ${karla.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* First stop for keyboard users: past any header, to the content */}
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-cocoa px-5 py-3 font-bold text-cream-bright focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
