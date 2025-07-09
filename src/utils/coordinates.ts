import { Coordinates } from '../types/index';

export class CoordinateParser {
    static parseFromChannelDescription(description: string): Coordinates | null {
        if (!description) {
            return null;
        }

        // Look for the pattern: https://maps.tngtech.com/?lat=48.1112299&lon=11.5963176
        const urlPattern = /https:\/\/maps\.tngtech\.com\/\?lat=([0-9.-]+)&lon=([0-9.-]+)/;
        const match = description.match(urlPattern);

        if (!match) {
            return null;
        }

        const lat = parseFloat(match[1]);
        const lon = parseFloat(match[2]);

        if (isNaN(lat) || isNaN(lon)) {
            return null;
        }

        // Extract location name from the first line of the description
        const lines = description.split('\n');
        const locationName = lines[0]?.trim() || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

        return {
            lat,
            lon,
            locationName,
        };
    }

    static formatCoordinates(coordinates: Coordinates): string {
        return `${coordinates.lat.toFixed(6)},${coordinates.lon.toFixed(6)}`;
    }
}
