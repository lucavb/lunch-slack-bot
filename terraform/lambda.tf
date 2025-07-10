# IAM Role for Lambda function
resource "aws_iam_role" "lambda_execution_role" {
  name = "${local.base_name}-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Policy for Lambda function
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${local.base_name}-lambda-policy"
  role = aws_iam_role.lambda_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:DeleteItem"
        ]
        Resource = [
          aws_dynamodb_table.message_tracking.arn,
          "${aws_dynamodb_table.message_tracking.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.slack_webhook.arn
        ]
      }
    ]
  })
}

# Archive file for Lambda deployment
data "archive_file" "weather_check" {
  type        = "zip"
  source_file = "../dist/weather-check.js"
  output_path = "../dist/weather-check.zip"
}

# Weather Check Lambda Function
resource "aws_lambda_function" "weather_check" {
  filename         = data.archive_file.weather_check.output_path
  function_name    = "${local.base_name}-weather-check"
  role             = aws_iam_role.lambda_execution_role.arn
  handler          = "weather-check.handler"
  runtime          = var.lambda_runtime
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory
  source_code_hash = data.archive_file.weather_check.output_base64sha256

  environment {
    variables = {
      SLACK_WEBHOOK_SECRET_ARN = aws_secretsmanager_secret.slack_webhook.arn
      LOCATION_NAME            = var.location_name
      LOCATION_LAT             = tostring(var.location_lat)
      LOCATION_LON             = tostring(var.location_lon)
      DYNAMODB_TABLE_NAME      = aws_dynamodb_table.message_tracking.name
      REPLY_API_URL            = "https://${aws_api_gateway_rest_api.lunch_bot.id}.execute-api.${var.aws_region}.amazonaws.com/${var.api_gateway_stage_name}/reply"
    }
  }

  depends_on = [
    aws_iam_role_policy.lambda_policy,
    aws_cloudwatch_log_group.weather_check,
    aws_api_gateway_rest_api.lunch_bot,
    aws_secretsmanager_secret.slack_webhook,
  ]

  tags = var.tags
} 