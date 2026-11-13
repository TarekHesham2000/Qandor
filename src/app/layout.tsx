import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "قندور — دورك بدون زحمة",
  description: "تابع دورك في الطابور لحظياً من موبايلك بدون تطبيق ولا تسجيل.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // dir="rtl" على مستوى الصفحة كلها: العربي هو الأساس، مش إضافة لاحقة
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
