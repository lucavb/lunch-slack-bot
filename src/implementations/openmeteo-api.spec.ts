import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenMeteoApi } from './openmeteo-api';
import { HttpClient } from '../interfaces/http-client.interface';
import { Coordinates } from '../types/index';

describe('OpenMeteoApi', () => {
    let mockHttpClient: HttpClient;
    let openMeteoApi: OpenMeteoApi;

    const mockCoordinates: Coordinates = {
        lat: 48.1351,
        lon: 11.582,
        locationName: 'Munich',
    };

    const mockOpenMeteoResponse = {
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
            time: ['2025-07-09T00:00', '2025-07-09T01:00'],
            temperature_2m: [11.4, 11.3],
            windspeed_10m: [11.0, 10.9],
            weathercode: [3, 3],
            cloud_cover: [100, 99],
        },
    };

    beforeEach(() => {
        mockHttpClient = {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
        };
        openMeteoApi = new OpenMeteoApi(mockHttpClient);
    });

    describe('getForecast', () => {
        it('should fetch forecast successfully', async () => {
            vi.mocked(mockHttpClient.get).mockResolvedValue(mockOpenMeteoResponse);

            const result = await openMeteoApi.getForecast(mockCoordinates);

            expect(result).toEqual(mockOpenMeteoResponse);
            expect(mockHttpClient.get).toHaveBeenCalledWith(
                expect.stringContaining('https://api.open-meteo.com/v1/forecast'),
            );
        });

        it('should construct correct URL with parameters', async () => {
            vi.mocked(mockHttpClient.get).mockResolvedValue(mockOpenMeteoResponse);

            await openMeteoApi.getForecast(mockCoordinates);

            const calledUrl = vi.mocked(mockHttpClient.get).mock.calls[0][0];
            const url = new URL(calledUrl);

            expect(url.searchParams.get('latitude')).toBe('48.1351');
            expect(url.searchParams.get('longitude')).toBe('11.582');
            expect(url.searchParams.get('hourly')).toBe('temperature_2m,windspeed_10m,weathercode,cloud_cover');
            expect(url.searchParams.get('timezone')).toBe('auto');
            expect(url.searchParams.get('forecast_days')).toBe('1');
        });

        it('should handle HTTP client errors', async () => {
            const httpError = new Error('Network error');
            vi.mocked(mockHttpClient.get).mockRejectedValue(httpError);

            await expect(openMeteoApi.getForecast(mockCoordinates)).rejects.toThrow(
                'Open-Meteo API error: Network error',
            );
        });

        it('should handle non-Error objects', async () => {
            vi.mocked(mockHttpClient.get).mockRejectedValue('String error');

            await expect(openMeteoApi.getForecast(mockCoordinates)).rejects.toThrow(
                'Open-Meteo API error: String error',
            );
        });

        it('should validate response with Zod', async () => {
            const invalidResponse = {
                latitude: 'invalid', // should be number
                longitude: 11.58,
                // missing required fields
            };

            vi.mocked(mockHttpClient.get).mockResolvedValue(invalidResponse);

            await expect(openMeteoApi.getForecast(mockCoordinates)).rejects.toThrow();
        });

        it('should log fetch and success messages', async () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            vi.mocked(mockHttpClient.get).mockResolvedValue(mockOpenMeteoResponse);

            await openMeteoApi.getForecast(mockCoordinates);

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Fetching Open-Meteo forecast for Munich'),
                expect.objectContaining({
                    coordinates: '48.1351, 11.582',
                }),
            );

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Successfully fetched Open-Meteo forecast for Munich'),
                expect.objectContaining({
                    timezone: 'Europe/Berlin',
                    elevation: 540.0,
                    hourlyDataPoints: 2,
                }),
            );

            consoleSpy.mockRestore();
        });

        it('should log errors', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const httpError = new Error('Network error');
            vi.mocked(mockHttpClient.get).mockRejectedValue(httpError);

            await expect(openMeteoApi.getForecast(mockCoordinates)).rejects.toThrow();

            expect(consoleSpy).toHaveBeenCalledWith('Error fetching Open-Meteo forecast:', httpError);

            consoleSpy.mockRestore();
        });
    });

    describe('URL construction', () => {
        it('should handle different coordinate formats', async () => {
            const coordinatesWithDecimals: Coordinates = {
                lat: 48.123456789,
                lon: 11.987654321,
                locationName: 'Test Location',
            };

            vi.mocked(mockHttpClient.get).mockResolvedValue(mockOpenMeteoResponse);

            await openMeteoApi.getForecast(coordinatesWithDecimals);

            const calledUrl = vi.mocked(mockHttpClient.get).mock.calls[0][0];
            const url = new URL(calledUrl);

            expect(url.searchParams.get('latitude')).toBe('48.123456789');
            expect(url.searchParams.get('longitude')).toBe('11.987654321');
        });

        it('should handle negative coordinates', async () => {
            const negativeCoordinates: Coordinates = {
                lat: -48.1351,
                lon: -11.582,
                locationName: 'Southern Hemisphere',
            };

            vi.mocked(mockHttpClient.get).mockResolvedValue(mockOpenMeteoResponse);

            await openMeteoApi.getForecast(negativeCoordinates);

            const calledUrl = vi.mocked(mockHttpClient.get).mock.calls[0][0];
            const url = new URL(calledUrl);

            expect(url.searchParams.get('latitude')).toBe('-48.1351');
            expect(url.searchParams.get('longitude')).toBe('-11.582');
        });
    });
});
