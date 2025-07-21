# Cloud/AWS/terraform-email-processing/outputs.tf
# Outputs for AWS-native email processing infrastructure

output "email_processor_lambda_arn" {
  description = "ARN of the email processor Lambda function"
  value       = aws_lambda_function.email_processor.arn
}

output "email_processor_lambda_name" {
  description = "Name of the email processor Lambda function"
  value       = aws_lambda_function.email_processor.function_name
}

output "response_generator_lambda_arn" {
  description = "ARN of the response generator Lambda function"
  value       = aws_lambda_function.response_generator.arn
}

output "response_generator_lambda_name" {
  description = "Name of the response generator Lambda function"
  value       = aws_lambda_function.response_generator.function_name
}

output "email_queries_table_name" {
  description = "Name of the email queries DynamoDB table"
  value       = aws_dynamodb_table.email_queries.name
}

output "email_queries_table_arn" {
  description = "ARN of the email queries DynamoDB table"
  value       = aws_dynamodb_table.email_queries.arn
}

output "conversations_table_name" {
  description = "Name of the conversations DynamoDB table"
  value       = aws_dynamodb_table.conversations.name
}

output "conversations_table_arn" {
  description = "ARN of the conversations DynamoDB table"
  value       = aws_dynamodb_table.conversations.arn
}

output "generated_responses_table_name" {
  description = "Name of the generated responses DynamoDB table"
  value       = aws_dynamodb_table.generated_responses.name
}

output "generated_responses_table_arn" {
  description = "ARN of the generated responses DynamoDB table"
  value       = aws_dynamodb_table.generated_responses.arn
}

output "query_records_table_name" {
  description = "Name of the query records DynamoDB table"
  value       = aws_dynamodb_table.query_records.name
}

output "query_records_table_arn" {
  description = "ARN of the query records DynamoDB table"
  value       = aws_dynamodb_table.query_records.arn
}

output "user_profiles_table_name" {
  description = "Name of the user profiles DynamoDB table"
  value       = aws_dynamodb_table.user_profiles.name
}

output "user_profiles_table_arn" {
  description = "ARN of the user profiles DynamoDB table"
  value       = aws_dynamodb_table.user_profiles.arn
}

output "attachments_bucket_name" {
  description = "Name of the attachments S3 bucket"
  value       = aws_s3_bucket.attachments.bucket
}

output "attachments_bucket_arn" {
  description = "ARN of the attachments S3 bucket"
  value       = aws_s3_bucket.attachments.arn
}

output "email_content_bucket_name" {
  description = "Name of the email content S3 bucket"
  value       = aws_s3_bucket.email_content.bucket
}

output "email_content_bucket_arn" {
  description = "ARN of the email content S3 bucket"
  value       = aws_s3_bucket.email_content.arn
}

output "response_generation_queue_url" {
  description = "URL of the response generation SQS queue"
  value       = aws_sqs_queue.response_generation.url
}

output "response_generation_queue_arn" {
  description = "ARN of the response generation SQS queue"
  value       = aws_sqs_queue.response_generation.arn
}

output "response_generation_dlq_url" {
  description = "URL of the response generation DLQ"
  value       = aws_sqs_queue.response_generation_dlq.url
}

output "response_generation_dlq_arn" {
  description = "ARN of the response generation DLQ"
  value       = aws_sqs_queue.response_generation_dlq.arn
}

output "email_processor_role_arn" {
  description = "ARN of the email processor Lambda IAM role"
  value       = aws_iam_role.email_processor_lambda.arn
}

output "response_generator_role_arn" {
  description = "ARN of the response generator Lambda IAM role"
  value       = aws_iam_role.response_generator_lambda.arn
}

output "email_processor_log_group_name" {
  description = "Name of the email processor CloudWatch log group"
  value       = aws_cloudwatch_log_group.email_processor.name
}

output "response_generator_log_group_name" {
  description = "Name of the response generator CloudWatch log group"
  value       = aws_cloudwatch_log_group.response_generator.name
}

output "default_model_parameter_arn" {
  description = "ARN of the default model SSM parameter"
  value       = aws_ssm_parameter.default_model.arn
}

output "free_tier_limit_parameter_arn" {
  description = "ARN of the free tier limit SSM parameter"
  value       = aws_ssm_parameter.free_tier_limit.arn
}

output "infrastructure_cost_parameter_arn" {
  description = "ARN of the infrastructure cost SSM parameter"
  value       = aws_ssm_parameter.infrastructure_cost.arn
}

output "licensing_cost_parameter_arn" {
  description = "ARN of the licensing cost SSM parameter"
  value       = aws_ssm_parameter.licensing_cost.arn
}

output "rejection_rate_limit_parameter_arn" {
  description = "ARN of the rejection rate limit SSM parameter"
  value       = aws_ssm_parameter.rejection_rate_limit.arn
}

output "architecture_summary" {
  description = "Summary of the AWS-native email processing architecture"
  value = {
    description = "AWS-native email processing system leveraging serverless services"
    components = {
      lambda_functions = [
        "Email Processor - Processes incoming emails from S3 events",
        "Response Generator - Generates LLM responses from SQS messages"
      ]
      databases = [
        "Email Queries - Stores email query metadata and status",
        "Conversations - Stores conversation history and context",
        "Generated Responses - Stores LLM responses and metadata",
        "Query Records - Stores billing and analytics data",
        "User Profiles - Stores user preferences and subscription info"
      ]
      storage = [
        "Attachments Bucket - Stores email attachments",
        "Email Content Bucket - Stores email content for processing"
      ]
      messaging = [
        "Response Generation Queue - Queues queries for LLM processing"
      ]
      monitoring = [
        "CloudWatch Log Groups - Centralized logging for Lambda functions"
      ]
      configuration = [
        "Parameter Store - Configuration parameters for the system"
      ]
    }
    event_flow = [
      "1. Email content uploaded to S3 → Triggers Email Processor Lambda",
      "2. Email Processor validates and stores query → Sends to SQS",
      "3. SQS message triggers Response Generator Lambda",
      "4. Response Generator calls OpenAI API → Stores response → Sends email"
    ]
    native_aws_services = [
      "Lambda - Serverless compute",
      "DynamoDB - NoSQL database",
      "S3 - Object storage",
      "SQS - Message queuing",
      "SES - Email sending",
      "Secrets Manager - Secure credential storage",
      "Parameter Store - Configuration management",
      "CloudWatch - Monitoring and logging",
      "IAM - Access control"
    ]
  }
} 