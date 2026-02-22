import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { WorkflowFactory } from '../workflows/WorkflowFactory'; // Create a folder for factories if you prefer
import path from 'path';

const router = Router();
const workflowFactory = new WorkflowFactory(AppDataSource);

router.post('/', async (req, res): Promise<void> => {
    const { clientId, geoJson } = req.body;

    // Input validation
    if (!clientId || typeof clientId !== 'string') {
        res.status(400).json({
            error: 'Invalid request',
            message: 'clientId is required and must be a string'
        });
        return;
    }

    if (!geoJson || typeof geoJson !== 'object') {
        res.status(400).json({
            error: 'Invalid request',
            message: 'geoJson is required and must be a valid GeoJSON object'
        });
        return;
    }

    // Validate GeoJSON type
    const validTypes = ['Polygon', 'MultiPolygon', 'Feature', 'FeatureCollection'];
    if (!validTypes.includes(geoJson.type)) {
        res.status(400).json({
            error: 'Invalid GeoJSON',
            message: `geoJson.type must be one of: ${validTypes.join(', ')}`
        });
        return;
    }

    const workflowFile = path.join(__dirname, '../workflows/example_workflow.yml');

    try {
        const workflow = await workflowFactory.createWorkflowFromYAML(
            workflowFile,
            clientId.trim(),
            JSON.stringify(geoJson)
        );

        res.status(202).json({
            workflowId: workflow.workflowId,
            message: 'Workflow created and tasks queued from YAML definition.'
        });
    } catch (error: any) {
        console.error('Error creating workflow:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to create workflow'
        });
    }
});

export default router;