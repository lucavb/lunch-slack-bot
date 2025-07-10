# AWS Secrets Manager secret for storing Slack webhook URL
resource "aws_secretsmanager_secret" "slack_webhook" {
  name        = "lunch-bot${local.name_suffix}/slack-webhook"
  description = "Slack webhook URL for lunch weather bot"
  recovery_window_in_days = 0
  tags = var.tags
}

# Note: The secret value must be manually populated via AWS Console, CLI, or separate deployment
# The secret expects a JSON structure like: {"webhook_url": "https://hooks.slack.com/services/..."}
# This cannot be stored in Terraform as it would expose the webhook URL in the state file

# Local value to reference the secret ARN for Lambda environment
locals {
  slack_webhook_secret_arn = aws_secretsmanager_secret.slack_webhook.arn
}

# Output the secret ARN for reference
output "slack_webhook_secret_arn" {
  description = "ARN of the Slack webhook secret in AWS Secrets Manager"
  value       = aws_secretsmanager_secret.slack_webhook.arn
  sensitive   = true
} 