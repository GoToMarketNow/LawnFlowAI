import { useState } from 'react';
import TaskCard from '../components/TaskCard';

const initialTasks = [
  {
    id: '1',
    agentName: 'QuoteAgent',
    confidenceScore: 65,
    reasonForStop: 'Unusual property shape detected.',
    suggestedAction: 'Increase quote by 15% for complexity.',
  },
  {
    id: '2',
    agentName: 'ScheduleAgent',
    confidenceScore: 72,
    reasonForStop: 'Client requested a time outside of normal hours.',
    suggestedAction: 'Approve overtime for Crew #3.',
  },
  {
    id: '3',
    agentName: 'IntakeAgent',
    confidenceScore: 55,
    reasonForStop: 'Vague service request from new lead.',
    suggestedAction: 'Send clarification email to lead.',
  },
];

const PendingActions = () => {
  const [tasks, setTasks] = useState(initialTasks);

  const handleApprove = (taskId: string) => {
    // Optimistically remove the task from the UI
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));

    // Here you would typically make an API call to approve the task
    console.log(`Task ${taskId} approved.`);
    // You can add a toast notification here
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Pending Actions</h1>
      <div className="space-y-4">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            {...task}
            // A real implementation would pass a proper handler
            // For now, we simulate the approve action
            // on the component itself for simplicity
          />
        ))}
      </div>
    </div>
  );
};

// This is a simplified example. In a real app, you'd likely
// pass a handler to the TaskCard itself.
const PatchedTaskCard = (props: any) => {
    const {id, agentName, confidenceScore, reasonForStop, suggestedAction, onApprove} = props
    return (
        <div>
            <TaskCard {...props}/>
            <button onClick={() => onApprove(id)}>Approve</button>
        </div>
    )
}


export default PendingActions;