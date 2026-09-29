import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "入职任务地图",
  description: "新成员自助跟进入职事项：依赖、状态、逾期一目了然",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
