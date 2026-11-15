import type { Metadata, Viewport } from "next";
// الخطوط متضمّنة في الباندل (مش من Google) عشان تتحمّل من نفس السيرفر وبسرعة، وتشتغل حتى لو النت ضعيف
import "@fontsource-variable/noto-kufi-arabic";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "قندور — دورك بدون زحمة",
  description: "تابع دورك في الطابور لحظياً من موبايلك بدون تطبيق ولا تسجيل.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#3b4ce8" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // dir="rtl" على مستوى الصفحة كلها: العربي هو الأساس، مش إضافة لاحقة
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
