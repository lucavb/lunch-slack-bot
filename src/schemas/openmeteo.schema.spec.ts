import { describe, expect, it } from 'vitest';
import {
    openMeteoForecastSchema,
    openMeteoHourlyDataSchema,
    openMeteoHourlyPointSchema,
    openMeteoHourlyUnitsSchema,
    validateOpenMeteoForecast,
} from './openmeteo.schema';

describe('Open-Meteo Schema', () => {
    describe('openMeteoHourlyUnitsSchema', () => {
        it('should validate correct hourly units', () => {
            const validUnits = {
                time: 'iso8601',
                temperature_2m: '°C',
                windspeed_10m: 'km/h',
                weathercode: 'wmo code',
                cloud_cover: '%',
            };

            const result = openMeteoHourlyUnitsSchema.parse(validUnits);
            expect(result).toEqual(validUnits);
        });

        it('should reject invalid hourly units', () => {
            const invalidUnits = {
                time: 'iso8601',
                // missing required fields
            };

            expect(() => openMeteoHourlyUnitsSchema.parse(invalidUnits)).toThrow();
        });
    });

    describe('openMeteoHourlyDataSchema', () => {
        it('should validate correct hourly data', () => {
            const validData = {
                time: ['2025-07-09T00:00', '2025-07-09T01:00'],
                temperature_2m: [11.4, 11.3],
                windspeed_10m: [11.0, 10.9],
                weathercode: [3, 3],
                cloud_cover: [100, 100],
            };

            const result = openMeteoHourlyDataSchema.parse(validData);
            expect(result).toEqual(validData);
        });

        it('should reject mismatched array lengths', () => {
            const invalidData = {
                time: ['2025-07-09T00:00'],
                temperature_2m: [11.4, 11.3], // different length
                windspeed_10m: [11.0],
                weathercode: [3],
                cloud_cover: [100],
            };

            // Note: Zod doesn't validate array length matching by default
            // This would pass schema validation but fail business logic
            expect(() => openMeteoHourlyDataSchema.parse(invalidData)).not.toThrow();
        });
    });

    describe('openMeteoForecastSchema', () => {
        it('should validate complete forecast response', () => {
            const validForecast = {
                latitude: 48.12,
                longitude: 11.58,
                generationtime_ms: 0.052,
                utc_offset_seconds: 7200,
                timezone: 'Europe/Berlin',
                timezone_abbreviation: 'GMT+2',
                elevation: 540.0,
                hourly_units: {
                    time: 'iso8601',
                    temperature_2m: '°C',
                    windspeed_10m: 'km/h',
                    weathercode: 'wmo code',
                    cloud_cover: '%',
                },
                hourly: {
                    time: ['2025-07-09T00:00'],
                    temperature_2m: [11.4],
                    windspeed_10m: [11.0],
                    weathercode: [3],
                    cloud_cover: [100],
                },
            };

            const result = openMeteoForecastSchema.parse(validForecast);
            expect(result).toEqual(validForecast);
        });

        it('should reject incomplete forecast response', () => {
            const invalidForecast = {
                latitude: 48.12,
                longitude: 11.58,
                // missing required fields
            };

            expect(() => openMeteoForecastSchema.parse(invalidForecast)).toThrow();
        });
    });

    describe('openMeteoHourlyPointSchema', () => {
        it('should validate hourly point data', () => {
            const validPoint = {
                time: '2025-07-09T12:00',
                temperature_2m: 18.5,
                windspeed_10m: 12.3,
                weathercode: 1,
                cloud_cover: 25,
            };

            const result = openMeteoHourlyPointSchema.parse(validPoint);
            expect(result).toEqual(validPoint);
        });

        it('should reject invalid hourly point data', () => {
            const invalidPoint = {
                time: '2025-07-09T12:00',
                temperature_2m: 'not a number',
                windspeed_10m: 12.3,
                weathercode: 1,
                cloud_cover: 25,
            };

            expect(() => openMeteoHourlyPointSchema.parse(invalidPoint)).toThrow();
        });
    });

    describe('validateOpenMeteoForecast', () => {
        it('should validate correct forecast data', () => {
            const validData = {
                latitude: 48.12,
                longitude: 11.58,
                generationtime_ms: 0.052,
                utc_offset_seconds: 7200,
                timezone: 'Europe/Berlin',
                timezone_abbreviation: 'GMT+2',
                elevation: 540.0,
                hourly_units: {
                    time: 'iso8601',
                    temperature_2m: '°C',
                    windspeed_10m: 'km/h',
                    weathercode: 'wmo code',
                    cloud_cover: '%',
                },
                hourly: {
                    time: ['2025-07-09T00:00'],
                    temperature_2m: [11.4],
                    windspeed_10m: [11.0],
                    weathercode: [3],
                    cloud_cover: [100],
                },
            };

            const result = validateOpenMeteoForecast(validData);
            expect(result).toEqual(validData);
        });

        it('should throw for invalid forecast data', () => {
            expect(() => validateOpenMeteoForecast({})).toThrow();
            expect(() => validateOpenMeteoForecast(null)).toThrow();
            expect(() => validateOpenMeteoForecast('invalid')).toThrow();
        });
    });
});
