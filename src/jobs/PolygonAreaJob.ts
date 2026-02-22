import { Job } from './Job';
import { Task } from '../models/Task';
import area from '@turf/area';
import { Feature, Polygon, MultiPolygon } from 'geojson';

export class PolygonAreaJob implements Job {
    async run(task: Task): Promise<{ area: number; unit: string }> {
        console.log(`Calculating polygon area for task ${task.taskId}...`);

        try {
            const geoJson = JSON.parse(task.geoJson);

            // Validate GeoJSON structure
            if (!this.isValidPolygonFeature(geoJson)) {
                throw new Error('Invalid GeoJSON: Expected a Polygon or MultiPolygon geometry');
            }

            // Calculate area in square meters
            const areaInSquareMeters = area(geoJson);

            console.log(`Polygon area calculated: ${areaInSquareMeters} square meters`);

            return {
                area: areaInSquareMeters,
                unit: 'square meters'
            };
        } catch (error: any) {
            console.error(`Error calculating polygon area for task ${task.taskId}:`, error.message);
            throw new Error(`Failed to calculate polygon area: ${error.message}`);
        }
    }

    private isValidPolygonFeature(geoJson: any): geoJson is Feature<Polygon | MultiPolygon> {
        if (!geoJson) return false;

        // Handle direct Polygon/MultiPolygon geometry
        if (geoJson.type === 'Polygon' || geoJson.type === 'MultiPolygon') {
            return Array.isArray(geoJson.coordinates);
        }

        // Handle Feature with Polygon/MultiPolygon geometry
        if (geoJson.type === 'Feature' && geoJson.geometry) {
            const geomType = geoJson.geometry.type;
            return (geomType === 'Polygon' || geomType === 'MultiPolygon') &&
                   Array.isArray(geoJson.geometry.coordinates);
        }

        return false;
    }
}
