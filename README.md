# 🌤️ Lunch Weather Bot

A simple serverless weather bot that automatically sends Slack messages when weather conditions are favorable for outdoor lunch meetups. Built with TypeScript, AWS Lambda, and deployed with Terraform.

## ✨ Features

- **Automatic Weather Monitoring**: Checks weather conditions every weekday at 10 AM CEST
- **Smart Weather Logic**: Only sends messages when weather is good (>12°C, sunny/cloudy)
- **Rate Limiting**: Maximum 2 messages per week (tracked in DynamoDB)
- **Manual Testing**: Trigger from AWS Console with customizable parameters
- **Webhook Integration**: Sends messages directly to Slack webhook URL

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   EventBridge   │───▶│  Weather Check  │───▶│ Slack Webhook   │
│  (Scheduler)    │    │    Lambda       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │    DynamoDB     │
                       │ (Rate Limiting) │
                       └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 22.x or higher
- AWS CLI configured with appropriate permissions
- Terraform >= 1.0
- A Slack workspace with webhook URL

### 1. Clone and Install

```bash
git clone <repository-url>
cd lunch-slack-bot
npm install
```

### 2. Quick Setup (Recommended)

Use the automated setup script:

```bash
cd terraform
chmod +x setup-bot.sh
./setup-bot.sh
```

The script will guide you through:

- ✅ Creating `terraform.tfvars` with your webhook URL
- ✅ Setting up remote state backend (S3 + DynamoDB)
- ✅ Building and deploying the application
- ✅ Providing testing instructions

### 2b. Manual Configuration (Alternative)

If you prefer manual setup, create `terraform/terraform.tfvars`:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your actual webhook URL
```

```hcl
slack_webhook_url = "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
location_name     = "Munich"
location_lat      = 48.1351
location_lon      = 11.5820
aws_region        = "eu-central-1"
deployment_suffix = "team-alpha"  # Optional: for multiple deployments
```

> ⚠️ **Security Note**: `terraform.tfvars` is excluded from git to protect your webhook URL. Never commit secrets to version control!

#### Multiple Deployments / Slack Channels

To deploy multiple instances for different teams or channels, use the `deployment_suffix`:

**Team Alpha:**

```hcl
slack_webhook_url = "https://hooks.slack.com/services/T123/B456/team-alpha"
deployment_suffix = "team-alpha"
location_name     = "Munich"
```

**Team Beta:**

```hcl
slack_webhook_url = "https://hooks.slack.com/services/T123/B789/team-beta"
deployment_suffix = "team-beta"
location_name     = "Berlin"
```

This creates separate resources:

- `lunch-weather-bot-team-alpha-weather-check` (Lambda)
- `lunch-weather-bot-team-alpha-message-tracking` (DynamoDB)
- `lunch-weather-bot-team-beta-weather-check` (Lambda)
- `lunch-weather-bot-team-beta-message-tracking` (DynamoDB)

### 3. Build and Deploy

**If you used the setup script:** You're done! 🎉

**If you configured manually:**

```bash
# Build the application (from project root)
npm run build

# Deploy to AWS (from terraform directory)
cd terraform
terraform init
terraform plan
terraform apply
```

### 4. Multiple Deployments (Optional)

**Using the setup script:**

```bash
# For each team, run the setup script in a new workspace
terraform workspace new team-alpha
./setup-bot.sh
# Script will prompt for team-specific settings

terraform workspace new team-beta
./setup-bot.sh
# Configure for team beta
```

**Manual approach:**

```bash
# Deploy for Team Alpha
echo 'deployment_suffix = "team-alpha"' >> terraform.tfvars
terraform apply

# Deploy for Team Beta (using different workspace)
terraform workspace new team-beta
echo 'deployment_suffix = "team-beta"' > terraform.tfvars
echo 'slack_webhook_url = "https://hooks.slack.com/services/T123/B789/team-beta"' >> terraform.tfvars
terraform apply

