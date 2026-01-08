import { describe, it, expect, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import postJobQARoutes from '../server/routes-postjob-qa';
import * as engine from '../server/orchestrator/postJobQA/engine';

jest.mock('../server/orchestrator/postJobQA/engine', () => ({
  ...jest.requireActual('../server/orchestrator/postJobQA/engine'),
  getAllPostJobQAs: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use('/api', postJobQARoutes);

describe('Post Job QA API', () => {
  describe('GET /api/post-job-qa/health', () => {
    it('should return 200 OK and a status message', async () => {
      const res = await request(app).get('/api/post-job-qa/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'ok',
        service: 'post-job-qa',
        timestamp: expect.any(String),
      });
    });
  });

  describe('GET /api/post-job-qa', () => {
    it('should return a list of post job qas', async () => {
      const mockPostJobQAs = [
        { id: 1, name: 'Test QA 1' },
        { id: 2, name: 'Test QA 2' },
      ];
      (engine.getAllPostJobQAs as jest.Mock).mockResolvedValue(mockPostJobQAs);

      const res = await request(app).get('/api/post-job-qa');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        postJobQAs: mockPostJobQAs,
      });
    });
  });
});
