# OpenTofu State Backend Setup

This guide explains how to set up remote state management for your OpenTofu configuration using S3 and DynamoDB.

## Why Remote State?

Using remote state provides several benefits:

- **Team Collaboration**: Multiple team members can work on the same infrastructure
- **State Locking**: Prevents concurrent modifications that could corrupt state
- **Backup & Versioning**: State is automatically backed up and versioned
- **Security**: Sensitive data in state is encrypted at rest
- **Consistency**: Everyone uses the same state file

## Setup Process

### Step 1: Initial Setup (First Time Only)

1. **Comment out any existing backend configuration** in `main.tf` (if any)

2. **Deploy the state backend infrastructure**:

    ```bash
    cd terraform
    tofu init
    tofu plan
    tofu apply
    ```

3. **Note the output values** - you'll need these for the backend configuration:
    - `tofu_state_bucket`
    - `tofu_locks_table`
    - `backend_configuration` (shows the exact configuration to use)

### Step 2: Configure Remote Backend

1. **Add the backend configuration** to your `terraform` block in `main.tf`:

    ```hcl
    terraform {
      required_version = ">= 1.0"

      backend "s3" {
        bucket         = "lunch-weather-bot-tofu-state-<random-suffix>"
        key            = "terraform.tfstate"
        region         = "eu-central-1"
        dynamodb_table = "lunch-weather-bot-tofu-locks"
        encrypt        = true
      }

      required_providers {
        aws = {
          source  = "hashicorp/aws"
          version = "~> 5.0"
        }
        random = {
          source  = "hashicorp/random"
          version = "~> 3.4"
        }
      }
    }
    ```

2. **Reinitialize OpenTofu** to use the remote backend:

    ```bash
    tofu init
    ```

    When prompted, choose "yes" to copy existing state to the new backend.

3. **Verify the migration**:

    ```bash
    tofu plan
    ```

    This should show no changes if the migration was successful.

### Step 3: Clean Up (Optional)

You can now remove the `state-backend.tf` file if you want:

```bash
rm state-backend.tf
```

And run `tofu apply` to remove the state backend resources from your local state (they'll remain in the remote state).

## Team Setup

For new team members:

1. **Clone the repository**
2. **Set up AWS credentials**
3. **Initialize OpenTofu**:

    ```bash
    cd terraform
    tofu init
    ```

    OpenTofu will automatically use the remote state backend.

## Important Notes

- **Never commit your local state files** to version control
- **State locking** prevents concurrent modifications - you'll get an error if someone else is applying changes
- **Backup your state** before major changes (though S3 versioning provides automatic backups)
- **State files can contain sensitive data** - ensure your S3 bucket is properly secured

## Troubleshooting

### State Lock Issues

If you encounter a state lock error:

```bash
tofu force-unlock <lock-id>
```

### Migration Issues

If state migration fails, you can manually import the state:

```bash
tofu import aws_s3_bucket.tofu_state <bucket-name>
tofu import aws_dynamodb_table.tofu_locks <table-name>
```

## Security Considerations

- S3 bucket has versioning enabled
- S3 bucket blocks all public access
- DynamoDB table uses on-demand pricing
- State is encrypted at rest in S3
- Use IAM roles/policies to control access to state resources
