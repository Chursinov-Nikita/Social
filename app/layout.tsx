import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import Header from "./components/header/page";
import { AuthProvider } from "./context/auth";
import { LanguageProvider } from "./context/language";

const nunito = Nunito({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NEBL",
  description: "Speaking with everyone",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${nunito.className} antialiased`}>
        <AuthProvider>
          <LanguageProvider>
            <Header />
            <main className="pt-15 bg-(--bg-primary) ">{children}</main>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
