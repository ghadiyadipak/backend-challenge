import request from 'supertest';
import express from 'express';
import { Workflow } from '../models/Workflow';
import { Task } from '../models/Task';
import { TaskStatus } from '../workers/taskRunner';
import { WorkflowStatus } from '../workflows/WorkflowFactory';

// Mock the data source
jest.mock('../data-source', () => ({
    AppDataSource: {
        getRepository: jest.fn()
    }
}));

import { AppDataSource } from '../data-source';
import workflowRoutes from '../routes/workflowRoutes';

describe('Workflow Routes', () => {
    let app: express.Application;
    let mockWorkflowRepository: any;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/workflow', workflowRoutes);

        mockWorkflowRepository = {
            findOne: jest.fn()
        };

        (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockWorkflowRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /workflow/:id/status', () => {
        it('should return workflow status with task counts', async () => {
            const mockWorkflow = new Workflow();
            mockWorkflow.workflowId = 'test-workflow-id';
            mockWorkflow.clientId = 'test-client';
            mockWorkflow.status = WorkflowStatus.InProgress;
            mockWorkflow.tasks = [
                createMockTask('task-1', TaskStatus.Completed),
                createMockTask('task-2', TaskStatus.Completed),
                createMockTask('task-3', TaskStatus.InProgress),
                createMockTask('task-4', TaskStatus.Queued)
            ];

            mockWorkflowRepository.findOne.mockResolvedValue(mockWorkflow);

            const response = await request(app)
                .get('/workflow/test-workflow-id/status')
                .expect(200);

            expect(response.body).toEqual({
                workflowId: 'test-workflow-id',
                status: 'in_progress',
                completedTasks: 2,
                failedTasks: 0,
                inProgressTasks: 1,
                totalTasks: 4
            });
        });

        it('should return 404 for non-existent workflow', async () => {
            mockWorkflowRepository.findOne.mockResolvedValue(null);

            const response = await request(app)
                .get('/workflow/non-existent-id/status')
                .expect(404);

            expect(response.body).toEqual({
                error: 'Workflow not found',
                workflowId: 'non-existent-id'
            });
        });

        it('should count failed tasks correctly', async () => {
            const mockWorkflow = new Workflow();
            mockWorkflow.workflowId = 'test-workflow-id';
            mockWorkflow.status = WorkflowStatus.Failed;
            mockWorkflow.tasks = [
                createMockTask('task-1', TaskStatus.Completed),
                createMockTask('task-2', TaskStatus.Failed),
                createMockTask('task-3', TaskStatus.Failed)
            ];

            mockWorkflowRepository.findOne.mockResolvedValue(mockWorkflow);

            const response = await request(app)
                .get('/workflow/test-workflow-id/status')
                .expect(200);

            expect(response.body.completedTasks).toBe(1);
            expect(response.body.failedTasks).toBe(2);
            expect(response.body.totalTasks).toBe(3);
        });
    });

    describe('GET /workflow/:id/results', () => {
        it('should return final results for completed workflow', async () => {
            const mockWorkflow = new Workflow();
            mockWorkflow.workflowId = 'test-workflow-id';
            mockWorkflow.status = WorkflowStatus.Completed;
            mockWorkflow.finalResult = JSON.stringify({
                results: [{ taskId: 'task-1', output: 'test' }],
                summary: { total: 1, completed: 1, failed: 0 }
            });

            mockWorkflowRepository.findOne.mockResolvedValue(mockWorkflow);

            const response = await request(app)
                .get('/workflow/test-workflow-id/results')
                .expect(200);

            expect(response.body.workflowId).toBe('test-workflow-id');
            expect(response.body.status).toBe('completed');
            expect(response.body.finalResult).toHaveProperty('results');
            expect(response.body.finalResult).toHaveProperty('summary');
        });

        it('should return 404 for non-existent workflow', async () => {
            mockWorkflowRepository.findOne.mockResolvedValue(null);

            const response = await request(app)
                .get('/workflow/non-existent-id/results')
                .expect(404);

            expect(response.body).toEqual({
                error: 'Workflow not found',
                workflowId: 'non-existent-id'
            });
        });

        it('should return 400 for in-progress workflow', async () => {
            const mockWorkflow = new Workflow();
            mockWorkflow.workflowId = 'test-workflow-id';
            mockWorkflow.status = WorkflowStatus.InProgress;

            mockWorkflowRepository.findOne.mockResolvedValue(mockWorkflow);

            const response = await request(app)
                .get('/workflow/test-workflow-id/results')
                .expect(400);

            expect(response.body).toEqual({
                error: 'Workflow not yet completed',
                workflowId: 'test-workflow-id',
                currentStatus: 'in_progress'
            });
        });

        it('should return 400 for initial workflow', async () => {
            const mockWorkflow = new Workflow();
            mockWorkflow.workflowId = 'test-workflow-id';
            mockWorkflow.status = WorkflowStatus.Initial;

            mockWorkflowRepository.findOne.mockResolvedValue(mockWorkflow);

            const response = await request(app)
                .get('/workflow/test-workflow-id/results')
                .expect(400);

            expect(response.body.error).toBe('Workflow not yet completed');
        });

        it('should return results for failed workflow', async () => {
            const mockWorkflow = new Workflow();
            mockWorkflow.workflowId = 'test-workflow-id';
            mockWorkflow.status = WorkflowStatus.Failed;
            mockWorkflow.finalResult = JSON.stringify({
                results: [{ taskId: 'task-1', status: 'failed', error: 'Error message' }],
                summary: { total: 1, completed: 0, failed: 1 }
            });

            mockWorkflowRepository.findOne.mockResolvedValue(mockWorkflow);

            const response = await request(app)
                .get('/workflow/test-workflow-id/results')
                .expect(200);

            expect(response.body.status).toBe('failed');
            expect(response.body.finalResult).toBeDefined();
        });
    });
});

// Helper function to create mock tasks
function createMockTask(taskId: string, status: TaskStatus): Task {
    const task = new Task();
    task.taskId = taskId;
    task.status = status;
    return task;
}
