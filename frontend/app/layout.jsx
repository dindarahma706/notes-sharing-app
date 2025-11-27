import "./globals.css";

export const metadata = {
  title: "Notes App",
  description: "Pink pastel productivity notes app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-pink-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
