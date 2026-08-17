import type { Metadata, Viewport } from "next";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import { AuthProvider } from "./components/AuthProvider";

export const metadata: Metadata = {
  title: "Warehouse Management",
  description: "Professional Warehouse Management System",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <div className="flex min-h-screen flex-col md:flex-row">
            <Sidebar />
            <main className="flex-1 pb-20 md:pb-0">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
