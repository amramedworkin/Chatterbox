terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket  = "chatterbox-terraform-state-855581761117"
    key     = "terraform-simple.tfstate"
    region  = "us-east-1"
    profile = "cliadmin"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = "cliadmin"

  default_tags {
    tags = {
      Product     = "Chatterbox"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "Chatterbox Team"
      CostCenter  = "Chatterbox"
      Architecture = "Simplified-NoVPC"
    }
  }
}

# Resource Group for Chatterbox
resource "aws_resourcegroups_group" "chatterbox" {
  name = "${var.environment}-chatterbox-resources"

  resource_query {
    query = jsonencode({
      ResourceTypeFilters = [
        "AWS::S3::Bucket",
        "AWS::DynamoDB::Table",
        "AWS::Lambda::Function",
        "AWS::ApiGateway::RestApi",
        "AWS::SecretsManager::Secret",
        "AWS::SSM::Parameter"
      ]
      TagFilters = [
        {
          Key    = "Product"
          Values = ["Chatterbox"]
        },
        {
          Key    = "Environment"
          Values = [var.environment]
        }
      ]
    })
  }

  tags = {
    Name        = "${var.environment}-chatterbox-resource-group"
    Product     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "core"
    ManagedBy   = "Terraform"
  }
}

# DynamoDB for state storage
resource "aws_dynamodb_table" "state_table" {
  name           = "${var.environment}-chatterbox-state-table"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "pk"
  range_key      = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  tags = {
    Name        = "${var.environment}-chatterbox-state-table"
    Subsystem   = "core"
  }
}

# S3 Bucket for email storage
resource "aws_s3_bucket" "email_archive" {
  bucket = "${var.environment}-chatterbox-email-archive"

  tags = {
    Name        = "${var.environment}-chatterbox-email-archive"
    Subsystem   = "mail"
  }
}

resource "aws_s3_bucket_versioning" "email_archive" {
  bucket = aws_s3_bucket.email_archive.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "email_archive" {
  bucket = aws_s3_bucket.email_archive.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "email_archive" {
  bucket = aws_s3_bucket.email_archive.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Secrets Manager for Google credentials
resource "aws_secretsmanager_secret" "google_credentials" {
  name = "${var.environment}-chatterbox-google-credentials"

  tags = {
    Name        = "${var.environment}-chatterbox-google-credentials"
    Subsystem   = "mail"
  }
}

# Secrets Manager for Gmail tokens
resource "aws_secretsmanager_secret" "gmail_tokens" {
  name = "${var.environment}-chatterbox-gmail-tokens"

  tags = {
    Name        = "${var.environment}-chatterbox-gmail-tokens"
    Subsystem   = "mail"
  }
}

# Parameter Store parameters
resource "aws_ssm_parameter" "gmail_tokens_secret_name" {
  name  = "/chatterbox/${var.environment}/gmail-tokens-secret-name"
  type  = "String"
  value = aws_secretsmanager_secret.gmail_tokens.name

  tags = {
    Name        = "${var.environment}-gmail-tokens-secret-name"
    Subsystem   = "mail"
  }
}

resource "aws_ssm_parameter" "google_credentials_secret_name" {
  name  = "/chatterbox/${var.environment}/google-credentials-secret-name"
  type  = "String"
  value = aws_secretsmanager_secret.google_credentials.name

  tags = {
    Name        = "${var.environment}-google-credentials-secret-name"
    Subsystem   = "mail"
  }
}

resource "aws_ssm_parameter" "default_gmail_user" {
  name  = "/chatterbox/${var.environment}/default-gmail-user"
  type  = "String"
  value = var.default_gmail_user

  tags = {
    Name        = "${var.environment}-default-gmail-user"
    Subsystem   = "mail"
  }
}

resource "aws_ssm_parameter" "email_storage_bucket" {
  name  = "/chatterbox/${var.environment}/email-storage-bucket"
  type  = "String"
  value = aws_s3_bucket.email_archive.bucket

  tags = {
    Name        = "${var.environment}-email-storage-bucket"
    Subsystem   = "mail"
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "poll_lambda_logs" {
  name              = "/aws/lambda/${var.environment}-poll-gmail"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.environment}-poll-lambda-logs"
    Subsystem   = "mail"
  }
}

resource "aws_cloudwatch_log_group" "pull_lambda_logs" {
  name              = "/aws/lambda/${var.environment}-pull-latest-chatterbox-email"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.environment}-pull-lambda-logs"
    Subsystem   = "mail"
  }
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "${var.environment}-chatterbox-lambda-role"

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

  tags = {
    Name        = "${var.environment}-chatterbox-lambda-role"
    Subsystem   = "core"
  }
}

# IAM Policy for Lambda
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.environment}-chatterbox-lambda-policy"
  role = aws_iam_role.lambda_role.id

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
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.email_archive.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "arn:aws:s3:::chatterbox-email-content-development-pfspb0wj/*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = aws_dynamodb_table.state_table.arn
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.google_credentials.arn,
          aws_secretsmanager_secret.gmail_tokens.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:PutParameter"
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/chatterbox/${var.environment}/*"
      }
    ]
  })
}

# Outputs for Lambda deployment
output "lambda_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_role.arn
}

output "email_archive_bucket" {
  description = "Name of the email archive S3 bucket"
  value       = aws_s3_bucket.email_archive.bucket
}

output "google_credentials_secret_name" {
  description = "Name of the Google credentials secret"
  value       = aws_secretsmanager_secret.google_credentials.name
}

output "gmail_tokens_secret_name" {
  description = "Name of the Gmail tokens secret"
  value       = aws_secretsmanager_secret.gmail_tokens.name
}

output "default_gmail_user" {
  description = "Default Gmail user"
  value       = var.default_gmail_user
}

output "state_table_name" {
  description = "Name of the DynamoDB state table"
  value       = aws_dynamodb_table.state_table.name
} 