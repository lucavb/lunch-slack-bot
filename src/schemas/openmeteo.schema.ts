import { z } from 'zod';

// Open-Meteo hourly units schema
export const openMeteoHourlyUnitsSchema = z.object({
    cloud_cover: z.string(),
    temperature_2m: z.string(),
    time: z.string(),
    weathercode: z.string(),
    windspeed_10m: z.string(),
});

// Open-Meteo hourly data schema
export const openMeteoHourlyDataSchema = z.object({
    cloud_cover: z.array(z.number()),
    temperature_2m: z.array(z.number()),
    time: z.array(z.string()),
    weathercode: z.array(z.number()),
    windspeed_10m: z.array(z.number()),
});

// Open-Meteo forecast response schema
export const openMeteoForecastSchema = z.object({
    latitude: z.number(),
    longitude: z.number(),
    generationtime_ms: z.number(),
    utc_offset_seconds: z.number(),
    timezone: z.string(),
    timezone_abbreviation: z.string(),
    elevation: z.number(),
    hourly_units: openMeteoHourlyUnitsSchema,
    hourly: openMeteoHourlyDataSchema,
});

// Hourly weather data point
export const openMeteoHourlyPointSchema = z.object({
    time: z.string(),
    temperature_2m: z.number(),
    windspeed_10m: z.number(),
    weathercode: z.number(),
    cloud_cover: z.number(),
});

// Type inference
export type OpenMeteoForecast = z.infer<typeof openMeteoForecastSchema>;
export type OpenMeteoHourlyUnits = z.infer<typeof openMeteoHourlyUnitsSchema>;
export type OpenMeteoHourlyData = z.infer<typeof openMeteoHourlyDataSchema>;
export type OpenMeteoHourlyPoint = z.infer<typeof openMeteoHourlyPointSchema>;

// Validation functions
export const validateOpenMeteoForecast = (data: unknown): OpenMeteoForecast => {
    return openMeteoForecastSchema.parse(data);
};
