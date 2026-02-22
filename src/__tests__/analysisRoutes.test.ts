import request from 'supertest';
import express from 'express';

// Mock the data source and workflow factory
jest.mock('../data-source', () => ({
    AppDataSource: {
        getRepository: jest.fn()
    }
}));

jest.mock('../workflows/WorkflowFactory', () => ({
    WorkflowFactory: jest.fn().mockImplementation(() => ({
        createWorkflowFromYAML: jest.fn().mockResolvedValue({
            workflowId: 'test-workflow-id'
        })
    }))
}));

import analysisRoutes from '../routes/analysisRoutes';

describe('Analysis Routes', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/analysis', analysisRoutes);
    });

    describe('POST /analysis', () => {
        it('should return 400 if clientId is missing', async () => {
            const response = await request(app)
                .post('/analysis')
                .send({
                    geoJson: { type: 'Polygon', coordinates: [] }
                })
                .expect(400);

            expect(response.body.error).toBe('Invalid request');
            expect(response.body.message).toContain('clientId');
        });

        it('should return 400 if geoJson is missing', async () => {
            const response = await request(app)
                .post('/analysis')
                .send({
                    clientId: 'test-client'
                })
                .expect(400);

            expect(response.body.error).toBe('Invalid request');
            expect(response.body.message).toContain('geoJson');
        });

        it('should return 400 if geoJson type is invalid', async () => {
            const response = await request(app)
                .post('/analysis')
                .send({
                    clientId: 'test-client',
                    geoJson: { type: 'Point', coordinates: [0, 0] }
                })
                .expect(400);

            expect(response.body.error).toBe('Invalid GeoJSON');
        });

        it('should return 400 if clientId is not a string', async () => {
            const response = await request(app)
                .post('/analysis')
                .send({
                    clientId: 123,
                    geoJson: { type: 'Polygon', coordinates: [] }
                })
                .expect(400);

            expect(response.body.error).toBe('Invalid request');
        });

        it('should accept valid Polygon geoJson', async () => {
            const response = await request(app)
                .post('/analysis')
                .send({
                    clientId: 'test-client',
                    geoJson: {
                        type: 'Polygon',
                        coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
                    }
                })
                .expect(202);

            expect(response.body.workflowId).toBe('test-workflow-id');
            expect(response.body.message).toContain('Workflow created');
        });

        it('should accept valid Feature geoJson', async () => {
            const response = await request(app)
                .post('/analysis')
                .send({
                    clientId: 'test-client',
                    geoJson: {
                        type: 'Feature',
                        geometry: { type: 'Polygon', coordinates: [] },
                        properties: {}
                    }
                })
                .expect(202);

            expect(response.body.workflowId).toBe('test-workflow-id');
        });

        it('should accept valid MultiPolygon geoJson', async () => {
            const response = await request(app)
                .post('/analysis')
                .send({
                    clientId: 'test-client',
                    geoJson: {
                        type: 'MultiPolygon',
                        coordinates: []
                    }
                })
                .expect(202);

            expect(response.body.workflowId).toBe('test-workflow-id');
        });

        it('should accept valid FeatureCollection geoJson', async () => {
            const response = await request(app)
                .post('/analysis')
                .send({
                    clientId: 'test-client',
                    geoJson: {
                        type: 'FeatureCollection',
                        features: []
                    }
                })
                .expect(202);

            expect(response.body.workflowId).toBe('test-workflow-id');
        });
    });
});
