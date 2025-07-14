terraform {
  required_version = ">= 1.0"

  # backend "s3" {
  #   bucket         = "lunch-weather-bot-tofu-state-9e1e6af1"
  #   key            = "terraform.tfstate"
  #   region         = "eu-central-1"
  #   dynamodb_table = "lunch-weather-bot-tofu-locks"
  #   encrypt        = true
  # }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Local values for resource naming
locals {
  name_suffix = var.deployment_suffix != "" ? "-${var.deployment_suffix}" : ""
  base_name   = "${var.project_name}${local.name_suffix}"
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "weather_check" {
  name              = "/aws/lambda/${local.base_name}-weather-check"
  retention_in_days = var.log_retention_days
}

# EventBridge Rule for scheduling
resource "aws_cloudwatch_event_rule" "weather_check_schedule" {
  name                = "${local.base_name}-schedule"
  description         = "Trigger weather check on weekdays at 10 AM CEST"
  schedule_expression = "cron(0 8 ? * MON-FRI *)" # 10 AM CEST = 8 AM UTC
}

# EventBridge Target
resource "aws_cloudwatch_event_target" "weather_check_target" {
  rule      = aws_cloudwatch_event_rule.weather_check_schedule.name
  target_id = "WeatherCheckLambdaTarget"
  arn       = aws_lambda_function.weather_check.arn
}

# Lambda permission for EventBridge
resource "aws_lambda_permission" "eventbridge_weather_check" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.weather_check.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.weather_check_schedule.arn
}
