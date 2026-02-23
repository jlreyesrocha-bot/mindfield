'use client';

import { useState } from 'react';
import { Sphere } from '@/lib/mock-data';

interface User {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface DashboardClientProps {
  user?: User | null;
  initialSpheres: Sphere[];
}

export default function DashboardClient({ user = null, initialSpheres }: DashboardClientProps) {
  const [spheres] = useState<Sphere[]>(initialSpheres);

  return (
    <div className="min-h-screen w-full bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold tracking-widest uppercase text-white">
          MINDFIELD
        </h1>
        {user ? (
          <span className="text-sm text-gray-400">
            {user.name ?? user.email}
          </span>
        ) : (
          <span className="text-xs bg-amber-500 text-black px-3 py-1 rounded-full font-bold uppercase tracking-wide">
            Demo Mode
          </span>
        )}
      </header>

      {/* Canvas */}
      <main className="flex-1 p-8 overflow-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
          {spheres.map((sphere) => (
            <div
              key={sphere.id}
              className="rounded-2xl p-5 flex flex-col items-center gap-3 cursor-pointer transition-transform hover:scale-105 active:scale-95"
              style={{
                backgroundColor: sphere.color + '18',
                border: `2px solid ${sphere.color}`,
              }}
            >
              <span className="text-4xl leading-none">{sphere.emoji}</span>
              <span
                className="text-xs font-semibold text-center leading-snug"
                style={{ color: sphere.color }}
              >
                {sphere.name}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
