import { Job } from './Job';
import { Task } from '../models/Task';
import { Result } from '../models/Result';
import { AppDataSource } from '../data-source';
import { TaskStatus } from '../workers/taskRunner';

interface TaskReport {
    taskId: string;
    type: string;
    status: string;
    output?: any;
    error?: string;
}

interface WorkflowReport {
    workflowId: string;
    tasks: TaskReport[];
    summary: {
        total: number;
        completed: number;
        failed: number;
    };
    finalReport: string;
    generatedAt: string;
}

export class ReportGenerationJob implements Job {
    async run(task: Task): Promise<WorkflowReport> {
        console.log(`Generating report for task ${task.taskId}...`);

        const taskRepository = AppDataSource.getRepository(Task);
        const resultRepository = AppDataSource.getRepository(Result);

        // Get all tasks in the workflow except the current report task
        const workflowTasks = await taskRepository.find({
            where: { workflow: { workflowId: task.workflow.workflowId } },
            order: { stepNumber: 'ASC' }
        });

        const taskReports: TaskReport[] = [];
        let completedCount = 0;
        let failedCount = 0;

        for (const workflowTask of workflowTasks) {
            // Skip the current report generation task
            if (workflowTask.taskId === task.taskId) {
                continue;
            }

            const taskReport: TaskReport = {
                taskId: workflowTask.taskId,
                type: workflowTask.taskType,
                status: workflowTask.status
            };

            if (workflowTask.status === TaskStatus.Completed) {
                completedCount++;
                // Fetch the result for this task
                if (workflowTask.resultId) {
                    const result = await resultRepository.findOne({
                        where: { resultId: workflowTask.resultId }
                    });
                    if (result && result.data) {
                        try {
                            taskReport.output = JSON.parse(result.data);
                        } catch {
                            taskReport.output = result.data;
                        }
                    }
                }
            } else if (workflowTask.status === TaskStatus.Failed) {
                failedCount++;
                taskReport.error = 'Task execution failed';
            }

            taskReports.push(taskReport);
        }

        const report: WorkflowReport = {
            workflowId: task.workflow.workflowId,
            tasks: taskReports,
            summary: {
                total: taskReports.length,
                completed: completedCount,
                failed: failedCount
            },
            finalReport: this.generateFinalReportSummary(taskReports),
            generatedAt: new Date().toISOString()
        };

        console.log(`Report generated for workflow ${task.workflow.workflowId}`);

        return report;
    }

    private generateFinalReportSummary(taskReports: TaskReport[]): string {
        const completedTasks = taskReports.filter(t => t.status === TaskStatus.Completed);
        const failedTasks = taskReports.filter(t => t.status === TaskStatus.Failed);

        let summary = `Workflow completed with ${completedTasks.length} successful task(s)`;

        if (failedTasks.length > 0) {
            summary += ` and ${failedTasks.length} failed task(s)`;
        }

        summary += '. ';

        // Add specific outputs to summary
        for (const task of completedTasks) {
            if (task.type === 'polygonArea' && task.output?.area) {
                summary += `Polygon area: ${task.output.area.toFixed(2)} ${task.output.unit}. `;
            } else if (task.type === 'analysis' && task.output) {
                summary += `Analysis result: ${task.output}. `;
            }
        }

        return summary.trim();
    }
}
