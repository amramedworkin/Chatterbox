terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "chatterbox-terraform-state-855581761117"
    key    = "terraform.tfstate"
    region = "us-east-1"
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
    }
  }
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
  
  environment         = var.environment
  bucket_name         = var.s3_bucket_name
  backup_bucket_name  = var.s3_backup_bucket_name
  iam_role_arn        = module.iam.role_arn
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
  
  environment    = var.environment
  log_group_name = var.cloudwatch_log_group_name
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

# Outputs
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