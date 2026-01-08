
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '../ui/card';
import { Button } from '../ui/button';
import { ThumbsUp, ThumbsDown, Edit } from 'lucide-react';

interface TaskCardProps {
  id: string;
  agentName: string;
  confidenceScore: number;
  reasonForStop: string;
  suggestedAction: string;
}

const TaskCard: React.FC<TaskCardProps> = ({
  id,
  agentName,
  confidenceScore,
  reasonForStop,
  suggestedAction,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {agentName} - Confidence: {confidenceScore}%
        </CardTitle>
        <CardDescription>{reasonForStop}</CardDescription>
      </CardHeader>
      <CardContent>
        <p>
          <strong>Suggested Action:</strong> {suggestedAction}
        </p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div>
          <Button variant="ghost" size="icon">
            <ThumbsUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <ThumbsDown className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Edit className="mr-2 h-4 w-4" /> Edit & Approve
          </Button>
          <Button>Approve</Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default TaskCard;
