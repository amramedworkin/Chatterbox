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

# VPC and Networking
module "vpc" {
  source = "./modules/vpc"

  environment        = var.environment
  vpc_cidr_block     = var.vpc_cidr_block
  availability_zones = var.availability_zones
}

# DynamoDB
module "dynamodb" {
  source = "./modules/dynamodb"

  environment      = var.environment
  state_table_name = var.dynamodb_state_table_name
}

# S3
module "s3" {
  source = "./modules/s3"

  environment        = var.environment
  bucket_name        = var.s3_bucket_name
  backup_bucket_name = var.s3_backup_bucket_name
  iam_role_arn       = module.iam.role_arn
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

  environment        = var.environment
  log_group_name     = var.cloudwatch_log_group_name
  log_retention_days = var.log_retention_days
  aws_region         = var.aws_region
  dynamodb_table_name = var.dynamodb_state_table_name
  s3_bucket_name      = var.s3_bucket_name
  alarm_actions      = []
}

# IAM
module "iam" {
  source = "./modules/iam"

  environment              = var.environment
  dynamodb_table_arn       = module.dynamodb.table_arn
  s3_bucket_arn            = module.s3.bucket_arn
  s3_backup_bucket_arn     = module.s3.backup_bucket_arn
  secrets_arns             = module.secrets_manager.secret_arns
  parameter_store_arn      = module.parameter_store.parameter_arn
  cloudwatch_log_group_arn = module.cloudwatch.log_group_arn
}

# Lambda
module "lambda" {
  source = "./modules/lambda"

  environment  = var.environment
  secrets_arns = module.secrets_manager.secret_arns
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

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
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

output "environment" {
  description = "Current environment"
  value       = var.environment
}

output "lambda_function_arn" {
  description = "Lambda Function ARN"
  value       = module.lambda.function_arn
}

output "lambda_function_name" {
  description = "Lambda Function Name"
  value       = module.lambda.function_name
}

output "api_gateway_url" {
  description = "API Gateway URL"
  value       = module.lambda.api_gateway_url
}

output "api_gateway_id" {
  description = "API Gateway ID"
  value       = module.lambda.api_gateway_id
}

output "lambda_role_arn" {
  description = "Lambda IAM Role ARN"
  value       = module.lambda.lambda_role_arn
} 