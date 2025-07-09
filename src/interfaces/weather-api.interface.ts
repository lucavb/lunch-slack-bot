import { WeatherCondition, Coordinates } from '../types/index';
import { OpenMeteoForecast, OpenMeteoHourlyPoint } from '../schemas/openmeteo.schema';

export interface WeatherApi {
    getForecast(coordinates: Coordinates): Promise<OpenMeteoForecast>;
}

export interface WeatherService {
    getNoonForecast(coordinates: Coordinates): Promise<OpenMeteoHourlyPoint | null>;
    isWeatherGood(coordinates: Coordinates): Promise<WeatherCondition>;
    getWeatherSummary(coordinates: Coordinates): Promise<string>;
}
