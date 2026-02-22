import { Task } from '../models/Task';
import { Workflow } from '../models/Workflow';
import { TaskStatus } from '../workers/taskRunner';
import { WorkflowStatus } from '../workflows/WorkflowFactory';

describe('Task Dependencies', () => {
    describe('Task.getDependencyStepIds', () => {
        it('should return empty array when no dependencies', () => {
            const task = new Task();
            task.dependsOn = undefined;

            expect(task.getDependencyStepIds()).toEqual([]);
        });

        it('should return empty array for empty string', () => {
            const task = new Task();
            task.dependsOn = '';

            expect(task.getDependencyStepIds()).toEqual([]);
        });

        it('should parse single dependency', () => {
            const task = new Task();
            task.dependsOn = 'step1';

            expect(task.getDependencyStepIds()).toEqual(['step1']);
        });

        it('should parse multiple dependencies', () => {
            const task = new Task();
            task.dependsOn = 'step1,step2,step3';

            expect(task.getDependencyStepIds()).toEqual(['step1', 'step2', 'step3']);
        });

        it('should trim whitespace from dependencies', () => {
            const task = new Task();
            task.dependsOn = ' step1 , step2 , step3 ';

            expect(task.getDependencyStepIds()).toEqual(['step1', 'step2', 'step3']);
        });

        it('should filter out empty strings', () => {
            const task = new Task();
            task.dependsOn = 'step1,,step2';

            const result = task.getDependencyStepIds();
            expect(result).not.toContain('');
            expect(result).toEqual(['step1', 'step2']);
        });
    });

    describe('Task Entity Fields', () => {
        it('should have stepId field', () => {
            const task = new Task();
            task.stepId = 'custom-step-id';

            expect(task.stepId).toBe('custom-step-id');
        });

        it('should have dependsOn field', () => {
            const task = new Task();
            task.dependsOn = 'step1,step2';

            expect(task.dependsOn).toBe('step1,step2');
        });
    });

    describe('Workflow Entity Fields', () => {
        it('should have finalResult field', () => {
            const workflow = new Workflow();
            workflow.finalResult = JSON.stringify({ results: [] });

            expect(workflow.finalResult).toBeDefined();
            expect(JSON.parse(workflow.finalResult)).toHaveProperty('results');
        });
    });
});

describe('Dependency Resolution Logic', () => {
    // Helper to create tasks
    const createTask = (
        taskId: string,
        stepId: string,
        status: TaskStatus,
        dependsOn?: string
    ): Task => {
        const task = new Task();
        task.taskId = taskId;
        task.stepId = stepId;
        task.status = status;
        task.dependsOn = dependsOn;
        return task;
    };

    it('should identify task with no dependencies as runnable', () => {
        const task = createTask('task-1', 'step1', TaskStatus.Queued);
        const workflowTasks = [task];

        const canRun = checkDependenciesCompleted(task, workflowTasks);
        expect(canRun).toBe(true);
    });

    it('should identify task with completed dependencies as runnable', () => {
        const task1 = createTask('task-1', 'step1', TaskStatus.Completed);
        const task2 = createTask('task-2', 'step2', TaskStatus.Queued, 'step1');
        const workflowTasks = [task1, task2];

        const canRun = checkDependenciesCompleted(task2, workflowTasks);
        expect(canRun).toBe(true);
    });

    it('should identify task with incomplete dependencies as not runnable', () => {
        const task1 = createTask('task-1', 'step1', TaskStatus.InProgress);
        const task2 = createTask('task-2', 'step2', TaskStatus.Queued, 'step1');
        const workflowTasks = [task1, task2];

        const canRun = checkDependenciesCompleted(task2, workflowTasks);
        expect(canRun).toBe(false);
    });

    it('should handle multiple dependencies - all completed', () => {
        const task1 = createTask('task-1', 'step1', TaskStatus.Completed);
        const task2 = createTask('task-2', 'step2', TaskStatus.Completed);
        const task3 = createTask('task-3', 'step3', TaskStatus.Queued, 'step1,step2');
        const workflowTasks = [task1, task2, task3];

        const canRun = checkDependenciesCompleted(task3, workflowTasks);
        expect(canRun).toBe(true);
    });

    it('should handle multiple dependencies - one incomplete', () => {
        const task1 = createTask('task-1', 'step1', TaskStatus.Completed);
        const task2 = createTask('task-2', 'step2', TaskStatus.InProgress);
        const task3 = createTask('task-3', 'step3', TaskStatus.Queued, 'step1,step2');
        const workflowTasks = [task1, task2, task3];

        const canRun = checkDependenciesCompleted(task3, workflowTasks);
        expect(canRun).toBe(false);
    });

    it('should return false for missing dependency', () => {
        const task2 = createTask('task-2', 'step2', TaskStatus.Queued, 'step1');
        const workflowTasks = [task2]; // step1 doesn't exist

        const canRun = checkDependenciesCompleted(task2, workflowTasks);
        expect(canRun).toBe(false);
    });
});

// Helper function to check dependencies (mimics taskWorker logic)
function checkDependenciesCompleted(task: Task, workflowTasks: Task[]): boolean {
    const dependencyStepIds = task.getDependencyStepIds();

    if (dependencyStepIds.length === 0) {
        return true;
    }

    for (const depStepId of dependencyStepIds) {
        const depTask = workflowTasks.find(t => t.stepId === depStepId);

        if (!depTask) {
            return false;
        }

        if (depTask.status !== TaskStatus.Completed) {
            return false;
        }
    }

    return true;
}
