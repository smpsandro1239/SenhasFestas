import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SenhasFestas - Gestão de Pedidos para Festas',
  description: 'Sistema de gestão de senhas, pedidos e consumo para festas de aldeia',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-PT">
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}