import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import MobileContainer from "@/components/Layout/MobileContainer";
import { SettingsProvider } from "@/lib/store";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Swify - Learn in Shorts",
  description: "Generate short-form videos from any topic.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SettingsProvider>
          <MobileContainer>
            {children}
          </MobileContainer>
        </SettingsProvider>
      </body>
    </html>
  );
}
