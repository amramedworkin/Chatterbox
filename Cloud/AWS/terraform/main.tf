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
    key     = "terraform.tfstate"
    region  = "us-east-1"
    profile = "cliadmin"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = "cliadmin"

  default_tags {
    tags = {
      Project     = "Chatterbox"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "Chatterbox Team"
      CostCenter  = "Chatterbox"
    }
  }
}

# Resource Group for Chatterbox resources
module "resource_group" {
  source = "./modules/resource-group"

  environment = var.environment
}

# VPC and Networking - REMOVED
# Using default VPC for simpler architecture

# DynamoDB
module "dynamodb" {
  source = "./modules/dynamodb"

  environment      = var.environment
  state_table_name = var.dynamodb_state_table_name
}

# S3
module "s3" {
  source = "./modules/s3"

  environment               = var.environment
  bucket_name               = var.s3_bucket_name
  backup_bucket_name        = var.s3_backup_bucket_name
  email_archive_bucket_name = var.s3_email_archive_bucket_name
  iam_role_arn              = module.iam.role_arn
}

# Secrets Manager
module "secrets_manager" {
  source = "./modules/secrets-manager"

  environment              = var.environment
  gmail_tokens_secret_name = var.secrets_gmail_tokens_name
}

# Parameter Store
module "parameter_store" {
  source = "./modules/parameter-store"

  environment = var.environment
  prefix      = var.parameter_store_prefix
}

# CloudWatch
module "cloudwatch" {
  source = "./modules/cloudwatch"

  environment         = var.environment
  log_group_name      = var.cloudwatch_log_group_name
  log_retention_days  = var.log_retention_days
  aws_region          = var.aws_region
  dynamodb_table_name = var.dynamodb_state_table_name
  s3_bucket_name      = var.s3_bucket_name
  alarm_actions       = []
}

# IAM
module "iam" {
  source = "./modules/iam"

  environment                 = var.environment
  dynamodb_table_arn          = module.dynamodb.table_arn
  s3_bucket_arn               = module.s3.bucket_arn
  s3_backup_bucket_arn        = module.s3.backup_bucket_arn
  s3_email_archive_bucket_arn = module.s3.email_archive_bucket_arn
  secrets_arns                = module.secrets_manager.secret_arns
  parameter_store_arn         = module.parameter_store.parameter_arn
  cloudwatch_log_group_arn    = module.cloudwatch.log_group_arn
}

# Lambda
module "lambda" {
  source = "./modules/lambda"

  environment                    = var.environment
  gmail_tokens_secret_name       = var.secrets_gmail_tokens_name
  google_credentials_secret_name = module.secrets_manager.google_credentials_secret_name
  email_storage_bucket           = var.s3_email_archive_bucket_name
  default_gmail_user             = "awsamram@gmail.com"
  iam_role_arn                   = module.iam.role_arn
  cloudwatch_log_group_arn       = module.cloudwatch.log_group_arn
}

# Email Processing
module "email_processing" {
  source = "./modules/email-processing"

  environment                    = var.environment
  gmail_tokens_secret_name       = var.secrets_gmail_tokens_name
  google_credentials_secret_name = module.secrets_manager.google_credentials_secret_name
  openai_api_key_secret_name     = "chatterbox/openai-api-key"
  parameter_store_prefix         = var.parameter_store_prefix
  secrets_arns                   = module.secrets_manager.secret_arns
  parameter_store_arn            = module.parameter_store.parameter_arn
}

# Outputs
output "resource_group_name" {
  description = "Chatterbox Resource Group Name"
  value       = module.resource_group.resource_group_name
}

output "resource_group_arn" {
  description = "Chatterbox Resource Group ARN"
  value       = module.resource_group.resource_group_arn
}

output "dynamodb_table_name" {
  description = "DynamoDB State Table Name"
  value       = module.dynamodb.table_name
}

output "s3_bucket_name" {
  description = "S3 Data Bucket Name"
  value       = module.s3.bucket_name
}

output "s3_backup_bucket_name" {
  description = "S3 Backup Bucket Name"
  value       = module.s3.backup_bucket_name
}

output "secrets_gmail_tokens_name" {
  description = "Secrets Manager Gmail Tokens Secret Name"
  value       = module.secrets_manager.gmail_tokens_secret_name
}

output "parameter_store_prefix" {
  description = "Parameter Store Prefix"
  value       = module.parameter_store.prefix
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch Log Group Name"
  value       = module.cloudwatch.log_group_name
}

output "iam_role_arn" {
  description = "IAM Role ARN"
  value       = module.iam.role_arn
}

output "lambda_function_name" {
  description = "Lambda Function Name"
  value       = module.lambda.function_name
}

output "lambda_function_arn" {
  description = "Lambda Function ARN"
  value       = module.lambda.function_arn
}

output "api_gateway_id" {
  description = "API Gateway ID"
  value       = module.lambda.api_gateway_id
}

output "lambda_role_arn" {
  description = "Lambda IAM Role ARN"
  value       = module.lambda.lambda_role_arn
}

output "environment" {
  description = "Current environment"
  value       = var.environment
}

# Email Processing Outputs
output "email_queries_table_name" {
  description = "Email Queries DynamoDB Table Name"
  value       = module.email_processing.email_queries_table_name
}

output "conversations_table_name" {
  description = "Conversations DynamoDB Table Name"
  value       = module.email_processing.conversations_table_name
}

output "generated_responses_table_name" {
  description = "Generated Responses DynamoDB Table Name"
  value       = module.email_processing.generated_responses_table_name
}

output "response_generation_queue_url" {
  description = "Response Generation SQS Queue URL"
  value       = module.email_processing.response_generation_queue_url
}

output "email_processor_function_name" {
  description = "Email Processor Lambda Function Name"
  value       = module.email_processing.email_processor_function_name
}

output "response_generator_function_name" {
  description = "Response Generator Lambda Function Name"
  value       = module.email_processing.response_generator_function_name
} 