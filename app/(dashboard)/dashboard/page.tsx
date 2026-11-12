import { MOCK_SPHERES } from '@/lib/mock-data';
import DashboardClient from '@/components/DashboardClient';

export default function DashboardPage() {
  return <DashboardClient user={null} initialSpheres={MOCK_SPHERES} />;
}
