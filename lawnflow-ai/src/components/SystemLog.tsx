
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const logEntries = [
  { time: '10:45:12', agent: 'IntakeAgent', message: 'New lead received from web form: john.doe@example.com' },
  { time: '10:45:13', agent: 'Supervisor', message: 'Routing lead to QuoteAgent' },
  { time: '10:45:15', agent: 'QuoteAgent', message: 'Analyzing property at 123 Main St... high complexity detected.' },
  { time: '10:45:18', agent: 'QuoteAgent', message: 'Confidence score 65%. Sending for human approval.' },
];

const SystemLog = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Log</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-gray-900 text-white font-mono text-sm p-4 rounded-lg h-64 overflow-y-auto">
          {logEntries.map((entry, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-gray-500">{entry.time}</span>
              <span className="text-green-400">[{entry.agent}]</span>
              <span>{entry.message}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SystemLog;
