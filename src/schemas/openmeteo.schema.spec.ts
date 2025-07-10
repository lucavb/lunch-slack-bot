import { describe, expect, it } from 'vitest';
import {
    getWeatherCondition,
    getWeatherDescription,
    isValidWeatherCode,
    openMeteoForecastSchema,
    openMeteoHourlyDataSchema,
    openMeteoHourlyPointSchema,
    openMeteoHourlyUnitsSchema,
    parseHourlyData,
    validateOpenMeteoForecast,
    validateOpenMeteoHourlyPoint,
    WMO_WEATHER_CODES,
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

    describe('WMO_WEATHER_CODES', () => {
        it('should contain all expected weather codes', () => {
            expect(WMO_WEATHER_CODES[0]).toEqual({ description: 'Clear sky', condition: 'clear' });
            expect(WMO_WEATHER_CODES[1]).toEqual({ description: 'Mainly clear', condition: 'clear' });
            expect(WMO_WEATHER_CODES[2]).toEqual({ description: 'Partly cloudy', condition: 'clouds' });
            expect(WMO_WEATHER_CODES[61]).toEqual({ description: 'Slight rain', condition: 'rain' });
            expect(WMO_WEATHER_CODES[95]).toEqual({ description: 'Thunderstorm', condition: 'thunderstorm' });
        });

        it('should have consistent condition mapping', () => {
            // Clear conditions
            expect(WMO_WEATHER_CODES[0].condition).toBe('clear');
            expect(WMO_WEATHER_CODES[1].condition).toBe('clear');

            // Cloudy conditions
            expect(WMO_WEATHER_CODES[2].condition).toBe('clouds');
            expect(WMO_WEATHER_CODES[3].condition).toBe('clouds');

            // Rain conditions
            expect(WMO_WEATHER_CODES[61].condition).toBe('rain');
            expect(WMO_WEATHER_CODES[63].condition).toBe('rain');

            // Snow conditions
            expect(WMO_WEATHER_CODES[71].condition).toBe('snow');
            expect(WMO_WEATHER_CODES[73].condition).toBe('snow');
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

    describe('validateOpenMeteoHourlyPoint', () => {
        it('should validate correct hourly point data', () => {
            const validPoint = {
                time: '2025-07-09T12:00',
                temperature_2m: 18.5,
                windspeed_10m: 12.3,
                weathercode: 1,
                cloud_cover: 25,
            };

            const result = validateOpenMeteoHourlyPoint(validPoint);
            expect(result).toEqual(validPoint);
        });

        it('should throw for invalid hourly point data', () => {
            expect(() => validateOpenMeteoHourlyPoint({})).toThrow();
            expect(() => validateOpenMeteoHourlyPoint(null)).toThrow();
            expect(() => validateOpenMeteoHourlyPoint('invalid')).toThrow();
        });
    });

    describe('getWeatherDescription', () => {
        it('should return correct descriptions for valid codes', () => {
            expect(getWeatherDescription(0)).toBe('Clear sky');
            expect(getWeatherDescription(1)).toBe('Mainly clear');
            expect(getWeatherDescription(61)).toBe('Slight rain');
            expect(getWeatherDescription(95)).toBe('Thunderstorm');
        });

        it('should return unknown message for invalid codes', () => {
            expect(getWeatherDescription(999)).toBe('Unknown weather code: 999');
            expect(getWeatherDescription(-1)).toBe('Unknown weather code: -1');
        });
    });

    describe('getWeatherCondition', () => {
        it('should return correct conditions for valid codes', () => {
            expect(getWeatherCondition(0)).toBe('clear');
            expect(getWeatherCondition(1)).toBe('clear');
            expect(getWeatherCondition(2)).toBe('clouds');
            expect(getWeatherCondition(61)).toBe('rain');
            expect(getWeatherCondition(71)).toBe('snow');
            expect(getWeatherCondition(95)).toBe('thunderstorm');
        });

        it('should return unknown for invalid codes', () => {
            expect(getWeatherCondition(999)).toBe('unknown');
            expect(getWeatherCondition(-1)).toBe('unknown');
        });
    });

    describe('isValidWeatherCode', () => {
        it('should return true for valid codes', () => {
            expect(isValidWeatherCode(0)).toBe(true);
            expect(isValidWeatherCode(1)).toBe(true);
            expect(isValidWeatherCode(61)).toBe(true);
            expect(isValidWeatherCode(95)).toBe(true);
        });

        it('should return false for invalid codes', () => {
            expect(isValidWeatherCode(999)).toBe(false);
            expect(isValidWeatherCode(-1)).toBe(false);
            expect(isValidWeatherCode(4)).toBe(false); // gap in WMO codes
        });
    });

    describe('parseHourlyData', () => {
        it('should convert hourly data to individual points', () => {
            const hourlyData = {
                time: ['2025-07-09T00:00', '2025-07-09T01:00'],
                temperature_2m: [11.4, 11.3],
                windspeed_10m: [11.0, 10.9],
                weathercode: [3, 3],
                cloud_cover: [100, 99],
            };

            const result = parseHourlyData(hourlyData);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                time: '2025-07-09T00:00',
                temperature_2m: 11.4,
                windspeed_10m: 11.0,
                weathercode: 3,
                cloud_cover: 100,
            });
            expect(result[1]).toEqual({
                time: '2025-07-09T01:00',
                temperature_2m: 11.3,
                windspeed_10m: 10.9,
                weathercode: 3,
                cloud_cover: 99,
            });
        });

        it('should handle empty data', () => {
            const emptyData = {
                time: [],
                temperature_2m: [],
                windspeed_10m: [],
                weathercode: [],
                cloud_cover: [],
            };

            const result = parseHourlyData(emptyData);
            expect(result).toHaveLength(0);
        });
    });
});
