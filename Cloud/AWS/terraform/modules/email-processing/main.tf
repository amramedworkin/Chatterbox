# Email Processing Module for Chatterbox
# Consolidates SQS, DynamoDB tables, Lambda functions, and related resources

# DynamoDB Tables for Email Processing
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

# SQS Queues
resource "aws_sqs_queue" "response_generation" {
  name = "chatterbox-response-generation"
  
  visibility_timeout_seconds = 300
  message_retention_seconds  = 1209600  # 14 days
  delay_seconds              = 0
  receive_wait_time_seconds  = 20
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.response_generation_dlq.arn
    maxReceiveCount     = 3
  })
  
  tags = {
    Name        = "chatterbox-response-generation"
    Subsystem   = "email-processing"
  }
}

resource "aws_sqs_queue" "response_generation_dlq" {
  name = "chatterbox-response-generation-dlq"
  
  message_retention_seconds = 1209600  # 14 days
  
  tags = {
    Name        = "chatterbox-response-generation-dlq"
    Subsystem   = "email-processing"
  }
}

# IAM Roles for Email Processing Lambda Functions
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

# IAM Policies for Email Processing
resource "aws_iam_policy" "email_processor_policy" {
  name = "chatterbox-email-processor-policy"
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
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.email_queries.arn,
          aws_dynamodb_table.conversations.arn,
          aws_dynamodb_table.generated_responses.arn,
          aws_dynamodb_table.query_records.arn,
          aws_dynamodb_table.user_profiles.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.response_generation.arn
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.secrets_arns
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = var.parameter_store_arn
      }
    ]
  })
}

resource "aws_iam_policy" "response_generator_policy" {
  name = "chatterbox-response-generator-policy"
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
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.email_queries.arn,
          aws_dynamodb_table.conversations.arn,
          aws_dynamodb_table.generated_responses.arn,
          aws_dynamodb_table.query_records.arn,
          aws_dynamodb_table.user_profiles.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.secrets_arns
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = var.parameter_store_arn
      }
    ]
  })
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
  filename      = data.archive_file.email_processor_zip.output_path
  function_name = "chatterbox-email-processor"
  role          = aws_iam_role.email_processor_lambda.arn
  handler       = "dist/emailProcessor.handler"
  runtime       = "nodejs18.x"
  timeout       = 300
  memory_size   = 512

  environment {
    variables = {
      GMAIL_TOKENS_SECRET_NAME = var.gmail_tokens_secret_name
      OPENAI_API_KEY_SECRET_NAME = var.openai_api_key_secret_name
      PARAMETER_STORE_PREFIX = var.parameter_store_prefix
    }
  }

  tags = {
    Name        = "chatterbox-email-processor"
    Subsystem   = "email-processing"
  }
}

resource "aws_lambda_function" "response_generator" {
  filename      = data.archive_file.response_generator_zip.output_path
  function_name = "chatterbox-response-generator"
  role          = aws_iam_role.response_generator_lambda.arn
  handler       = "dist/responseGenerator.handler"
  runtime       = "nodejs18.x"
  timeout       = 300
  memory_size   = 512

  environment {
    variables = {
      GMAIL_TOKENS_SECRET_NAME = var.gmail_tokens_secret_name
      OPENAI_API_KEY_SECRET_NAME = var.openai_api_key_secret_name
      PARAMETER_STORE_PREFIX = var.parameter_store_prefix
    }
  }

  tags = {
    Name        = "chatterbox-response-generator"
    Subsystem   = "email-processing"
  }
}

# Create ZIP files for Lambda deployment
data "archive_file" "email_processor_zip" {
  type        = "zip"
  output_path = "${path.module}/email-processor.zip"
  source_dir  = "${path.module}/lambda"
}

data "archive_file" "response_generator_zip" {
  type        = "zip"
  output_path = "${path.module}/response-generator.zip"
  source_dir  = "${path.module}/lambda"
}

# SQS Event Source Mapping
resource "aws_lambda_event_source_mapping" "response_generator_sqs" {
  event_source_arn = aws_sqs_queue.response_generation.arn
  function_name    = aws_lambda_function.response_generator.function_name
  batch_size       = 1
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

# SSM Parameters for Email Processing
resource "aws_ssm_parameter" "default_model" {
  name  = "${var.parameter_store_prefix}/llm/default-model"
  type  = "String"
  value = "gpt-4o"
  
  tags = {
    Name        = "chatterbox-default-model"
    Subsystem   = "email-processing"
  }
}

resource "aws_ssm_parameter" "free_tier_limit" {
  name  = "${var.parameter_store_prefix}/billing/free-tier-limit"
  type  = "String"
  value = "100"
  
  tags = {
    Name        = "chatterbox-free-tier-limit"
    Subsystem   = "email-processing"
  }
}

resource "aws_ssm_parameter" "infrastructure_cost" {
  name  = "${var.parameter_store_prefix}/billing/infrastructure-cost"
  type  = "String"
  value = "0.50"
  
  tags = {
    Name        = "chatterbox-infrastructure-cost"
    Subsystem   = "email-processing"
  }
}

resource "aws_ssm_parameter" "licensing_cost" {
  name  = "${var.parameter_store_prefix}/billing/licensing-cost"
  type  = "String"
  value = "0.25"
  
  tags = {
    Name        = "chatterbox-licensing-cost"
    Subsystem   = "email-processing"
  }
}

resource "aws_ssm_parameter" "rejection_rate_limit" {
  name  = "${var.parameter_store_prefix}/email/rejection-rate-limit"
  type  = "String"
  value = "0.1"
  
  tags = {
    Name        = "chatterbox-rejection-rate-limit"
    Subsystem   = "email-processing"
  }
} 