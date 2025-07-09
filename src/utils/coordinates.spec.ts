import { describe, it, expect } from 'vitest';
import { CoordinateParser } from '../../src/utils/coordinates';

describe('CoordinateParser', () => {
    describe('parseFromChannelDescription', () => {
        it('should parse coordinates from TNG Maps URL', () => {
            const description = 'TNG Office\nhttps://maps.tngtech.com/?lat=48.1112299&lon=11.5963176';
            const result = CoordinateParser.parseFromChannelDescription(description);

            expect(result).not.toBeNull();
            expect(result?.lat).toBe(48.1112299);
            expect(result?.lon).toBe(11.5963176);
            expect(result?.locationName).toBe('TNG Office');
        });

        it('should return null for description without TNG Maps URL', () => {
            const description = 'Just some text without coordinates';
            const result = CoordinateParser.parseFromChannelDescription(description);

            expect(result).toBeNull();
        });

        it('should return null for empty description', () => {
            const description = '';
            const result = CoordinateParser.parseFromChannelDescription(description);

            expect(result).toBeNull();
        });

        it('should return null for description with malformed TNG Maps URL', () => {
            const description = 'https://maps.tngtech.com/?lat=invalid&lon=11.5963176';
            const result = CoordinateParser.parseFromChannelDescription(description);

            expect(result).toBeNull();
        });

        it('should use coordinates as locationName when first line is empty', () => {
            const description = '\nhttps://maps.tngtech.com/?lat=48.1112&lon=11.5963';
            const result = CoordinateParser.parseFromChannelDescription(description);

            expect(result).not.toBeNull();
            expect(result?.locationName).toBe('48.1112, 11.5963');
        });

        it('should handle negative coordinates', () => {
            const description = 'Buenos Aires\nhttps://maps.tngtech.com/?lat=-34.6037&lon=-58.3816';
            const result = CoordinateParser.parseFromChannelDescription(description);

            expect(result).not.toBeNull();
            expect(result?.lat).toBe(-34.6037);
            expect(result?.lon).toBe(-58.3816);
            expect(result?.locationName).toBe('Buenos Aires');
        });
    });

    describe('formatCoordinates', () => {
        it('should format coordinates with 6 decimal places', () => {
            const coordinates = { lat: 48.1112299, lon: 11.5963176, locationName: 'TNG Office' };
            const result = CoordinateParser.formatCoordinates(coordinates);

            expect(result).toBe('48.111230,11.596318');
        });

        it('should handle negative coordinates', () => {
            const coordinates = { lat: -34.6037, lon: -58.3816, locationName: 'Buenos Aires' };
            const result = CoordinateParser.formatCoordinates(coordinates);

            expect(result).toBe('-34.603700,-58.381600');
        });
    });
});
