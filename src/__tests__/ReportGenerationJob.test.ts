import { ReportGenerationJob } from '../jobs/ReportGenerationJob';
import { Task } from '../models/Task';
import { Workflow } from '../models/Workflow';
import { Result } from '../models/Result';
import { TaskStatus } from '../workers/taskRunner';
import { WorkflowStatus } from '../workflows/WorkflowFactory';
import { AppDataSource } from '../data-source';

// Mock the AppDataSource
jest.mock('../data-source', () => ({
    AppDataSource: {
        getRepository: jest.fn()
    }
}));

describe('ReportGenerationJob', () => {
    let job: ReportGenerationJob;
    let mockTaskRepository: any;
    let mockResultRepository: any;

    beforeEach(() => {
        job = new ReportGenerationJob();

        mockTaskRepository = {
            find: jest.fn()
        };

        mockResultRepository = {
            findOne: jest.fn()
        };

        (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
            if (entity === Task) return mockTaskRepository;
            if (entity === Result) return mockResultRepository;
            return {};
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const createMockWorkflow = (): Workflow => {
        const workflow = new Workflow();
        workflow.workflowId = 'test-workflow-id';
        workflow.clientId = 'test-client';
        workflow.status = WorkflowStatus.InProgress;
        return workflow;
    };

    const createMockTask = (
        taskId: string,
        taskType: string,
        status: TaskStatus,
        stepNumber: number,
        workflow: Workflow,
        resultId?: string
    ): Task => {
        const task = new Task();
        task.taskId = taskId;
        task.clientId = 'test-client';
        task.geoJson = '{}';
        task.status = status;
        task.taskType = taskType;
        task.stepNumber = stepNumber;
        task.workflow = workflow;
        task.resultId = resultId;
        return task;
    };

    describe('run', () => {
        it('should generate report with completed tasks', async () => {
            const workflow = createMockWorkflow();
            const reportTask = createMockTask('report-task', 'report', TaskStatus.InProgress, 3, workflow);

            const task1 = createMockTask('task-1', 'polygonArea', TaskStatus.Completed, 1, workflow, 'result-1');
            const task2 = createMockTask('task-2', 'analysis', TaskStatus.Completed, 2, workflow, 'result-2');

            mockTaskRepository.find.mockResolvedValue([task1, task2, reportTask]);
            mockResultRepository.findOne
                .mockResolvedValueOnce({ resultId: 'result-1', data: JSON.stringify({ area: 1000, unit: 'square meters' }) })
                .mockResolvedValueOnce({ resultId: 'result-2', data: JSON.stringify('Brazil') });

            const result = await job.run(reportTask);

            expect(result).toHaveProperty('workflowId', 'test-workflow-id');
            expect(result).toHaveProperty('tasks');
            expect(result.tasks).toHaveLength(2);
            expect(result).toHaveProperty('summary');
            expect(result.summary.total).toBe(2);
            expect(result.summary.completed).toBe(2);
            expect(result.summary.failed).toBe(0);
            expect(result).toHaveProperty('finalReport');
            expect(result).toHaveProperty('generatedAt');
        });

        it('should handle failed tasks in report', async () => {
            const workflow = createMockWorkflow();
            const reportTask = createMockTask('report-task', 'report', TaskStatus.InProgress, 3, workflow);

            const task1 = createMockTask('task-1', 'polygonArea', TaskStatus.Completed, 1, workflow, 'result-1');
            const task2 = createMockTask('task-2', 'analysis', TaskStatus.Failed, 2, workflow);

            mockTaskRepository.find.mockResolvedValue([task1, task2, reportTask]);
            mockResultRepository.findOne.mockResolvedValueOnce({
                resultId: 'result-1',
                data: JSON.stringify({ area: 1000, unit: 'square meters' })
            });

            const result = await job.run(reportTask);

            expect(result.summary.completed).toBe(1);
            expect(result.summary.failed).toBe(1);

            const failedTask = result.tasks.find(t => t.taskId === 'task-2');
            expect(failedTask).toHaveProperty('error', 'Task execution failed');
        });

        it('should exclude current report task from aggregation', async () => {
            const workflow = createMockWorkflow();
            const reportTask = createMockTask('report-task', 'report', TaskStatus.InProgress, 2, workflow);
            const task1 = createMockTask('task-1', 'polygonArea', TaskStatus.Completed, 1, workflow, 'result-1');

            mockTaskRepository.find.mockResolvedValue([task1, reportTask]);
            mockResultRepository.findOne.mockResolvedValueOnce({
                resultId: 'result-1',
                data: JSON.stringify({ area: 1000, unit: 'square meters' })
            });

            const result = await job.run(reportTask);

            // Should only include task1, not the report task itself
            expect(result.tasks).toHaveLength(1);
            expect(result.tasks[0].taskId).toBe('task-1');
        });

        it('should handle tasks with no result data', async () => {
            const workflow = createMockWorkflow();
            const reportTask = createMockTask('report-task', 'report', TaskStatus.InProgress, 2, workflow);
            const task1 = createMockTask('task-1', 'notification', TaskStatus.Completed, 1, workflow, 'result-1');

            mockTaskRepository.find.mockResolvedValue([task1, reportTask]);
            mockResultRepository.findOne.mockResolvedValueOnce({
                resultId: 'result-1',
                data: null
            });

            const result = await job.run(reportTask);

            expect(result.tasks).toHaveLength(1);
            expect(result.tasks[0].output).toBeUndefined();
        });
    });
});
