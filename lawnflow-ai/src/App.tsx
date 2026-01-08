import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { MobileFocusLayout } from './layouts/MobileFocusLayout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const PendingActions = lazy(() => import('./pages/PendingActions'));
const JobMap = lazy(() => import('./pages/JobMap'));
const MyRoute = lazy(() => import('./pages/MyRoute'));
const AgentConfig = lazy(() => import('./pages/AgentConfig'));

// Mock user role
const userRole = 'owner'; // or 'crew-leader', 'crew-member'

function App() {
  return (
    <Router>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          {userRole === 'crew-member' ? (
            <Route path="/" element={<MobileFocusLayout />}>
              <Route index element={<MyRoute />} />
              <Route path="my-route" element={<MyRoute />} />
              {/* Add other crew-member specific routes here */}
            </Route>
          ) : (
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="pending-actions" element={<PendingActions />} />
              <Route path="job-map" element={<JobMap />} />
              <Route path="my-route" element={<MyRoute />} />
              <Route path="agent-config" element={<AgentConfig />} />
            </Route>
          )}
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;