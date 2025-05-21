import '@/styles/globals.css';
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { Web3Provider } from '@/web3/providers/WagmiProvider';
import { Toaster } from 'react-hot-toast';
import StyledComponentsRegistry from '@/lib/registry';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  title: 'Nebula Platform',
  description: 'Decentralized IP Marketplace on Avalanche',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>
        <div className="stars-bg"></div>
        <StyledComponentsRegistry>
          <Web3Provider>
            {children}
            <Toaster position="bottom-right" />
          </Web3Provider>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
} 