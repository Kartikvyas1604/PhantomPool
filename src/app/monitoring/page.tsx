/**
 * PhantomPool Monitoring Dashboard Page
 * Production-ready system monitoring and observability interface
 */

import { SystemMonitoringDashboard } from '@/components/SystemMonitoringDashboard';

export default function MonitoringPage() {
  return <SystemMonitoringDashboard />;
}

export const metadata = {
  title: 'System Monitoring - PhantomPool',
  description: 'Real-time system monitoring and observability dashboard for PhantomPool trading infrastructure',
};