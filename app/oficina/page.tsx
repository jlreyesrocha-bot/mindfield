import type { Metadata, Viewport } from 'next';
import Oficina from '@/components/oficina/Oficina';

export const metadata: Metadata = {
  title: 'MANDO · Oficina 3D',
  description: 'Maqueta jugable: dirige una agencia desde arriba, con cámara de estrategia y personas con ánimo, estrés y energía.',
};

export const viewport: Viewport = { themeColor: '#0C0420', width: 'device-width', initialScale: 1 };

export default function OficinaPage() {
  return <Oficina />;
}
