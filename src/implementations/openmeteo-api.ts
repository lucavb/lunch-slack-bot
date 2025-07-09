import { WeatherApi } from '../interfaces/weather-api.interface';
import { HttpClient } from '../interfaces/http-client.interface';
import { Coordinates } from '../types/index';
import { OpenMeteoForecast, validateOpenMeteoForecast } from '../schemas/openmeteo.schema';

export class OpenMeteoApi implements WeatherApi {
    private static readonly BASE_URL = 'https://api.open-meteo.com/v1/forecast';

    constructor(private httpClient: HttpClient) {}

    async getForecast(coordinates: Coordinates): Promise<OpenMeteoForecast> {
        try {
            const url = new URL(OpenMeteoApi.BASE_URL);

            // Set query parameters
            url.searchParams.append('latitude', coordinates.lat.toString());
            url.searchParams.append('longitude', coordinates.lon.toString());
            url.searchParams.append('hourly', 'temperature_2m,windspeed_10m,weathercode,cloud_cover');
            url.searchParams.append('timezone', 'auto');
            url.searchParams.append('forecast_days', '1');

            console.log(`Fetching Open-Meteo forecast for ${coordinates.locationName}:`, {
                url: url.toString(),
                coordinates: `${coordinates.lat}, ${coordinates.lon}`,
            });

            const data = await this.httpClient.get<unknown>(url.toString());

            // Validate response with Zod
            const validatedData = validateOpenMeteoForecast(data);

            console.log(`Successfully fetched Open-Meteo forecast for ${coordinates.locationName}:`, {
                timezone: validatedData.timezone,
                elevation: validatedData.elevation,
                hourlyDataPoints: validatedData.hourly.time.length,
            });

            return validatedData;
        } catch (error) {
            console.error('Error fetching Open-Meteo forecast:', error);

            if (error instanceof Error) {
                throw new Error(`Open-Meteo API error: ${error.message}`);
            }

            throw new Error(`Open-Meteo API error: ${error}`);
        }
    }
}
