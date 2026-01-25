import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';


const agents = [
    { name: 'IntakeAgent', status: 'active', description: 'Monitors lead channels and creates new customer profiles.' },
    { name: 'QuoteAgent', status: 'active', description: 'Generates quotes based on property data and service requirements.' },
    { name: 'ScheduleAgent', status: 'test-mode', description: 'Optimizes routes and schedules jobs for crews.' },
    { name: 'RetentionAgent', status: 'inactive', description: 'Sends follow-up communication and offers to past clients.' },
]

const AgentConfig = () => {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Agent Directory</CardTitle>
            <CardDescription>Manage the status and behavior of your AI workforce.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {agents.map(agent => (
                 <div key={agent.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                        <p className="font-semibold">{agent.name}</p>
                        <p className="text-sm text-muted-foreground">{agent.description}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2">
                            <Switch id={`${agent.name}-status`} checked={agent.status === 'active'} />
                            <Label htmlFor={`${agent.name}-status`} className="capitalize">{agent.status}</Label>
                        </div>
                    </div>
                 </div>
            ))}
          </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Business Profile</CardTitle>
                <CardDescription>Update your company's core information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="business-name">Business Name</Label>
                    <Input id="business-name" defaultValue="LawnFlow.AI" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="pricing-tier">Pricing Tier</Label>
                    <Input id="pricing-tier" defaultValue="Standard" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="service-area">Service Area (Zip Codes)</Label>
                    <Input id="service-area" defaultValue="90210, 10001, 60606" />
                </div>
            </CardContent>
        </Card>
      </div>
      
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Agent Simulator</CardTitle>
            <CardDescription>Test how agents respond to mock events in a safe sandbox.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
                <Label htmlFor="mock-event">Mock Event Input</Label>
                <Input id="mock-event" placeholder="e.g., Customer SMS: Can you mow tomorrow at 3pm?" />
            </div>
            <Button>Simulate</Button>
            <div className="mt-4 p-4 h-48 bg-gray-900 text-white font-mono text-sm rounded-lg overflow-y-auto">
                <p><span className="text-green-400">[Supervisor]</span> Received mock event.</p>
                <p><span className="text-green-400">[Supervisor]</span> Event type: Customer SMS.</p>
                <p><span className="text-green-400">[Supervisor]</span> Routing to IntakeAgent.</p>
                <p><span className="text-yellow-400">[IntakeAgent]</span> Identified customer: cust_123.</p>
                <p><span className="text-yellow-400">[IntakeAgent]</span> Parsed intent: Schedule Request.</p>
                <p><span className="text-green-400">[Supervisor]</span> Routing to ScheduleAgent.</p>
                <p><span className="text-cyan-400">[ScheduleAgent]</span> Checking availability for tomorrow at 3pm...</p>
                <p><span className="text-cyan-400">[ScheduleAgent]</span> ...Crew #2 is available. Proposed response: "We can do that! See you tomorrow at 3pm."</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Confidence Thresholds</CardTitle>
            <CardDescription>Set how confident an agent must be to act autonomously vs. asking for human approval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
             <div className="space-y-3">
                <Label>QuoteAgent Confidence</Label>
                <Slider defaultValue={[80]} max={100} step={1} />
                <p className="text-sm text-muted-foreground">Threshold: 80%</p>
             </div>
             <div className="space-y-3">
                <Label>ScheduleAgent Confidence</Label>
                <Slider defaultValue={[75]} max={100} step={1} />
                <p className="text-sm text-muted-foreground">Threshold: 75%</p>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AgentConfig;