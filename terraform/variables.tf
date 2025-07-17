variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "lunch-weather-bot"
}

variable "deployment_suffix" {
  description = "Suffix to make resource names unique for multiple deployments (e.g., team name, channel name)"
  type        = string
  default     = ""

  validation {
    condition     = can(regex("^[a-z0-9-]*$", var.deployment_suffix))
    error_message = "Deployment suffix must contain only lowercase letters, numbers, and hyphens."
  }
}



variable "location_name" {
  description = "Name of the location for weather checks"
  type        = string
  default     = "Munich"
}

variable "location_lat" {
  description = "Latitude of the location"
  type        = number
  default     = 48.1351
}

variable "location_lon" {
  description = "Longitude of the location"
  type        = number
  default     = 11.5820
}

variable "slack_channel" {
  description = "Slack channel identifier for personalized messages (e.g., '#general', '#lunch')"
  type        = string
  default     = ""
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 60
}

variable "lambda_memory" {
  description = "Lambda function memory in MB"
  type        = number
  default     = 256
}

variable "lambda_runtime" {
  description = "Lambda runtime version"
  type        = string
  default     = "nodejs22.x"
}

variable "log_retention_days" {
  description = "CloudWatch log retention period in days"
  type        = number
  default     = 14
}

variable "api_gateway_stage_name" {
  description = "API Gateway deployment stage name"
  type        = string
  default     = "prod"
}

variable "tags" {
  description = "Common tags to be applied to all resources"
  type        = map(string)
  default = {
    Project   = "lunch-weather-bot"
    ManagedBy = "opentofu"
  }
} 