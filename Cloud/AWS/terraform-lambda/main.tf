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
    key     = "terraform-lambda.tfstate"
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
      Subsystem   = "lambda"
    }
  }
}

# Data sources to reference infrastructure from terraform-simple
data "terraform_remote_state" "infrastructure" {
  backend = "s3"
  config = {
    bucket  = "chatterbox-terraform-state-855581761117"
    key     = "terraform-simple.tfstate"
    region  = "us-east-1"
    profile = "cliadmin"
  }
}

# Get infrastructure outputs
locals {
  lambda_role_arn = data.terraform_remote_state.infrastructure.outputs.lambda_role_arn
  email_archive_bucket = data.terraform_remote_state.infrastructure.outputs.email_archive_bucket
  google_credentials_secret_name = data.terraform_remote_state.infrastructure.outputs.google_credentials_secret_name
  gmail_tokens_secret_name = data.terraform_remote_state.infrastructure.outputs.gmail_tokens_secret_name
  default_gmail_user = data.terraform_remote_state.infrastructure.outputs.default_gmail_user
  # Temporary hardcoded bucket name until email processing is deployed
  email_content_bucket = "chatterbox-email-content-development-pfspb0wj"
}

# Build Lambda deployment package
data "archive_file" "lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/lambda.zip"
  source_dir  = "${path.module}/lambda"
}

# Lambda function for polling Gmail
resource "aws_lambda_function" "poll_gmail" {
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  function_name    = "${var.environment}-poll-gmail"
  role            = local.lambda_role_arn
  handler         = "dist/pollGmail.handler"
  runtime         = "nodejs18.x"
  timeout         = 60
  memory_size     = 256

  environment {
    variables = {
      GMAIL_TOKENS_SECRET_NAME       = local.gmail_tokens_secret_name
      GOOGLE_CREDENTIALS_SECRET_NAME = local.google_credentials_secret_name
      EMAIL_STORAGE_BUCKET           = local.email_archive_bucket
      DEFAULT_GMAIL_USER             = local.default_gmail_user
      PARAMETER_STORE_PREFIX         = "/chatterbox/${var.environment}"
      EMAIL_CONTENT_BUCKET           = local.email_content_bucket
    }
  }

  tags = {
    Name        = "${var.environment}-poll-gmail"
    Subsystem   = "mail"
  }
}

# Lambda function for pulling latest email
resource "aws_lambda_function" "pull_latest_email" {
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  function_name    = "${var.environment}-pull-latest-chatterbox-email"
  role            = local.lambda_role_arn
  handler         = "dist/pullLatestChatterboxEmail.handler"
  runtime         = "nodejs18.x"
  timeout         = 30
  memory_size     = 256

  environment {
    variables = {
      GMAIL_TOKENS_SECRET_NAME       = local.gmail_tokens_secret_name
      GOOGLE_CREDENTIALS_SECRET_NAME = local.google_credentials_secret_name
      EMAIL_STORAGE_BUCKET           = local.email_archive_bucket
      DEFAULT_GMAIL_USER             = local.default_gmail_user
      EMAIL_CONTENT_BUCKET           = local.email_content_bucket
    }
  }

  tags = {
    Name        = "${var.environment}-pull-latest-chatterbox-email"
    Subsystem   = "mail"
  }
}

# Outputs
output "poll_gmail_function_name" {
  description = "Name of the poll Gmail Lambda function"
  value       = aws_lambda_function.poll_gmail.function_name
}

output "pull_latest_email_function_name" {
  description = "Name of the pull latest email Lambda function"
  value       = aws_lambda_function.pull_latest_email.function_name
}

output "poll_gmail_invoke_arn" {
  description = "Invoke ARN of the poll Gmail Lambda function"
  value       = aws_lambda_function.poll_gmail.invoke_arn
}

output "pull_latest_email_invoke_arn" {
  description = "Invoke ARN of the pull latest email Lambda function"
  value       = aws_lambda_function.pull_latest_email.invoke_arn
} 