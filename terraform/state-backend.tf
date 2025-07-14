# This file creates the infrastructure needed for OpenTofu state management
# Run this FIRST before configuring the backend in main.tf

# S3 bucket for OpenTofu state
resource "aws_s3_bucket" "tofu_state" {
  bucket = "${var.project_name}-tofu-state-${random_id.bucket_suffix.hex}"

  tags = {
    Name        = "OpenTofu State"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Random suffix for bucket name to ensure uniqueness
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# S3 bucket versioning
resource "aws_s3_bucket_versioning" "tofu_state" {
  bucket = aws_s3_bucket.tofu_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 bucket encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "tofu_state" {
  bucket = aws_s3_bucket.tofu_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 bucket public access block
resource "aws_s3_bucket_public_access_block" "tofu_state" {
  bucket = aws_s3_bucket.tofu_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# DynamoDB table for state locking
resource "aws_dynamodb_table" "tofu_locks" {
  name         = "${var.project_name}-tofu-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name        = "OpenTofu State Locks"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Output the backend configuration for reference
output "tofu_state_bucket" {
  description = "Name of the S3 bucket for OpenTofu state"
  value       = aws_s3_bucket.tofu_state.id
}

output "tofu_locks_table" {
  description = "Name of the DynamoDB table for OpenTofu state locking"
  value       = aws_dynamodb_table.tofu_locks.name
}

output "backend_configuration" {
  description = "Backend configuration to add to main.tf"
  value       = <<EOF
# Add this to your terraform block in main.tf:
terraform {
  backend "s3" {
    bucket         = "${aws_s3_bucket.tofu_state.id}"
    key            = "terraform.tfstate"
    region         = "${var.aws_region}"
    dynamodb_table = "${aws_dynamodb_table.tofu_locks.name}"
    encrypt        = true
  }
}
EOF
} 