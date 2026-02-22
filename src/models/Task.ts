import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Workflow } from './Workflow';
import {TaskStatus} from "../workers/taskRunner";

@Entity({ name: 'tasks' })
export class Task {
    @PrimaryGeneratedColumn('uuid')
    taskId!: string;

    @Column()
    clientId!: string;

    @Column('text')
    geoJson!: string;

    @Column()
    status!: TaskStatus;

    @Column({ nullable: true, type: 'text' })
    progress?: string | null;

    @Column({ nullable: true })
    resultId?: string;

    @Column()
    taskType!: string;

    @Column({ default: 1 })
    stepNumber!: number;

    // Step identifier for YAML reference (e.g., "step1", "step2")
    @Column({ nullable: true })
    stepId?: string;

    // Comma-separated list of stepIds this task depends on
    @Column({ nullable: true, type: 'text' })
    dependsOn?: string;

    @ManyToOne(() => Workflow, workflow => workflow.tasks)
    workflow!: Workflow;

    // Helper method to get dependency step IDs as array
    getDependencyStepIds(): string[] {
        if (!this.dependsOn) return [];
        return this.dependsOn.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }
}