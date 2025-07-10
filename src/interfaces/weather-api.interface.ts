import { Coordinates } from '../types/index';
import { WeatherConditionResult } from '../schemas/weather.schema';
import { OpenMeteoForecast, OpenMeteoHourlyPoint } from '../schemas/openmeteo.schema';

export interface WeatherApi {
    getForecast(coordinates: Coordinates): Promise<OpenMeteoForecast>;
}

export interface WeatherService {
    getNoonForecast(coordinates: Coordinates): Promise<OpenMeteoHourlyPoint | null>;
    isWeatherGood(coordinates: Coordinates): Promise<WeatherConditionResult>;
    getWeatherSummary(coordinates: Coordinates): Promise<string>;
}
