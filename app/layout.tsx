import type { Metadata } from "next";
import { Baloo_2, Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import AuthSync from "@/context/auth-sync";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dots — Learn English with DOTY",
  description:
    "Practice English the fun way. DOTY cheers you on through levels, streaks and games — for kids and grown-ups.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply saved theme BEFORE first paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("dots-theme")||"light";document.documentElement.setAttribute("data-theme",t);if(t==="dark")document.documentElement.classList.add("dark");document.documentElement.style.colorScheme=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${nunito.variable} ${baloo.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <AuthSync />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
