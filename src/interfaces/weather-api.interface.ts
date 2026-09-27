import { Coordinates } from '../types/index';
import { OpenMeteoForecast } from '../schemas/openmeteo.schema';

export interface WeatherApi {
    getForecast(coordinates: Coordinates): Promise<OpenMeteoForecast>;
}
