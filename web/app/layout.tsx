import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/toast";
import { AuthProvider } from "@/lib/auth";
import { RouteProgress } from "@/components/route-progress";

export const metadata: Metadata = {
  title: "ServerNest - Minecraft Server Panel",
  description: "Free, self-hosted Minecraft server management panel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){for(var i=0;i<rs.length;i++){rs[i].unregister();}}).catch(function(){});}`,
          }}
        />
        <RouteProgress />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
