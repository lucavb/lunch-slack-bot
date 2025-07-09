output "weather_check_function_name" {
  description = "Name of the weather check Lambda function"
  value       = aws_lambda_function.weather_check.function_name
}

output "weather_check_log_group" {
  description = "CloudWatch log group for weather check function"
  value       = aws_cloudwatch_log_group.weather_check.name
}

output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_execution_role.arn
}

output "schedule_expression" {
  description = "EventBridge schedule expression for weather checks"
  value       = aws_cloudwatch_event_rule.weather_check_schedule.schedule_expression
}

output "deployment_region" {
  description = "AWS region where resources are deployed"
  value       = var.aws_region
}

output "environment" {
  description = "Deployment environment"
  value       = var.environment
}

output "deployment_suffix" {
  description = "Deployment suffix used for resource naming"
  value       = var.deployment_suffix
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table for message tracking"
  value       = aws_dynamodb_table.message_tracking.name
}

output "setup_instructions" {
  description = "Setup instructions for the weather bot"
  value       = <<-EOT
    Weather Bot Setup Complete!
    
    1. The lambda function runs automatically on weekdays at 10 AM CEST
    2. It checks weather conditions and sends messages to your Slack webhook
    3. Rate limiting: Max 2 messages per week (tracked in DynamoDB)
    
    Manual Testing:
    - Go to AWS Console → Lambda → ${aws_lambda_function.weather_check.function_name}
    - Click "Test" button
    - Create test event with parameter overrides (optional):
      {
        "overrides": {
          "locationName": "Berlin",
          "locationLat": 52.5200,
          "locationLon": 13.4050,
          "slackWebhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
        }
      }
    
    Monitoring:
    - CloudWatch Logs: ${aws_cloudwatch_log_group.weather_check.name}
    - DynamoDB Table: ${aws_dynamodb_table.message_tracking.name}
    
    Schedule: ${aws_cloudwatch_event_rule.weather_check_schedule.schedule_expression}
    Region: ${var.aws_region}
  EOT
} 