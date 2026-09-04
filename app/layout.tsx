import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Escritório",
  description: "Uma empresa tocada por agentes de IA, em tempo real.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
