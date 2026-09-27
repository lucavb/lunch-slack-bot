import { describe, expect, it } from 'vitest';
import { WeatherDecision, WeatherConfig, LunchWeather, WEATHER_CONDITIONS } from './weather-decision';
import { WeatherApi } from '../interfaces/weather-api.interface';
import { Coordinates } from '../types/index';
import { OpenMeteoForecast } from '../schemas/openmeteo.schema';

class CannedForecastWeatherApi implements WeatherApi {
    constructor(private forecast: OpenMeteoForecast) {}

    async getForecast(): Promise<OpenMeteoForecast> {
        return this.forecast;
    }
}

class RejectingWeatherApi implements WeatherApi {
    async getForecast(): Promise<OpenMeteoForecast> {
        return Promise.reject(new Error('API down'));
    }
}

const emptyForecastApi: WeatherApi = {
    async getForecast() {
        return {
            latitude: 48.12,
            longitude: 11.58,
            generationtime_ms: 0.05,
            utc_offset_seconds: 7200,
            timezone: 'Europe/Berlin',
            timezone_abbreviation: 'CEST',
            elevation: 540,
            hourly_units: {
                cloud_cover: '%',
                temperature_2m: '°C',
                time: 'iso8601',
                weathercode: 'wmo code',
                windspeed_10m: 'km/h',
            },
            hourly: { cloud_cover: [], temperature_2m: [], time: [], weathercode: [], windspeed_10m: [] },
        };
    },
};

const baseConfig: WeatherConfig = {
    minTemperature: 14,
    goodWeatherConditions: ['clear', 'partly-cloudy'],
    badWeatherConditions: ['rain', 'drizzle', 'thunderstorm', 'snow'],
    weatherCheckHour: 12,
};

const munich: Coordinates = { lat: 48.13, lon: 11.58, locationName: 'Munich' };

interface ForecastPoint {
    hour: number;
    temperature: number;
    weathercode: number;
    /** Days from today; 0 = today, 1 = tomorrow (used to pin the today-filter). */
    dayOffset?: number;
}

function makeForecast(hourlyPoints: ForecastPoint[]): OpenMeteoForecast {
    // Naive local time strings without a Z suffix or offset — like Open-Meteo returns
    // with timezone=auto — so getHours() matches the nominal hour under TZ=UTC.
    const utcDateWithOffset = (dayOffset: number): string => {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() + dayOffset);
        return date.toISOString().split('T')[0];
    };

    return {
        latitude: 48.12,
        longitude: 11.58,
        generationtime_ms: 0.05,
        utc_offset_seconds: 7200,
        timezone: 'Europe/Berlin',
        timezone_abbreviation: 'CEST',
        elevation: 540,
        hourly_units: {
            cloud_cover: '%',
            temperature_2m: '°C',
            time: 'iso8601',
            weathercode: 'wmo code',
            windspeed_10m: 'km/h',
        },
        hourly: {
            time: hourlyPoints.map(
                (point) => `${utcDateWithOffset(point.dayOffset ?? 0)}T${String(point.hour).padStart(2, '0')}:00`,
            ),
            temperature_2m: hourlyPoints.map((point) => point.temperature),
            weathercode: hourlyPoints.map((point) => point.weathercode),
            windspeed_10m: hourlyPoints.map(() => 5),
            cloud_cover: hourlyPoints.map(() => 20),
        },
    };
}

const decide = async (forecastPoints: ForecastPoint[], config = baseConfig): Promise<LunchWeather> =>
    new WeatherDecision(new CannedForecastWeatherApi(makeForecast(forecastPoints)), config).decideForLunch(munich);

