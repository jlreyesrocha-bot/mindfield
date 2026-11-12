import type { Metadata, Viewport } from 'next';
import './mando.css';

export const metadata: Metadata = {
  title: 'MANDO · Simulador de liderazgo',
  description:
    'Funda y dirige una agencia de brand experience. Decide cada semana sobre clientes, caja y personas, y descubre tu perfil de liderazgo.',
};

export const viewport: Viewport = {
  themeColor: '#0C0420',
  width: 'device-width',
  initialScale: 1,
};

export default function MandoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
