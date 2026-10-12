import { Coordinates } from '../types/index';
import { WeatherApi } from '../interfaces/weather-api.interface';
import { OpenMeteoForecast, OpenMeteoHourlyPoint } from '../schemas/openmeteo.schema';

// Weather condition vocabulary (single source of truth for the whole codebase)
export const WEATHER_CONDITIONS = [
    'clear',
    'partly-cloudy',
    'clouds',
    'rain',
    'drizzle',
    'snow',
    'thunderstorm',
] as const;

export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

// Criteria for deciding whether the weather invites an outdoor team lunch
export interface WeatherConfig {
    badWeatherConditions: readonly string[];
    goodWeatherConditions: readonly string[];
    minTemperature: number;
    weatherCheckHour: number;
}

/**
 * The answer a WeatherDecision returns for "is today's weather good for outdoor lunch?".
 * `no-forecast` means "couldn't answer" — it is never treated as bad weather.
 * A forecast answer always carries the rounded temperature, mapped condition, and description;
 * whether the decision was `good` or `bad-weather` is encoded in `outcome`.
 */
export type LunchWeather =
    | {
          outcome: 'good' | 'bad-weather';
          temperature: number;
          condition: WeatherCondition;
          description: string;
      }
    | {
          outcome: 'no-forecast';
      };

/**
 * Answers "is the weather good for outdoor lunch?" for a location, given the day's
 * forecast and the configured decision criteria. The only public method is
 * `decideForLunch`; hour selection, WMO code mapping, and the temperature threshold
 * are implementation details.
 */
export class WeatherDecision {
    constructor(
        private weatherApi: WeatherApi,
        private config: WeatherConfig,
    ) {
        // The criteria lists are unvalidated env/event input; validate them here, at the seam.
        // Condition names are matched exactly (case-sensitive) against the lowercase WEATHER_CONDITIONS vocabulary.
        const unknownCondition = [...config.goodWeatherConditions, ...config.badWeatherConditions].find(
            (condition) => !(WEATHER_CONDITIONS as readonly string[]).includes(condition),
        );

        if (unknownCondition) {
            throw new Error(
                `Invalid weather condition '${unknownCondition}' — expected one of: ${WEATHER_CONDITIONS.join(', ')}`,
            );
        }
    }

    /**
     * Decide whether the weather at the given coordinates is good for outdoor lunch.
     */
    async decideForLunch(coordinates: Coordinates): Promise<LunchWeather> {
        try {
            const forecast = await this.weatherApi.getForecast(coordinates);
            const todayForecast = this.selectForecastForCheckHour(forecast, coordinates);

            if (!todayForecast) {
                return { outcome: 'no-forecast' };
            }

            const temperature = Math.round(todayForecast.temperature_2m);
            const weatherInfo = this.mapWeatherCode(todayForecast.weathercode);

            // Check temperature threshold
            const temperatureGood = temperature > this.config.minTemperature;

            // Check weather condition
            const conditionGood =
                this.config.goodWeatherConditions.includes(weatherInfo.condition) &&
                !this.config.badWeatherConditions.includes(weatherInfo.condition);

            const isGood = temperatureGood && conditionGood;

            console.log(`LunchWeather for ${coordinates.locationName} at ${this.config.weatherCheckHour}:00:`, {
                temperature,
                condition: weatherInfo.condition,
                description: weatherInfo.description,
                weatherCode: todayForecast.weathercode,
                temperatureGood: `${temperatureGood} (${temperature}°C > ${this.config.minTemperature}°C)`,
                conditionGood: `${conditionGood} (good: ${this.config.goodWeatherConditions.join(', ')}, bad: ${this.config.badWeatherConditions.join(', ')})`,
                isGood,
            });

            return {
                outcome: isGood ? 'good' : 'bad-weather',
                temperature,
                condition: weatherInfo.condition,
                description: weatherInfo.description,
            };
        } catch (error) {
            console.error('Error deciding lunch weather:', error);
            throw error;
        }
    }

