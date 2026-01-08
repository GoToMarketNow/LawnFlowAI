import MetricCard from '../components/MetricCard';
import SystemLog from '../components/SystemLog';
import WorkflowVisualizer from '../components/WorkflowVisualizer';
import { DollarSign, Zap, Activity } from 'lucide-react';

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Total ROI"
          value="$12,408"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Leads Recovered"
          value="152"
          icon={<Zap className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Active Workflows"
          value="12"
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <WorkflowVisualizer />
        </div>
        <div className="lg:col-span-3">
          <SystemLog />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;