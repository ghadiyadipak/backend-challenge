import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { Workflow } from '../models/Workflow';
import { TaskStatus } from '../workers/taskRunner';
import { WorkflowStatus } from '../workflows/WorkflowFactory';

const router = Router();

/**
 * GET /workflow/:id/status
 * Returns the current status of a workflow including task progress
 */
router.get('/:id/status', async (req, res): Promise<void> => {
    const { id } = req.params;

    try {
        const workflowRepository = AppDataSource.getRepository(Workflow);
        const workflow = await workflowRepository.findOne({
            where: { workflowId: id },
            relations: ['tasks']
        });

        if (!workflow) {
            res.status(404).json({
                error: 'Workflow not found',
                workflowId: id
            });
            return;
        }

        const totalTasks = workflow.tasks.length;
        const completedTasks = workflow.tasks.filter(
            t => t.status === TaskStatus.Completed
        ).length;
        const failedTasks = workflow.tasks.filter(
            t => t.status === TaskStatus.Failed
        ).length;
        const inProgressTasks = workflow.tasks.filter(
            t => t.status === TaskStatus.InProgress
        ).length;

        res.json({
            workflowId: workflow.workflowId,
            status: workflow.status,
            completedTasks,
            failedTasks,
            inProgressTasks,
            totalTasks
        });
    } catch (error: any) {
        console.error('Error fetching workflow status:', error);
        res.status(500).json({
            error: 'Failed to fetch workflow status',
            message: error.message
        });
    }
});

/**
 * GET /workflow/:id/results
 * Returns the final results of a completed workflow
 */
router.get('/:id/results', async (req, res): Promise<void> => {
    const { id } = req.params;

    try {
        const workflowRepository = AppDataSource.getRepository(Workflow);
        const workflow = await workflowRepository.findOne({
            where: { workflowId: id }
        });

        if (!workflow) {
            res.status(404).json({
                error: 'Workflow not found',
                workflowId: id
            });
            return;
        }

        // Check if workflow is completed or failed
        if (workflow.status !== WorkflowStatus.Completed &&
            workflow.status !== WorkflowStatus.Failed) {
            res.status(400).json({
                error: 'Workflow not yet completed',
                workflowId: id,
                currentStatus: workflow.status
            });
            return;
        }

        // Parse finalResult if it exists
        let finalResult = null;
        if (workflow.finalResult) {
            try {
                finalResult = JSON.parse(workflow.finalResult);
            } catch {
                finalResult = workflow.finalResult;
            }
        }

        res.json({
            workflowId: workflow.workflowId,
            status: workflow.status,
            finalResult
        });
    } catch (error: any) {
        console.error('Error fetching workflow results:', error);
        res.status(500).json({
            error: 'Failed to fetch workflow results',
            message: error.message
        });
    }
});

export default router;
