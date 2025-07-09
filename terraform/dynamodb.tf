# DynamoDB table for tracking sent messages
resource "aws_dynamodb_table" "message_tracking" {
  name         = "${local.base_name}-message-tracking"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "location"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  # Global Secondary Index for querying by location
  global_secondary_index {
    name            = "location-timestamp-index"
    hash_key        = "location"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  # TTL to automatically delete old records after 90 days
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = merge(var.tags, {
    Name = "${local.base_name}-message-tracking"
  })
} 