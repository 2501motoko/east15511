import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "吾一一事务所",
  description: "吾一一事务所的课程资料、DDL 与活动、值日、运动记录、照片墙和茶楼讨论。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
