# Cloud/AWS/terraform-email-processing/main.tf
# AWS-native email processing infrastructure

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Product     = "Chatterbox"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "Chatterbox Team"
      CostCenter  = "Chatterbox"
      Architecture = "Email-Processing"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Resource Group for Email Processing
resource "aws_resourcegroups_group" "email_processing" {
  name = "${var.environment}-chatterbox-email-processing"

  resource_query {
    query = jsonencode({
      ResourceTypeFilters = [
        "AWS::S3::Bucket",
        "AWS::DynamoDB::Table",
        "AWS::Lambda::Function",
        "AWS::SQS::Queue",
        "AWS::SSM::Parameter",
        "AWS::Logs::LogGroup"
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
    Name        = "${var.environment}-chatterbox-email-processing-group"
    Product     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "email-processing"
    ManagedBy   = "Terraform"
  }
}

# DynamoDB Tables
resource "aws_dynamodb_table" "email_queries" {
  name           = "chatterbox-email-queries"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "queryId"
  
  attribute {
    name = "queryId"
    type = "S"
  }
  
  tags = {
    Name        = "chatterbox-email-queries"
    Subsystem   = "email-processing"
  }
}

resource "aws_dynamodb_table" "conversations" {
  name           = "chatterbox-conversations"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "conversationId"
  
  attribute {
    name = "conversationId"
    type = "S"
  }
  
  tags = {
    Name        = "chatterbox-conversations"
    Subsystem   = "email-processing"
  }
}

resource "aws_dynamodb_table" "generated_responses" {
  name           = "chatterbox-generated-responses"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "responseId"
  
  attribute {
    name = "responseId"
    type = "S"
  }
  
  tags = {
    Name        = "chatterbox-generated-responses"
    Subsystem   = "email-processing"
  }
}

resource "aws_dynamodb_table" "query_records" {
  name           = "chatterbox-query-records"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "queryId"
  range_key      = "userEmail"
  
  attribute {
    name = "queryId"
    type = "S"
  }
  
  attribute {
    name = "userEmail"
    type = "S"
  }
  
  tags = {
    Name        = "chatterbox-query-records"
    Subsystem   = "email-processing"
  }
}

resource "aws_dynamodb_table" "user_profiles" {
  name           = "chatterbox-user-profiles"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "userEmail"
  
  attribute {
    name = "userEmail"
    type = "S"
  }
  
  tags = {
    Name        = "chatterbox-user-profiles"
    Subsystem   = "email-processing"
  }
}

# S3 Buckets
resource "aws_s3_bucket" "attachments" {
  bucket = "chatterbox-attachments-${var.environment}-${random_string.bucket_suffix.result}"
  
  tags = {
    Name        = "chatterbox-attachments"
    Subsystem   = "email-processing"
  }
}

resource "aws_s3_bucket" "email_content" {
  bucket = "chatterbox-email-content-${var.environment}-${random_string.bucket_suffix.result}"
  
  tags = {
    Name        = "chatterbox-email-content"
    Subsystem   = "email-processing"
  }
}

# Random string for bucket names
resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "attachments" {
  bucket = aws_s3_bucket.attachments.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "email_content" {
  bucket = aws_s3_bucket.email_content.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket Lifecycle
resource "aws_s3_bucket_lifecycle_configuration" "attachments" {
  bucket = aws_s3_bucket.attachments.id
  
  rule {
    id     = "delete_old_attachments"
    status = "Enabled"
    filter {
      prefix = ""
    }
    expiration {
      days = 30
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "email_content" {
  bucket = aws_s3_bucket.email_content.id
  
  rule {
    id     = "delete_old_emails"
    status = "Enabled"
    filter {
      prefix = ""
    }
    expiration {
      days = 7
    }
  }
}

# SQS Queues
resource "aws_sqs_queue" "response_generation" {
  name                      = "chatterbox-response-generation"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 345600 # 4 days
  receive_wait_time_seconds = 20
  visibility_timeout_seconds = 300
  
  tags = {
    Name        = "chatterbox-response-generation"
    Subsystem   = "email-processing"
  }
}

resource "aws_sqs_queue" "response_generation_dlq" {
  name = "chatterbox-response-generation-dlq"
  
  tags = {
    Name        = "chatterbox-response-generation-dlq"
    Subsystem   = "email-processing"
  }
}

# IAM Roles
resource "aws_iam_role" "email_processor_lambda" {
  name = "chatterbox-email-processor-lambda-role"
  
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
    Name        = "chatterbox-email-processor-lambda-role"
    Subsystem   = "email-processing"
  }
}

resource "aws_iam_role" "response_generator_lambda" {
  name = "chatterbox-response-generator-lambda-role"
  
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
    Name        = "chatterbox-response-generator-lambda-role"
    Subsystem   = "email-processing"
  }
}

# IAM Policies
resource "aws_iam_policy" "email_processor_policy" {
  name = "chatterbox-email-processor-policy"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.email_queries.arn,
          aws_dynamodb_table.conversations.arn,
          aws_dynamodb_table.user_profiles.arn,
          aws_dynamodb_table.query_records.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.attachments.arn}/*",
          "${aws_s3_bucket.email_content.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage"
        ]
        Resource = aws_sqs_queue.response_generation.arn
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:chatterbox/openai-api-key*"
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter"
        ]
        Resource = [
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/chatterbox/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
      }
    ]
  })
  
  tags = {
    Name        = "chatterbox-email-processor-policy"
    Subsystem   = "email-processing"
  }
}

resource "aws_iam_policy" "response_generator_policy" {
  name = "chatterbox-response-generator-policy"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.email_queries.arn,
          aws_dynamodb_table.conversations.arn,
          aws_dynamodb_table.generated_responses.arn,
          aws_dynamodb_table.query_records.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = [
          "${aws_s3_bucket.attachments.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.response_generation.arn
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:chatterbox/openai-api-key*"
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter"
        ]
        Resource = [
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/chatterbox/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
      }
    ]
  })
  
  tags = {
    Name        = "chatterbox-response-generator-policy"
    Subsystem   = "email-processing"
  }
}

# Attach policies to roles
resource "aws_iam_role_policy_attachment" "email_processor_policy" {
  role       = aws_iam_role.email_processor_lambda.name
  policy_arn = aws_iam_policy.email_processor_policy.arn
}

resource "aws_iam_role_policy_attachment" "response_generator_policy" {
  role       = aws_iam_role.response_generator_lambda.name
  policy_arn = aws_iam_policy.response_generator_policy.arn
}

# Lambda Functions
resource "aws_lambda_function" "email_processor" {
  filename         = "email-processor.zip"
  function_name    = "chatterbox-email-processor"
  role            = aws_iam_role.email_processor_lambda.arn
  handler         = "emailProcessor.handler"
  runtime         = "nodejs18.x"
  timeout         = 300
  memory_size     = 512
  
  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }
  
  tags = {
    Name        = "chatterbox-email-processor"
    Subsystem   = "email-processing"
  }
}

resource "aws_lambda_function" "response_generator" {
  filename         = "response-generator.zip"
  function_name    = "chatterbox-response-generator"
  role            = aws_iam_role.response_generator_lambda.arn
  handler         = "responseGenerator.handler"
  runtime         = "nodejs18.x"
  timeout         = 300
  memory_size     = 1024
  
  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }
  
  tags = {
    Name        = "chatterbox-response-generator"
    Subsystem   = "email-processing"
  }
}

# S3 Event Notifications
resource "aws_s3_bucket_notification" "email_content_notification" {
  bucket = aws_s3_bucket.email_content.id
  
  lambda_function {
    lambda_function_arn = aws_lambda_function.email_processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "emails/"
    filter_suffix       = "metadata.json"
  }

  depends_on = [aws_lambda_permission.email_processor_s3]
}

# SQS Event Source Mapping
resource "aws_lambda_event_source_mapping" "response_generator_sqs" {
  event_source_arn = aws_sqs_queue.response_generation.arn
  function_name    = aws_lambda_function.response_generator.function_name
  batch_size       = 1
}

# Lambda Permissions
resource "aws_lambda_permission" "email_processor_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.email_processor.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.email_content.arn
}

# Parameter Store Parameters
resource "aws_ssm_parameter" "default_model" {
  name  = "/chatterbox/llm/default-model"
  type  = "String"
  value = "gpt-4o"
  
  tags = {
    Name        = "chatterbox-default-model"
    Subsystem   = "email-processing"
  }
}

resource "aws_ssm_parameter" "free_tier_limit" {
  name  = "/chatterbox/billing/free-tier-limit"
  type  = "String"
  value = "10"
  
  tags = {
    Name        = "chatterbox-free-tier-limit"
    Subsystem   = "email-processing"
  }
}

resource "aws_ssm_parameter" "infrastructure_cost" {
  name  = "/chatterbox/billing/infrastructure-cost"
  type  = "String"
  value = "0.01"
  
  tags = {
    Name        = "chatterbox-infrastructure-cost"
    Subsystem   = "email-processing"
  }
}

resource "aws_ssm_parameter" "licensing_cost" {
  name  = "/chatterbox/billing/licensing-cost"
  type  = "String"
  value = "0.005"
  
  tags = {
    Name        = "chatterbox-licensing-cost"
    Subsystem   = "email-processing"
  }
}

resource "aws_ssm_parameter" "rejection_rate_limit" {
  name  = "/chatterbox/email/rejection-rate-limit"
  type  = "String"
  value = "300"
  
  tags = {
    Name        = "chatterbox-rejection-rate-limit"
    Subsystem   = "email-processing"
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "email_processor" {
  name              = "/aws/lambda/${aws_lambda_function.email_processor.function_name}"
  retention_in_days = 14
  
  tags = {
    Name        = "chatterbox-email-processor-logs"
    Subsystem   = "email-processing"
  }
}

resource "aws_cloudwatch_log_group" "response_generator" {
  name              = "/aws/lambda/${aws_lambda_function.response_generator.function_name}"
  retention_in_days = 14
  
  tags = {
    Name        = "chatterbox-response-generator-logs"
    Subsystem   = "email-processing"
  }
} 