describe('WeatherDecision', () => {
    describe('constructor', () => {
        it('should throw when a good condition name is unknown', () => {
            expect(
                () =>
                    new WeatherDecision(emptyForecastApi, {
                        ...baseConfig,
                        goodWeatherConditions: ['clear', 'sunny'],
                    }),
            ).toThrow(/sunny/);
        });

        it('should throw when a bad condition name is unknown', () => {
            expect(
                () =>
                    new WeatherDecision(emptyForecastApi, {
                        ...baseConfig,
                        badWeatherConditions: ['rain', 'wet'],
                    }),
            ).toThrow(/wet/);
        });

        it('should throw on case-mismatched condition names', () => {
            expect(
                () =>
                    new WeatherDecision(emptyForecastApi, {
                        ...baseConfig,
                        goodWeatherConditions: ['Clear'],
                    }),
            ).toThrow(/Clear/);
        });

        it('should accept all configured vocabulary entries', () => {
            expect(
                () =>
                    new WeatherDecision(emptyForecastApi, {
                        ...baseConfig,
                        goodWeatherConditions: [...WEATHER_CONDITIONS],
                        badWeatherConditions: [...WEATHER_CONDITIONS],
                    }),
            ).not.toThrow();
        });
    });

    describe('decideForLunch', () => {
        it('should rethrow API errors', async () => {
            await expect(
                new WeatherDecision(new RejectingWeatherApi(), baseConfig).decideForLunch(munich),
            ).rejects.toThrow('API down');
        });

        it('should return bad-weather at exactly minTemperature (strictly greater threshold)', async () => {
            const result = await decide([{ hour: 12, temperature: 14.0, weathercode: 0 }]);

            expect(result).toEqual({
                outcome: 'bad-weather',
                temperature: 14,
                condition: 'clear',
                description: 'Clear to mainly clear',
            });
        });

        it('should return bad-weather when the rounded raw temperature is just above minTemperature', async () => {
            const result = await decide([{ hour: 12, temperature: 14.4, weathercode: 0 }]);

            expect(result).toEqual({
                outcome: 'bad-weather',
                temperature: 14,
                condition: 'clear',
                description: 'Clear to mainly clear',
            });
        });

        it('should return good above minTemperature', async () => {
            const result = await decide([{ hour: 12, temperature: 15.4, weathercode: 0 }]);

            expect(result).toEqual({
                outcome: 'good',
                temperature: 15,
                condition: 'clear',
                description: 'Clear to mainly clear',
            });
        });

        it('should treat WMO code 2 as partly-cloudy and therefore good', async () => {
            const result = await decide([{ hour: 12, temperature: 20, weathercode: 2 }]);

            expect(result).toEqual({
                outcome: 'good',
                temperature: 20,
                condition: 'partly-cloudy',
                description: 'Partly cloudy',
            });
        });

        it.each([
            [3, 'clouds', 'Overcast'],
            [45, 'clouds', 'Cloudy'],
            [80, 'rain', 'Showers'],
        ])('should map WMO code %i to %s / %s', async (weathercode, condition, description) => {
            const result = await decide([{ hour: 12, temperature: 20, weathercode }]);

            expect(result).toEqual({ outcome: 'bad-weather', temperature: 20, condition, description });
        });

        it.each([
            [1, 'clear', 'Clear to mainly clear', 'good'],
            [51, 'rain', 'Rainy', 'bad-weather'], // 'rain' is on the bad list
        ])(
            'should pin WMO branch boundaries: code %i → %s / %s',
            async (weathercode, condition, description, outcome) => {
                const result = await decide([{ hour: 12, temperature: 20, weathercode }]);

                expect(result).toEqual({ outcome, temperature: 20, condition, description });
            },
        );

        it('should treat rain as bad weather', async () => {
            const result = await decide([{ hour: 12, temperature: 20, weathercode: 61 }]);

            expect(result.outcome).toBe('bad-weather');
            expect(result).toMatchObject({ condition: 'rain', description: 'Rainy' });
        });

        it('should treat snow and thunderstorm as bad weather', async () => {
            const snow = await decide([{ hour: 12, temperature: 20, weathercode: 71 }]);
            const thunderstorm = await decide([{ hour: 12, temperature: 20, weathercode: 95 }]);

            expect(snow).toMatchObject({ outcome: 'bad-weather', condition: 'snow' });
            expect(thunderstorm).toMatchObject({ outcome: 'bad-weather', condition: 'thunderstorm' });
        });

        it('should fall back to clouds for unknown codes, which is not good', async () => {
            const result = await decide([{ hour: 12, temperature: 20, weathercode: 100 }]);

            expect(result).toEqual({
                outcome: 'bad-weather',
                temperature: 20,
                condition: 'clouds',
                description: 'Unknown weather',
            });
        });

        it('should return no-forecast and no temperature when today has no forecast points', async () => {
            const result = await decide([]);

            expect(result).toEqual({ outcome: 'no-forecast' });
            expect('temperature' in result).toBe(false);
        });

        it("should return no-forecast when the only points are on tomorrow's date", async () => {
            const result = await decide([
                { hour: 12, temperature: 20, weathercode: 0, dayOffset: 1 },
                { hour: 13, temperature: 21, weathercode: 0, dayOffset: 1 },
            ]);

            expect(result).toEqual({ outcome: 'no-forecast' });
        });

        it('should ignore non-today points and let the today point decide', async () => {
            const result = await decide([
                { hour: 11, temperature: 11.4, weathercode: 0 },
                { hour: 13, temperature: 23.7, weathercode: 0, dayOffset: 1 },
            ]);

            // If the today-filter broke, the nearer 13:00-tomorrow point (23.7°C) would win.
            expect(result).toMatchObject({ temperature: 11, outcome: 'bad-weather' });
        });

        it('should pick the nearest hourly point (asymmetric case)', async () => {
            const result = await decide([
                { hour: 11, temperature: 11.4, weathercode: 0 },
                { hour: 14, temperature: 23.7, weathercode: 0 },
            ]);

            // 11:00 is one hour from 12:00, 14:00 is two hours away
            expect(result).toMatchObject({ temperature: 11 });
        });

        it('should prefer a later-listed point that is strictly nearer', async () => {
            const result = await decide([
                { hour: 14, temperature: 20, weathercode: 0 },
                { hour: 13, temperature: 25, weathercode: 0 },
            ]);

            expect(result).toMatchObject({ temperature: 25 });
        });

        it('should select by the configured weatherCheckHour', async () => {
            const result = await decide(
                [
                    { hour: 9, temperature: 13.5, weathercode: 0 },
                    { hour: 13, temperature: 21.5, weathercode: 0 },
                ],
                { ...baseConfig, weatherCheckHour: 10 },
            );

            // 9:00 is one hour from 10:00, 13:00 is three hours away
            expect(result).toMatchObject({ temperature: 14 });
        });

        it('should keep the first point in order on an exact distance tie', async () => {
            const firstListed = await decide([
                { hour: 11, temperature: 11.4, weathercode: 0 },
                { hour: 13, temperature: 23.7, weathercode: 0 },
            ]);
            expect(firstListed).toMatchObject({ temperature: 11 });

            const otherFirst = await decide([
                { hour: 13, temperature: 23.7, weathercode: 0 },
                { hour: 11, temperature: 11.4, weathercode: 0 },
            ]);
            expect(otherFirst).toMatchObject({ temperature: 24 });
        });

        it('should return bad-weather when the condition is absent from the good list', async () => {
            const result = await decide([{ hour: 12, temperature: 20, weathercode: 0 }], {
                ...baseConfig,
                goodWeatherConditions: ['partly-cloudy'],
            });

            expect(result.outcome).toBe('bad-weather');
        });

        it('should return bad-weather when a condition is on both the good and bad lists', async () => {
            const result = await decide([{ hour: 12, temperature: 20, weathercode: 0 }], {
                ...baseConfig,
                goodWeatherConditions: ['clear'],
                badWeatherConditions: ['clear'],
            });

            expect(result.outcome).toBe('bad-weather');
        });
    });
});
