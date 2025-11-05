export const metadata = {
  title: "AI Chat",
  description: "WebLLM-powered AI chat running in your browser",
};

import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
