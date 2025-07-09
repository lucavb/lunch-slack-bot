import { z } from 'zod';

// Open-Meteo hourly units schema
export const openMeteoHourlyUnitsSchema = z.object({
    time: z.string(),
    temperature_2m: z.string(),
    windspeed_10m: z.string(),
    weathercode: z.string(),
    cloud_cover: z.string(),
});

// Open-Meteo hourly data schema
export const openMeteoHourlyDataSchema = z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number()),
    windspeed_10m: z.array(z.number()),
    weathercode: z.array(z.number()),
    cloud_cover: z.array(z.number()),
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

// WMO Weather Code definitions (https://open-meteo.com/en/docs)
export const WMO_WEATHER_CODES = {
    0: { description: 'Clear sky', condition: 'clear' },
    1: { description: 'Mainly clear', condition: 'clear' },
    2: { description: 'Partly cloudy', condition: 'clouds' },
    3: { description: 'Overcast', condition: 'clouds' },
    45: { description: 'Fog', condition: 'fog' },
    48: { description: 'Depositing rime fog', condition: 'fog' },
    51: { description: 'Light drizzle', condition: 'drizzle' },
    53: { description: 'Moderate drizzle', condition: 'drizzle' },
    55: { description: 'Dense drizzle', condition: 'drizzle' },
    56: { description: 'Light freezing drizzle', condition: 'drizzle' },
    57: { description: 'Dense freezing drizzle', condition: 'drizzle' },
    61: { description: 'Slight rain', condition: 'rain' },
    63: { description: 'Moderate rain', condition: 'rain' },
    65: { description: 'Heavy rain', condition: 'rain' },
    66: { description: 'Light freezing rain', condition: 'rain' },
    67: { description: 'Heavy freezing rain', condition: 'rain' },
    71: { description: 'Slight snow fall', condition: 'snow' },
    73: { description: 'Moderate snow fall', condition: 'snow' },
    75: { description: 'Heavy snow fall', condition: 'snow' },
    77: { description: 'Snow grains', condition: 'snow' },
    80: { description: 'Slight rain showers', condition: 'rain' },
    81: { description: 'Moderate rain showers', condition: 'rain' },
    82: { description: 'Violent rain showers', condition: 'rain' },
    85: { description: 'Slight snow showers', condition: 'snow' },
    86: { description: 'Heavy snow showers', condition: 'snow' },
    95: { description: 'Thunderstorm', condition: 'thunderstorm' },
    96: { description: 'Thunderstorm with slight hail', condition: 'thunderstorm' },
    99: { description: 'Thunderstorm with heavy hail', condition: 'thunderstorm' },
} as const;

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
export type WMOWeatherCode = keyof typeof WMO_WEATHER_CODES;

// Validation functions
export const validateOpenMeteoForecast = (data: unknown): OpenMeteoForecast => {
    return openMeteoForecastSchema.parse(data);
};

export const validateOpenMeteoHourlyPoint = (data: unknown): OpenMeteoHourlyPoint => {
    return openMeteoHourlyPointSchema.parse(data);
};

// Helper functions
export const getWeatherDescription = (code: number): string => {
    const wmoCode = code as WMOWeatherCode;
    return WMO_WEATHER_CODES[wmoCode]?.description || `Unknown weather code: ${code}`;
};

export const getWeatherCondition = (code: number): string => {
    const wmoCode = code as WMOWeatherCode;
    return WMO_WEATHER_CODES[wmoCode]?.condition || 'unknown';
};

export const isValidWeatherCode = (code: number): code is WMOWeatherCode => {
    return code in WMO_WEATHER_CODES;
};

// Convert Open-Meteo hourly data to individual data points
export const parseHourlyData = (hourlyData: OpenMeteoHourlyData): OpenMeteoHourlyPoint[] => {
    const points: OpenMeteoHourlyPoint[] = [];

    for (let i = 0; i < hourlyData.time.length; i++) {
        points.push({
            time: hourlyData.time[i],
            temperature_2m: hourlyData.temperature_2m[i],
            windspeed_10m: hourlyData.windspeed_10m[i],
            weathercode: hourlyData.weathercode[i],
            cloud_cover: hourlyData.cloud_cover[i],
        });
    }

    return points;
};
