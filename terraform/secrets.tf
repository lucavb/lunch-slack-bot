# Optional: Production secrets management using AWS Secrets Manager
# Uncomment and modify if you want to use AWS Secrets Manager instead of terraform.tfvars

# data "aws_secretsmanager_secret" "slack_webhook" {
#   name = "lunch-bot${local.name_suffix}/slack-webhook"
# }

# data "aws_secretsmanager_secret_version" "slack_webhook" {
#   secret_id = data.aws_secretsmanager_secret.slack_webhook.id
# }

# locals {
#   slack_webhook_url = jsondecode(data.aws_secretsmanager_secret_version.slack_webhook.secret_string)["webhook_url"]
# }

# Then use local.slack_webhook_url instead of var.slack_webhook_url in lambda.tf 