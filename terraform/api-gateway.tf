# Archive file for Reply Lambda deployment
data "archive_file" "reply" {
  type        = "zip"
  source_file = "../dist/reply.js"
  output_path = "../dist/reply.zip"
}

# Reply Lambda Function
resource "aws_lambda_function" "reply" {
  filename         = data.archive_file.reply.output_path
  function_name    = "${local.base_name}-reply"
  role             = aws_iam_role.lambda_execution_role.arn
  handler          = "reply.handler"
  runtime          = var.lambda_runtime
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory
  source_code_hash = data.archive_file.reply.output_base64sha256

  environment {
    variables = {
      SLACK_WEBHOOK_URL   = var.slack_webhook_url
      LOCATION_NAME       = var.location_name
      LOCATION_LAT        = tostring(var.location_lat)
      LOCATION_LON        = tostring(var.location_lon)
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.message_tracking.name
      REPLY_API_URL       = "https://${aws_api_gateway_rest_api.lunch_bot.id}.execute-api.${var.aws_region}.amazonaws.com/${var.api_gateway_stage_name}/reply"
    }
  }

  depends_on = [
    aws_iam_role_policy.lambda_policy,
    aws_cloudwatch_log_group.reply,
  ]

  tags = var.tags
}

# CloudWatch Log Group for Reply Lambda
resource "aws_cloudwatch_log_group" "reply" {
  name              = "/aws/lambda/${local.base_name}-reply"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

# API Gateway REST API
resource "aws_api_gateway_rest_api" "lunch_bot" {
  name        = "${local.base_name}-api"
  description = "API for lunch bot confirmation endpoint"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = var.tags
}

# API Gateway Resource
resource "aws_api_gateway_resource" "reply" {
  rest_api_id = aws_api_gateway_rest_api.lunch_bot.id
  parent_id   = aws_api_gateway_rest_api.lunch_bot.root_resource_id
  path_part   = "reply"
}

# API Gateway Method for POST
resource "aws_api_gateway_method" "reply_post" {
  rest_api_id   = aws_api_gateway_rest_api.lunch_bot.id
  resource_id   = aws_api_gateway_resource.reply.id
  http_method   = "POST"
  authorization = "NONE"
}

# API Gateway Method for GET
resource "aws_api_gateway_method" "reply_get" {
  rest_api_id   = aws_api_gateway_rest_api.lunch_bot.id
  resource_id   = aws_api_gateway_resource.reply.id
  http_method   = "GET"
  authorization = "NONE"
}

# API Gateway Method for OPTIONS (CORS)
resource "aws_api_gateway_method" "reply_options" {
  rest_api_id   = aws_api_gateway_rest_api.lunch_bot.id
  resource_id   = aws_api_gateway_resource.reply.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# API Gateway Integration for POST
resource "aws_api_gateway_integration" "reply_post" {
  rest_api_id = aws_api_gateway_rest_api.lunch_bot.id
  resource_id = aws_api_gateway_resource.reply.id
  http_method = aws_api_gateway_method.reply_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.reply.invoke_arn
}

# API Gateway Integration for GET
resource "aws_api_gateway_integration" "reply_get" {
  rest_api_id = aws_api_gateway_rest_api.lunch_bot.id
  resource_id = aws_api_gateway_resource.reply.id
  http_method = aws_api_gateway_method.reply_get.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.reply.invoke_arn
}

# API Gateway Integration for OPTIONS (CORS)
resource "aws_api_gateway_integration" "reply_options" {
  rest_api_id = aws_api_gateway_rest_api.lunch_bot.id
  resource_id = aws_api_gateway_resource.reply.id
  http_method = aws_api_gateway_method.reply_options.http_method

  type = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

# API Gateway Method Response for POST
resource "aws_api_gateway_method_response" "reply_post" {
  rest_api_id = aws_api_gateway_rest_api.lunch_bot.id
  resource_id = aws_api_gateway_resource.reply.id
  http_method = aws_api_gateway_method.reply_post.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
  }
}

# API Gateway Method Response for GET
resource "aws_api_gateway_method_response" "reply_get" {
  rest_api_id = aws_api_gateway_rest_api.lunch_bot.id
  resource_id = aws_api_gateway_resource.reply.id
  http_method = aws_api_gateway_method.reply_get.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
  }
}

# API Gateway Method Response for OPTIONS (CORS)
resource "aws_api_gateway_method_response" "reply_options" {
  rest_api_id = aws_api_gateway_rest_api.lunch_bot.id
  resource_id = aws_api_gateway_resource.reply.id
  http_method = aws_api_gateway_method.reply_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
  }
}

# API Gateway Integration Response for POST
resource "aws_api_gateway_integration_response" "reply_post" {
  rest_api_id = aws_api_gateway_rest_api.lunch_bot.id
  resource_id = aws_api_gateway_resource.reply.id
  http_method = aws_api_gateway_method.reply_post.http_method
  status_code = aws_api_gateway_method_response.reply_post.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = "'*'"
  }

  depends_on = [
    aws_api_gateway_integration.reply_post,
    aws_api_gateway_method_response.reply_post
  ]
}

# API Gateway Integration Response for GET
resource "aws_api_gateway_integration_response" "reply_get" {
  rest_api_id = aws_api_gateway_rest_api.lunch_bot.id
  resource_id = aws_api_gateway_resource.reply.id
  http_method = aws_api_gateway_method.reply_get.http_method
  status_code = aws_api_gateway_method_response.reply_get.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = "'*'"
  }

  depends_on = [
    aws_api_gateway_integration.reply_get,
    aws_api_gateway_method_response.reply_get
  ]
}

# API Gateway Integration Response for OPTIONS (CORS)
resource "aws_api_gateway_integration_response" "reply_options" {
  rest_api_id = aws_api_gateway_rest_api.lunch_bot.id
  resource_id = aws_api_gateway_resource.reply.id
  http_method = aws_api_gateway_method.reply_options.http_method
  status_code = aws_api_gateway_method_response.reply_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
  }

  depends_on = [
    aws_api_gateway_integration.reply_options,
    aws_api_gateway_method_response.reply_options
  ]
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "api_gateway_reply" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.reply.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.lunch_bot.execution_arn}/*/*"
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "lunch_bot" {
  depends_on = [
    aws_api_gateway_integration.reply_get,
    aws_api_gateway_integration.reply_post,
    aws_api_gateway_integration.reply_options,
    aws_api_gateway_integration_response.reply_get,
    aws_api_gateway_integration_response.reply_post,
    aws_api_gateway_integration_response.reply_options,
  ]

  rest_api_id = aws_api_gateway_rest_api.lunch_bot.id

  lifecycle {
    create_before_destroy = true
  }

  # Force new deployment on changes
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.reply.id,
      aws_api_gateway_method.reply_get.id,
      aws_api_gateway_method.reply_post.id,
      aws_api_gateway_method.reply_options.id,
      aws_api_gateway_integration.reply_get.id,
      aws_api_gateway_integration.reply_post.id,
      aws_api_gateway_integration.reply_options.id,
    ]))
  }
}

# API Gateway Stage
resource "aws_api_gateway_stage" "lunch_bot" {
  deployment_id = aws_api_gateway_deployment.lunch_bot.id
  rest_api_id   = aws_api_gateway_rest_api.lunch_bot.id
  stage_name    = var.api_gateway_stage_name

  tags = var.tags
} 