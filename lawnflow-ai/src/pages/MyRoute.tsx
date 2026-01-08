import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Camera } from 'lucide-react';

const MyRoute = () => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Current Job</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold">123 Main St, Anytown, USA</p>
          <ul className="list-disc list-inside mt-2 text-muted-foreground">
            <li>Mow</li>
            <li>Edge</li>
            <li>Blow</li>
          </ul>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Button size="lg" className="w-full h-16 text-lg">
          Start Job
        </Button>
        <Button size="lg" className="w-full h-16 text-lg" disabled>
          Complete Job
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proof of Work</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg">
            <div className="text-center">
              <Camera className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Tap to upload photos
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Button size="lg" variant="destructive" className="w-full h-16 text-lg">
        Clock Out
      </_Button>
    </div>
  );
};

export default MyRoute;