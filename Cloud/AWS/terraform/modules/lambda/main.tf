# Lambda function for pulling latest Chatterbox email
resource "aws_lambda_function" "pull_latest_chatterbox_email" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.environment}-pull-latest-chatterbox-email"
  role            = var.iam_role_arn
  handler         = "pullLatestChatterboxEmail.handler"
  runtime         = "nodejs18.x"
  timeout         = 30
  memory_size     = 256

  environment {
    variables = {
      GMAIL_TOKENS_SECRET_NAME        = var.gmail_tokens_secret_name
      GOOGLE_CREDENTIALS_SECRET_NAME  = var.google_credentials_secret_name
      EMAIL_STORAGE_BUCKET            = var.email_storage_bucket
      DEFAULT_GMAIL_USER              = var.default_gmail_user
    }
  }

  tags = {
    Name = "${var.environment}-pull-latest-chatterbox-email"
  }
}

# Create ZIP file for Lambda deployment
data "archive_file" "lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/lambda.zip"
  source_dir  = "${path.module}/lambda"
}

# API Gateway REST API
resource "aws_api_gateway_rest_api" "chatterbox_api" {
  name = "${var.environment}-chatterbox-api"

  tags = {
    Name = "${var.environment}-chatterbox-api"
  }
}

# API Gateway Resource
resource "aws_api_gateway_resource" "pull_email" {
  rest_api_id = aws_api_gateway_rest_api.chatterbox_api.id
  parent_id   = aws_api_gateway_rest_api.chatterbox_api.root_resource_id
  path_part   = "pull-latest-email"
}

# API Gateway Method
resource "aws_api_gateway_method" "pull_email_get" {
  rest_api_id   = aws_api_gateway_rest_api.chatterbox_api.id
  resource_id   = aws_api_gateway_resource.pull_email.id
  http_method   = "GET"
  authorization = "NONE"
}

# API Gateway Integration
resource "aws_api_gateway_integration" "lambda_integration" {
  rest_api_id = aws_api_gateway_rest_api.chatterbox_api.id
  resource_id = aws_api_gateway_resource.pull_email.id
  http_method = aws_api_gateway_method.pull_email_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.pull_latest_chatterbox_email.invoke_arn
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pull_latest_chatterbox_email.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.chatterbox_api.execution_arn}/*/*"
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "chatterbox_deployment" {
  depends_on = [
    aws_api_gateway_integration.lambda_integration,
  ]

  rest_api_id = aws_api_gateway_rest_api.chatterbox_api.id
  stage_name  = var.environment
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.pull_latest_chatterbox_email.function_name}"
  retention_in_days = 14

  tags = {
    Name = "${var.environment}-lambda-logs"
  }
}
