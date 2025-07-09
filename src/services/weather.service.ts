import { WeatherApi, WeatherService as WeatherServiceInterface } from '../interfaces/weather-api.interface';
import { WeatherCondition, Coordinates } from '../types/index';
import { OpenMeteoHourlyPoint } from '../schemas/openmeteo.schema';

export interface WeatherConfig {
    minTemperature: number;
    goodWeatherConditions: string[];
    badWeatherConditions: string[];
    weatherCheckHour: number;
}

export class WeatherService implements WeatherServiceInterface {
    constructor(
        private weatherApi: WeatherApi,
        private config: WeatherConfig,
    ) {}

    /**
     * Get weather forecast closest to specified hour today
     */
    async getNoonForecast(coordinates: Coordinates): Promise<OpenMeteoHourlyPoint | null> {
        try {
            const forecast = await this.weatherApi.getForecast(coordinates);
            const today = new Date();
            const todayDateString = today.toISOString().split('T')[0]; // YYYY-MM-DD

            // Find today's forecasts
            const todayForecasts = forecast.hourly.time
                .map((time, index) => ({
                    time: new Date(time),
                    temperature_2m: forecast.hourly.temperature_2m[index],
                    weathercode: forecast.hourly.weathercode[index],
                    windspeed_10m: forecast.hourly.windspeed_10m[index],
                    cloud_cover: forecast.hourly.cloud_cover[index],
                }))
                .filter((item) => {
                    const forecastDate = item.time.toISOString().split('T')[0];
                    return forecastDate === todayDateString;
                });

            if (todayForecasts.length === 0) {
                console.log('No weather forecasts found for today');
                return null;
            }

            // Find the forecast closest to the configured hour
            const targetHour = this.config.weatherCheckHour * 60 * 60; // Convert to seconds from start of day
            let closestForecast: OpenMeteoHourlyPoint | null = null;
            let smallestDiff = Infinity;

            for (const forecast of todayForecasts) {
                const forecastTimeInSeconds = forecast.time.getHours() * 3600 + forecast.time.getMinutes() * 60;
                const diff = Math.abs(forecastTimeInSeconds - targetHour);

                if (diff < smallestDiff) {
                    smallestDiff = diff;
                    closestForecast = {
                        time: forecast.time.toISOString(),
                        temperature_2m: forecast.temperature_2m,
                        weathercode: forecast.weathercode,
                        windspeed_10m: forecast.windspeed_10m,
                        cloud_cover: forecast.cloud_cover,
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
        } catch (error) {
            console.error('Error getting weather forecast:', error);
            throw error;
        }
    }

    /**
     * Convert Open-Meteo weather code to readable condition
     */
    private getWeatherCondition(weatherCode: number): { condition: string; description: string } {
        // Open-Meteo weather codes: https://open-meteo.com/en/docs
        if (weatherCode <= 3) {
            return { condition: 'clear', description: 'Clear to partly cloudy' };
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
        } else {
            return { condition: 'unknown', description: 'Unknown weather' };
        }
    }

    /**
     * Determine if weather conditions are good for outdoor lunch
     */
    async isWeatherGood(coordinates: Coordinates): Promise<WeatherCondition> {
        try {
            const forecast = await this.getNoonForecast(coordinates);

            if (!forecast) {
                return {
                    isGood: false,
                    temperature: 0,
                    description: 'No forecast available',
                    condition: 'unknown',
                    timestamp: Date.now(),
                };
            }

            const temperature = Math.round(forecast.temperature_2m);
            const weatherInfo = this.getWeatherCondition(forecast.weathercode);

            // Check temperature threshold
            const temperatureGood = temperature > this.config.minTemperature;

            // Check weather condition
            const conditionGood =
                this.config.goodWeatherConditions.includes(weatherInfo.condition) &&
                !this.config.badWeatherConditions.includes(weatherInfo.condition);

            const isGood = temperatureGood && conditionGood;

            const result: WeatherCondition = {
                isGood,
                temperature,
                description: weatherInfo.description,
                condition: weatherInfo.condition,
                timestamp: new Date(forecast.time).getTime(),
            };

            console.log(`Weather assessment for ${coordinates.locationName} at ${this.config.weatherCheckHour}:00:`, {
                temperature,
                condition: weatherInfo.condition,
                description: weatherInfo.description,
                weatherCode: forecast.weathercode,
                temperatureGood: `${temperatureGood} (${temperature}°C > ${this.config.minTemperature}°C)`,
                conditionGood: `${conditionGood} (good: ${this.config.goodWeatherConditions.join(', ')}, bad: ${this.config.badWeatherConditions.join(', ')})`,
                isGood,
            });

            return result;
        } catch (error) {
            console.error('Error checking weather conditions:', error);
            throw error;
        }
    }

    /**
     * Get human-readable weather summary
     */
    async getWeatherSummary(coordinates: Coordinates): Promise<string> {
        try {
            const weatherCondition = await this.isWeatherGood(coordinates);

            if (weatherCondition.isGood) {
                return `Great weather for lunch! ${weatherCondition.temperature}°C, ${weatherCondition.description}`;
            } else {
                return `Weather not suitable for outdoor lunch: ${weatherCondition.temperature}°C, ${weatherCondition.description}`;
            }
        } catch (error) {
            console.error('Error getting weather summary:', error);
            return 'Unable to fetch weather information';
        }
    }
}
