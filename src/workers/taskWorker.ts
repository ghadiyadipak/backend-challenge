import {AppDataSource} from '../data-source';
import {Task} from '../models/Task';
import {TaskRunner, TaskStatus} from './taskRunner';
import { Repository } from 'typeorm';

export async function taskWorker() {
    const taskRepository = AppDataSource.getRepository(Task);
    const taskRunner = new TaskRunner(taskRepository);

    while (true) {
        try {
            // Get all queued tasks ordered by step number
            const queuedTasks = await taskRepository.find({
                where: { status: TaskStatus.Queued },
                relations: ['workflow'],
                order: { stepNumber: 'ASC' }
            });

            // Find a task that has all dependencies completed
            let taskToRun: Task | null = null;

            for (const task of queuedTasks) {
                const dependencyStatus = await checkDependencyStatus(taskRepository, task);

                if (dependencyStatus === 'ready') {
                    taskToRun = task;
                    break;
                } else if (dependencyStatus === 'failed') {
                    // Mark task as failed if any dependency failed
                    task.status = TaskStatus.Failed;
                    task.progress = 'Dependency task failed';
                    await taskRepository.save(task);
                    console.log(`Task ${task.taskId} marked as failed due to failed dependency`);
                }
                // If 'pending', continue to next task
            }

            if (taskToRun) {
                try {
                    await taskRunner.run(taskToRun);
                } catch (error) {
                    console.error('Task execution failed. Task status has already been updated by TaskRunner.');
                    console.error(error);
                }
            }
        } catch (error) {
            console.error('Error in task worker loop:', error);
        }

        // Wait before checking for the next task again
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

type DependencyStatus = 'ready' | 'pending' | 'failed';

/**
 * Check the status of all dependencies for a task
 * Returns:
 * - 'ready': All dependencies are completed, task can run
 * - 'pending': Some dependencies are still in progress/queued
 * - 'failed': At least one dependency has failed
 */
async function checkDependencyStatus(
    taskRepository: Repository<Task>,
    task: Task
): Promise<DependencyStatus> {
    const dependencyStepIds = task.getDependencyStepIds();

    // If no dependencies, task can run
    if (dependencyStepIds.length === 0) {
        return 'ready';
    }

    // Get all tasks in the same workflow
    const workflowTasks = await taskRepository.find({
        where: { workflow: { workflowId: task.workflow.workflowId } }
    });

    // Check status of all dependency tasks
    for (const depStepId of dependencyStepIds) {
        const depTask = workflowTasks.find(t => t.stepId === depStepId);

        if (!depTask) {
            console.warn(`Dependency ${depStepId} not found for task ${task.taskId}`);
            return 'failed';
        }

        if (depTask.status === TaskStatus.Failed) {
            return 'failed';
        }

        if (depTask.status !== TaskStatus.Completed) {
            // Dependency not completed yet (queued or in progress)
            return 'pending';
        }
    }

    return 'ready';
}