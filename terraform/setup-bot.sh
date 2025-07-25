#!/bin/bash

# Lunch Weather Bot Complete Setup Script
# This script automates the setup of:
# 1. OpenTofu remote state backend
# 2. Configuration file (terraform.tfvars)
# 3. Deployment process
# 4. Instructions for setting up the Slack webhook secret

set -e

echo "🍽️  Lunch Weather Bot Setup"
echo "=========================="
echo ""

# Check if we're in the terraform directory
if [ ! -f "main.tf" ]; then
    echo "❌ Error: Please run this script from the terraform directory"
    exit 1
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
    echo "❌ Error: AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

# Function to prompt for input with default value
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local result
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " result
        result=${result:-$default}
    else
        read -p "$prompt: " result
    fi
    
    echo "$result"
}

# Function to prompt for yes/no
prompt_yes_no() {
    local prompt="$1"
    local default="$2"
    local result
    
    while true; do
        if [ "$default" = "y" ]; then
            read -p "$prompt [Y/n]: " result
            result=${result:-y}
        else
            read -p "$prompt [y/N]: " result
            result=${result:-n}
        fi
        
        case $result in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

# Step 1: Check if terraform.tfvars exists and configure if needed
echo "📝 Step 1: Configuring terraform.tfvars..."
if [ ! -f "terraform.tfvars" ]; then
    echo "Creating terraform.tfvars from template..."
    
    if [ ! -f "terraform.tfvars.example" ]; then
        echo "❌ Error: terraform.tfvars.example not found"
        exit 1
    fi
    
    # Copy template
    cp terraform.tfvars.example terraform.tfvars
    
    echo ""
    echo "🔧 Let's configure your weather bot:"
    echo ""
    
    # Prompt for configuration
    echo "📍 Location Settings:"
    LOCATION_NAME=$(prompt_with_default "Location name" "Munich")
    LOCATION_LAT=$(prompt_with_default "Latitude" "48.1351")
    LOCATION_LON=$(prompt_with_default "Longitude" "11.5820")
    
    echo ""
    echo "💬 Slack Settings:"
    SLACK_CHANNEL_INPUT=$(prompt_with_default "Slack channel (e.g., general, lunch)" "general")
    # Add # prefix if not present
    if [[ "$SLACK_CHANNEL_INPUT" != "#"* ]]; then
        SLACK_CHANNEL="#$SLACK_CHANNEL_INPUT"
    else
        SLACK_CHANNEL="$SLACK_CHANNEL_INPUT"
    fi
    echo "   Using channel: $SLACK_CHANNEL"
    
    echo ""
    echo "🌡️  Weather Settings:"
    MIN_TEMPERATURE=$(prompt_with_default "Minimum temperature for good weather (°C)" "14")
    # Validate temperature is a number between -50 and 50
    if ! [[ "$MIN_TEMPERATURE" =~ ^-?[0-9]+$ ]] || [ "$MIN_TEMPERATURE" -lt -50 ] || [ "$MIN_TEMPERATURE" -gt 50 ]; then
        echo "❌ Minimum temperature must be a number between -50 and 50"
        exit 1
    fi
    
    echo ""
    echo "⚠️  Weather Warnings (Optional):"
    echo "   Weather warnings notify your team when weather is poor for outdoor lunch."
    echo "   Most teams don't need this feature."
    if prompt_yes_no "Enable weather warning messages for bad weather?" "n"; then
        ENABLE_WEATHER_WARNINGS="true"
        echo "   ✅ Weather warnings enabled - team members can opt-in via the Reply API"
    else
        ENABLE_WEATHER_WARNINGS="false"
        echo "   ✅ Weather warnings disabled (recommended for most teams)"
    fi
    
    echo ""
    echo "🌐 AWS Settings:"
    AWS_REGION=$(prompt_with_default "AWS region" "eu-central-1")
    
    echo ""
    echo "🏷️  Deployment Options:"
    if prompt_yes_no "Do you want to use a deployment suffix (for multiple teams/channels)?" "n"; then
        DEPLOYMENT_SUFFIX=$(prompt_with_default "Deployment suffix (e.g., team-alpha, berlin-office)" "")
        # Validate suffix format
        if [[ ! "$DEPLOYMENT_SUFFIX" =~ ^[a-z0-9-]*$ ]]; then
            echo "❌ Deployment suffix must contain only lowercase letters, numbers, and hyphens"
            exit 1
        fi
    else
        DEPLOYMENT_SUFFIX=""
    fi
    
    # Update terraform.tfvars with user inputs
    cat > terraform.tfvars <<EOF
# Lunch Weather Bot Configuration
# Generated by setup-bot.sh on $(date)

# Location settings
location_name = "$LOCATION_NAME"
location_lat  = $LOCATION_LAT
location_lon  = $LOCATION_LON

# Weather settings
min_temperature = $MIN_TEMPERATURE
enable_weather_warnings = $ENABLE_WEATHER_WARNINGS

# Slack settings
slack_channel = "$SLACK_CHANNEL"

# AWS settings
aws_region = "$AWS_REGION"

# Deployment suffix (empty for single deployment)
deployment_suffix = "$DEPLOYMENT_SUFFIX"

# Optional: Advanced settings (using defaults)
environment         = "prod"
lambda_timeout      = 60
lambda_memory       = 256
log_retention_days  = 14
EOF
    
    echo ""
    echo "✅ terraform.tfvars configured successfully!"
    echo ""
else
    echo "✅ terraform.tfvars already exists"
fi

# Step 2: Deploy state backend infrastructure
echo "📦 Step 2: Deploying state backend infrastructure..."
tofu init
tofu plan -out=backend.tfplan
tofu apply backend.tfplan
rm backend.tfplan

# Step 3: Capture output values
echo "📝 Step 3: Capturing backend configuration..."
BUCKET_NAME=$(tofu output -raw tofu_state_bucket)
LOCKS_TABLE=$(tofu output -raw tofu_locks_table)
AWS_REGION=$(tofu output -raw aws_region 2>/dev/null || echo "eu-central-1")

echo "✅ State backend infrastructure created:"
echo "   S3 Bucket: $BUCKET_NAME"
echo "   DynamoDB Table: $LOCKS_TABLE"
echo "   Region: $AWS_REGION"

# Step 4: Generate backend configuration
echo "🔧 Step 4: Generating backend configuration..."
cat > backend-config.tmp <<EOF
  backend "s3" {
    bucket         = "$BUCKET_NAME"
    key            = "terraform.tfstate"
    region         = "$AWS_REGION"
    dynamodb_table = "$LOCKS_TABLE"
    encrypt        = true
  }
EOF

# Step 5: Update main.tf with backend configuration
echo "📝 Step 5: Updating main.tf with backend configuration..."
if grep -q "backend \"s3\"" main.tf; then
    echo "⚠️  Backend configuration already exists in main.tf"
else
    # Insert backend configuration after required_version
    sed -i.bak '/required_version = ">= 1.0"/a\
\
  backend "s3" {\
    bucket         = "'$BUCKET_NAME'"\
    key            = "terraform.tfstate"\
    region         = "'$AWS_REGION'"\
    dynamodb_table = "'$LOCKS_TABLE'"\
    encrypt        = true\
  }' main.tf
fi

# Step 6: Reinitialize with remote backend
echo "🔄 Step 6: Reinitializing OpenTofu with remote backend..."
tofu init -migrate-state

# Step 7: Build the application
echo "🏗️  Step 7: Building the application..."
cd ..
if [ -f "package.json" ]; then
    npm run build
    echo "✅ Application built successfully!"
else
    echo "❌ Error: package.json not found in parent directory"
    exit 1
fi
cd terraform

# Step 8: Deploy the weather bot
echo "🚀 Step 8: Deploying the weather bot..."
tofu plan
echo ""
if prompt_yes_no "Do you want to deploy the weather bot now?" "y"; then
    tofu apply
    echo ""
    echo "🎉 Weather bot deployed successfully!"
else
    echo "⏸️  Deployment skipped. Run 'tofu apply' when ready."
fi

# Step 9: Set up Slack webhook secret
echo "🔐 Step 9: Setting up Slack webhook secret..."
echo ""
echo "IMPORTANT: You need to manually set up the Slack webhook URL in AWS Secrets Manager:"
echo ""
echo "1. Create a Slack webhook URL:"
echo "   - Go to https://api.slack.com/apps"
echo "   - Create a new app or use existing one"
echo "   - Go to 'Incoming Webhooks' and activate it"
echo "   - Click 'Add New Webhook to Workspace'"
echo "   - Choose your channel and copy the webhook URL"
echo ""
echo "2. Store the webhook URL in AWS Secrets Manager:"
echo "   - Go to AWS Console → Secrets Manager"

# Get deployment suffix for secret name
DEPLOYMENT_SUFFIX_VAR=$(grep "deployment_suffix" terraform.tfvars | cut -d'"' -f2)
if [ -n "$DEPLOYMENT_SUFFIX_VAR" ]; then
    SECRET_NAME="lunch-bot-${DEPLOYMENT_SUFFIX_VAR}/slack-webhook"
else
    SECRET_NAME="lunch-bot/slack-webhook"
fi

echo "   - Find the secret named '$SECRET_NAME'"
echo "   - Click 'Retrieve secret value' → 'Edit'"
echo "   - Set the secret value as JSON:"
echo "     {\"webhook_url\": \"https://hooks.slack.com/services/YOUR/WEBHOOK/URL\"}"
echo "   - Save the secret"
echo ""

# Offer to set up the secret via CLI
echo "Alternatively, you can set up the secret via AWS CLI:"
echo ""
read -p "Do you have your Slack webhook URL ready? [y/N]: " HAVE_WEBHOOK
if [[ "$HAVE_WEBHOOK" =~ ^[Yy]$ ]]; then
    read -p "Enter your Slack webhook URL: " WEBHOOK_URL
    if [[ "$WEBHOOK_URL" =~ ^https://hooks\.slack\.com/services/ ]]; then
        echo "Setting up the secret via AWS CLI..."
        aws secretsmanager put-secret-value \
            --secret-id "$SECRET_NAME" \
            --secret-string "{\"webhook_url\": \"$WEBHOOK_URL\"}" \
            --region "$AWS_REGION"
        echo "✅ Slack webhook secret configured successfully!"
    else
        echo "❌ Invalid webhook URL format. Please set up the secret manually via AWS Console."
    fi
else
    echo "💡 Set up the secret manually when you have your webhook URL ready."
fi

# Step 10: Verify setup
echo "✅ Step 10: Verifying setup..."
tofu plan | head -20

# Cleanup
rm -f backend-config.tmp

echo ""
echo "🎉 Success! Lunch Weather Bot is fully configured and deployed!"
echo ""
echo "📋 What was set up:"
echo "✅ Remote state backend (S3 + DynamoDB)"
echo "✅ Configuration file (terraform.tfvars)"
echo "✅ Application built and deployed"
echo "✅ Lambda function ready to run"
echo "✅ Secrets Manager secret created (needs webhook URL)"
echo ""
echo "🗂️  Backend Details:"
echo "   S3 Bucket: $BUCKET_NAME"
echo "   DynamoDB Table: $LOCKS_TABLE"
echo "   Region: $AWS_REGION"
echo ""
echo "🤖 Bot Details:"
FUNCTION_NAME=$(tofu output -raw weather_check_function_name 2>/dev/null || echo "lunch-weather-bot-weather-check")
LOG_GROUP=$(tofu output -raw weather_check_log_group 2>/dev/null || echo "/aws/lambda/lunch-weather-bot-weather-check")
echo "   Lambda Function: $FUNCTION_NAME"
echo "   Log Group: $LOG_GROUP"
echo "   Schedule: Weekdays at 10 AM CEST"
echo "   Secret Name: $SECRET_NAME"
echo ""
echo "🧪 Testing:"
echo "   1. Ensure the Slack webhook secret is configured"
echo "   2. Go to AWS Console → Lambda → $FUNCTION_NAME"
echo "   3. Click 'Test' button"
echo "   4. Create test event: {}"
echo "   5. Check CloudWatch logs: $LOG_GROUP"
echo ""
echo "👥 Team Setup:"
echo "   1. Commit the changes to main.tf (but NOT terraform.tfvars)"
echo "   2. Share the backend configuration with your team"
echo "   3. Team members run: tofu init"
echo "   4. Each team member creates their own terraform.tfvars"
echo "   5. One team member sets up the Slack webhook secret"
echo ""
echo "🔧 For multiple deployments:"
echo "   Use tofu workspaces and different deployment_suffix values" 