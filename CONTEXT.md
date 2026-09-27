# lunch-slack-bot

A serverless Slack bot that decides each day whether the weather invites an outdoor team lunch: it sends a reminder when it does, a warning to opted-in locations when it doesn't, and records who confirmed for which week.

## Language

**WeatherDecision**:
The act of answering "is the weather good for outdoor lunch?" for a location, given the day's forecast and the decision criteria — temperature threshold, good/bad condition lists, and the check hour.
_Avoid_: WeatherService, weather assessment, weather check (that is the whole scheduled run)

**LunchWeather**:
The answer a WeatherDecision returns: good, bad-weather, or no-forecast. No-forecast means "couldn't answer" and is never treated as bad weather.
_Avoid_: weather condition result, WeatherConditionResult
