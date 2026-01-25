import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

const jobs = [
  { id: 'JOB-101', address: '123 Main St, Anytown, USA', status: 'Pending' },
  { id: 'JOB-102', address: '456 Oak Ave, Anytown, USA', status: 'In Progress' },
  { id: 'JOB-103', address: '789 Pine Ln, Anytown, USA', status: 'Pending' },
];

const crew = [
    { name: 'John D.', status: 'online'},
    { name: 'Jane S.', status: 'offline'},
    { name: 'Mike B.', status: 'online'},
]

const JobMap = () => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="lg:col-span-4 space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Today's Job Map</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-96 bg-gray-300 rounded-lg flex items-center justify-center">
                        <p className="text-gray-500">Map Placeholder</p>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Crew Status</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {crew.map(member => (
                    <div key={member.name} className="flex items-center gap-2">
                        <Avatar>
                            <AvatarImage src={`https://i.pravatar.cc/150?u=${member.name}`} />
                            <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-medium">{member.name}</p>
                            <div className="flex items-center gap-1">
                                <span className={`h-2 w-2 rounded-full ${member.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                <p className="text-xs text-muted-foreground">{member.status}</p>
                            </div>
                        </div>
                    </div>
                ))}
                </CardContent>
            </Card>
        </div>
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle>Route List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {jobs.map(job => (
                <div key={job.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-muted">
                  <div>
                    <p className="font-semibold">{job.id}</p>
                    <p className="text-sm text-muted-foreground">{job.address}</p>
                  </div>
                  <div className={`text-sm font-medium ${job.status === 'Pending' ? 'text-yellow-500' : 'text-green-500'}`}>
                    {job.status}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default JobMap;