# Switch back to default workspace
terraform workspace select default
```

## 🔧 Configuration

### Weather Settings

The bot considers weather "good" when:

- Temperature > 12°C at specified hour (default: noon)
- Conditions are sunny or partly cloudy
- No rain, thunderstorms, or snow

These settings can be overridden at runtime through event parameters (see Testing section) or by modifying the defaults in `src/utils/env.ts`:

```typescript
// Default weather configuration
minTemperature: overrides?.minTemperature ?? 12,
goodWeatherConditions: overrides?.goodWeatherConditions ?? ['clear', 'clouds'],
badWeatherConditions: overrides?.badWeatherConditions ?? ['rain', 'drizzle', 'thunderstorm', 'snow'],
weatherCheckHour: overrides?.weatherCheckHour ?? 12, // Default to noon
```

### Rate Limiting

- **Maximum**: 2 messages per week
- **Tracking**: DynamoDB table with automatic cleanup after 30 days
- **Logic**: Checks both daily and weekly limits before sending

### Scheduling

Default schedule: Weekdays at 10 AM CEST (8 AM UTC)

Modify in `terraform/main.tf`:

```terraform
resource "aws_cloudwatch_event_rule" "weather_check_schedule" {
  schedule_expression = "cron(0 8 ? * MON-FRI *)"
}
```

## 🧪 Manual Testing

You can manually trigger the lambda function from the AWS Console with customizable parameters:

1. Go to AWS Console → Lambda → `lunch-weather-bot-weather-check`
2. Click "Test" button
3. Create a test event with optional parameter overrides

### Available Override Parameters

All parameters are optional and fall back to defaults if not provided:

```json
{
    "overrides": {
        "locationName": "Berlin",
        "locationLat": 52.52,
        "locationLon": 13.405,
        "slackWebhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
        "dynamodbTableName": "my-custom-table",
        "minTemperature": 15,
        "goodWeatherConditions": ["clear", "clouds"],
        "badWeatherConditions": ["rain", "drizzle", "snow"],
        "weatherCheckHour": 14
    }
}
```

**Parameter descriptions:**

- `locationName` - City name for weather check
- `locationLat` / `locationLon` - Coordinates for weather check
- `slackWebhookUrl` - Different Slack webhook URL
- `dynamodbTableName` - Different DynamoDB table
- `minTemperature` - Minimum temperature for good weather (°C)
- `goodWeatherConditions` - Weather conditions considered good
- `badWeatherConditions` - Weather conditions considered bad
- `weatherCheckHour` - Hour of day to check weather for (0-23)

### Testing Examples

**Test different location:**

```json
{
    "overrides": {
        "locationName": "Paris",
        "locationLat": 48.8566,
        "locationLon": 2.3522
    }
}
```

**Test with relaxed weather criteria:**

```json
{
    "overrides": {
        "minTemperature": 8,
        "goodWeatherConditions": ["clear", "clouds", "rain"],
        "badWeatherConditions": ["thunderstorm", "snow"]
    }
}
```

**Test for evening weather (6 PM):**

```json
{
    "overrides": {
        "weatherCheckHour": 18
    }
}
```

**Test with different webhook:**

```json
{
    "overrides": {
        "slackWebhookUrl": "https://hooks.slack.com/services/T123/B456/xyz"
    }
}
```

**Use all defaults:**

```json
{}
```

## 🔑 Slack Webhook Setup

1. Go to [Slack API](https://api.slack.com/apps)
2. Create a new app or use existing one
3. Go to "Incoming Webhooks" and activate it
4. Click "Add New Webhook to Workspace"
5. Choose your channel and copy the webhook URL
6. Use this URL in your `terraform.tfvars` file

## 🔒 Security & Secrets Management

### Automated Setup (Recommended)

The `setup-bot.sh` script handles all security aspects automatically:

- Creates `terraform.tfvars` with proper validation
- Excludes secrets from git (already configured in `.gitignore`)
- Sets up remote state backend for team collaboration

### Local Development (Manual)

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your webhook URL
```

### Environment Variables

```bash
export TF_VAR_slack_webhook_url="https://hooks.slack.com/services/..."
terraform plan
```

### Production (AWS Secrets Manager)

For production deployments, consider using AWS Secrets Manager:

1. Store webhook URL in AWS Secrets Manager
2. Uncomment the secrets management code in `terraform/secrets.tf`
3. Update lambda.tf to use the secret

### Multiple Teams

Each team should have their own `terraform.tfvars` file:

```bash
# Team Alpha
terraform workspace new team-alpha
echo 'deployment_suffix = "team-alpha"' > terraform.tfvars
echo 'slack_webhook_url = "https://hooks.slack.com/services/T123/B456/alpha"' >> terraform.tfvars

# Team Beta
terraform workspace new team-beta
echo 'deployment_suffix = "team-beta"' > terraform.tfvars
echo 'slack_webhook_url = "https://hooks.slack.com/services/T123/B789/beta"' >> terraform.tfvars
```

## 📊 Monitoring

- **CloudWatch Logs**: `/aws/lambda/lunch-weather-bot-weather-check`
- **DynamoDB Table**: `lunch-weather-bot-message-tracking`
- **EventBridge Rule**: `lunch-weather-bot-schedule`

## 🛠️ Development

### Local Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build for deployment
npm run build
```

### Project Structure

```
src/
├── handlers/           # Lambda function handlers
├── implementations/    # API implementations
├── interfaces/         # TypeScript interfaces
├── schemas/           # Zod validation schemas
├── services/          # Business logic
├── types/             # TypeScript types
└── utils/             # Utility functions

terraform/             # Infrastructure as Code
├── main.tf           # Main resources
├── lambda.tf         # Lambda function
├── dynamodb.tf       # DynamoDB table
├── variables.tf      # Input variables
├── outputs.tf        # Output values
├── setup-bot.sh      # Complete setup script
└── setup-state-backend.md  # Manual backend setup docs
```

## 🌍 Environment Variables

| Variable              | Description         | Default        |
| --------------------- | ------------------- | -------------- |
| `SLACK_WEBHOOK_URL`   | Slack webhook URL   | Required       |
| `LOCATION_NAME`       | Location name       | Munich         |
| `LOCATION_LAT`        | Latitude            | 48.1351        |
| `LOCATION_LON`        | Longitude           | 11.5820        |
| `AWS_REGION`          | AWS region          | eu-central-1   |
| `DYNAMODB_TABLE_NAME` | DynamoDB table name | Auto-generated |

## 🔧 Terraform Variables

| Variable             | Description                                  | Default      |
| -------------------- | -------------------------------------------- | ------------ |
| `slack_webhook_url`  | Slack webhook URL                            | Required     |
| `location_name`      | Location name for weather checks             | Munich       |
| `location_lat`       | Latitude coordinate                          | 48.1351      |
| `location_lon`       | Longitude coordinate                         | 11.5820      |
| `aws_region`         | AWS region for deployment                    | eu-central-1 |
| `deployment_suffix`  | Suffix for resource names (multiple deploys) | "" (empty)   |
| `environment`        | Environment name                             | prod         |
| `lambda_timeout`     | Lambda timeout in seconds                    | 60           |
| `lambda_memory`      | Lambda memory in MB                          | 256          |
| `log_retention_days` | CloudWatch log retention                     | 14           |

## 📝 License

MIT License - see LICENSE file for details.