    /**
     * Select today's forecast closest to the configured check hour.
     */
    private selectForecastForCheckHour(
        forecast: OpenMeteoForecast,
        coordinates: Coordinates,
    ): OpenMeteoHourlyPoint | null {
        // Invariant: with timezone=auto, hourly strings are location-local naive
        // timestamps ("yyyy-MM-ddTHH:mm", no offset). Both day-bases compared here
        // must be location-local: derive "today" by shifting the runtime clock by
        // the location's utc_offset_seconds, and compare each item on the raw
        // naive string's date prefix — never round-trip the naive string through
        // Date + toISOString(), which would re-interpret it in the runtime zone.
        const locationLocalToday = new Date(Date.now() + forecast.utc_offset_seconds * 1000)
            .toISOString()
            .split('T')[0]; // YYYY-MM-DD in the forecast location's calendar

        // Find today's forecasts
        const todayForecasts = forecast.hourly.time
            .map((time, index) => ({
                time: new Date(time),
                localDate: time.slice(0, 10), // date prefix of the location-local naive string
                temperature_2m: forecast.hourly.temperature_2m[index],
                weathercode: forecast.hourly.weathercode[index],
                windspeed_10m: forecast.hourly.windspeed_10m[index],
                cloud_cover: forecast.hourly.cloud_cover[index],
            }))
            .filter((item) => item.localDate === locationLocalToday);

        if (todayForecasts.length === 0) {
            console.log('No weather forecasts found for today');
            return null;
        }

        // Find the forecast closest to the configured hour
        const targetHour = this.config.weatherCheckHour * 60 * 60; // Convert to seconds from start of day
        let closestForecast: OpenMeteoHourlyPoint | null = null;
        let smallestDiff = Infinity;

        for (const todayForecast of todayForecasts) {
            const forecastTimeInSeconds = todayForecast.time.getHours() * 3600 + todayForecast.time.getMinutes() * 60;
            const diff = Math.abs(forecastTimeInSeconds - targetHour);

            if (diff < smallestDiff) {
                smallestDiff = diff;
                closestForecast = {
                    time: todayForecast.time.toISOString(),
                    temperature_2m: todayForecast.temperature_2m,
                    weathercode: todayForecast.weathercode,
                    windspeed_10m: todayForecast.windspeed_10m,
                    cloud_cover: todayForecast.cloud_cover,
                };
            }
        }

        if (closestForecast) {
            console.log(`Found forecast for ${coordinates.locationName} at ${this.config.weatherCheckHour}:00:`, {
                time: closestForecast.time,
                temperature: closestForecast.temperature_2m,
                weatherCode: closestForecast.weathercode,
            });
        }

        return closestForecast;
    }

    /**
     * Convert an Open-Meteo WMO weather code to a readable condition.
     */
    private mapWeatherCode(weatherCode: number): { condition: WeatherCondition; description: string } {
        // Open-Meteo weather codes: https://open-meteo.com/en/docs
        if (weatherCode <= 1) {
            return { condition: 'clear', description: 'Clear to mainly clear' };
        } else if (weatherCode === 2) {
            return { condition: 'partly-cloudy', description: 'Partly cloudy' };
        } else if (weatherCode === 3) {
            return { condition: 'clouds', description: 'Overcast' };
        } else if (weatherCode <= 48) {
            return { condition: 'clouds', description: 'Cloudy' };
        } else if (weatherCode <= 67) {
            return { condition: 'rain', description: 'Rainy' };
        } else if (weatherCode <= 77) {
            return { condition: 'snow', description: 'Snowy' };
        } else if (weatherCode <= 82) {
            return { condition: 'rain', description: 'Showers' };
        } else if (weatherCode <= 99) {
            return { condition: 'thunderstorm', description: 'Thunderstorm' };
        }
        return { condition: 'clouds', description: 'Unknown weather' };
    }
}
