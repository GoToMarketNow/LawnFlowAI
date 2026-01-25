import express, { Request, Response } from 'express';
import { processEvent, approveAction, rejectAction } from './agents/orchestrator';
import { EventPayload, ProcessingResult } from '@shared/schema'; // Assuming these types are available from shared schema

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello from the agent-service!');
});

app.post('/events', async (req: Request, res: Response) => {
  try {
    const payload: EventPayload = req.body;
    const result: ProcessingResult = await processEvent(payload);
    res.json(result);
  } catch (error: any) {
    console.error('Error processing event:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/actions/:id/approve', async (req: Request, res: Response) => {
  try {
    const actionId = parseInt(req.params.id, 10);
    const { notes } = req.body;
    const result = await approveAction(actionId, notes);
    res.json(result);
  } catch (error: any) {
    console.error('Error approving action:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/actions/:id/reject', async (req: Request, res: Response) => {
  try {
    const actionId = parseInt(req.params.id, 10);
    const { notes } = req.body;
    const result = await rejectAction(actionId, notes);
    res.json(result);
  } catch (error: any) {
    console.error('Error rejecting action:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(port, () => {
  console.log(`Agent service listening on port ${port}`);
});
