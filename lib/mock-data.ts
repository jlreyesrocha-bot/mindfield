export interface Sphere {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export const MOCK_SPHERES: Sphere[] = [
  { id: '1',  name: 'Espiritualidad',        emoji: '🕊️', color: '#f59e0b' },
  { id: '2',  name: 'Dinero y Finanzas',      emoji: '💰', color: '#10b981' },
  { id: '3',  name: 'Aprendizajes',           emoji: '📚', color: '#3b82f6' },
  { id: '4',  name: 'Trabajo',                emoji: '💼', color: '#7c3aed' },
  { id: '5',  name: 'Creatividad',            emoji: '🎨', color: '#f43f5e' },
  { id: '6',  name: 'Relaciones',             emoji: '🤝', color: '#f97316' },
  { id: '7',  name: 'Amigos',                 emoji: '👥', color: '#eab308' },
  { id: '8',  name: 'Familia',                emoji: '👨‍👩‍👧', color: '#ef4444' },
  { id: '9',  name: 'Salud Física y Mental',  emoji: '🧘', color: '#06b6d4' },
  { id: '10', name: 'Proyectos Personales',   emoji: '🚀', color: '#6366f1' },
  { id: '11', name: 'Ideas Sueltas',          emoji: '💡', color: '#94a3b8' },
];
