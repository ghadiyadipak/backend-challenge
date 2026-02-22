import { PolygonAreaJob } from '../jobs/PolygonAreaJob';
import { Task } from '../models/Task';
import { TaskStatus } from '../workers/taskRunner';

describe('PolygonAreaJob', () => {
    let job: PolygonAreaJob;

    beforeEach(() => {
        job = new PolygonAreaJob();
    });

    const createMockTask = (geoJson: any): Task => {
        const task = new Task();
        task.taskId = 'test-task-id';
        task.clientId = 'test-client';
        task.geoJson = JSON.stringify(geoJson);
        task.status = TaskStatus.Queued;
        task.taskType = 'polygonArea';
        task.stepNumber = 1;
        return task;
    };

    describe('run', () => {
        it('should calculate area for a valid Polygon', async () => {
            const geoJson = {
                type: 'Polygon',
                coordinates: [[
                    [-63.624885, -10.311050],
                    [-63.624885, -10.367865],
                    [-63.612783, -10.367865],
                    [-63.612783, -10.311050],
                    [-63.624885, -10.311050]
                ]]
            };

            const task = createMockTask(geoJson);
            const result = await job.run(task);

            expect(result).toHaveProperty('area');
            expect(result).toHaveProperty('unit', 'square meters');
            expect(typeof result.area).toBe('number');
            expect(result.area).toBeGreaterThan(0);
        });

        it('should calculate area for a Feature with Polygon geometry', async () => {
            const geoJson = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [0, 0],
                        [0, 1],
                        [1, 1],
                        [1, 0],
                        [0, 0]
                    ]]
                }
            };

            const task = createMockTask(geoJson);
            const result = await job.run(task);

            expect(result).toHaveProperty('area');
            expect(result.area).toBeGreaterThan(0);
        });

        it('should throw error for invalid GeoJSON', async () => {
            const geoJson = {
                type: 'InvalidType',
                coordinates: []
            };

            const task = createMockTask(geoJson);

            await expect(job.run(task)).rejects.toThrow('Failed to calculate polygon area');
        });

        it('should throw error for Point geometry', async () => {
            const geoJson = {
                type: 'Point',
                coordinates: [0, 0]
            };

            const task = createMockTask(geoJson);

            await expect(job.run(task)).rejects.toThrow('Failed to calculate polygon area');
        });

        it('should throw error for malformed JSON', async () => {
            const task = new Task();
            task.taskId = 'test-task-id';
            task.geoJson = 'invalid json {{{';

            await expect(job.run(task)).rejects.toThrow('Failed to calculate polygon area');
        });

        it('should handle MultiPolygon geometry', async () => {
            const geoJson = {
                type: 'MultiPolygon',
                coordinates: [
                    [[
                        [0, 0],
                        [0, 1],
                        [1, 1],
                        [1, 0],
                        [0, 0]
                    ]],
                    [[
                        [2, 2],
                        [2, 3],
                        [3, 3],
                        [3, 2],
                        [2, 2]
                    ]]
                ]
            };

            const task = createMockTask(geoJson);
            const result = await job.run(task);

            expect(result).toHaveProperty('area');
            expect(result.area).toBeGreaterThan(0);
        });
    });
});
