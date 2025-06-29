# Lambda function for email reading
resource "aws_lambda_function" "email_reader" {
  filename      = data.archive_file.lambda_zip.output_path
  function_name = "${var.environment}-chatterbox-email-reader"
  role          = aws_iam_role.lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30
  memory_size   = 512

  environment {
    variables = {
      ENVIRONMENT = var.environment
      LOG_LEVEL   = "INFO"
    }
  }

  tags = {
    Name        = "${var.environment}-chatterbox-email-reader"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "mail"
    ManagedBy   = "Terraform"
  }
}

# Create ZIP file for Lambda deployment
data "archive_file" "lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/lambda.zip"
  source_dir  = "${path.module}/lambda"
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
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "mail"
    ManagedBy   = "Terraform"
  }
}

# IAM Policy for Lambda execution
resource "aws_iam_policy" "lambda_execution_policy" {
  name        = "${var.environment}-chatterbox-lambda-execution-policy"
  description = "Policy for Lambda execution"

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
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-chatterbox-lambda-execution-policy"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "mail"
    ManagedBy   = "Terraform"
  }
}

# IAM Policy for Gmail access (via Secrets Manager)
resource "aws_iam_policy" "lambda_gmail_policy" {
  name        = "${var.environment}-chatterbox-lambda-gmail-policy"
  description = "Policy for Gmail access via Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.secrets_arns
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-chatterbox-lambda-gmail-policy"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "mail"
    ManagedBy   = "Terraform"
  }
}

# Attach policies to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_execution_attachment" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_execution_policy.arn
}

resource "aws_iam_role_policy_attachment" "lambda_gmail_attachment" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_gmail_policy.arn
}

# API Gateway HTTP API
resource "aws_apigatewayv2_api" "email_api" {
  name          = "${var.environment}-chatterbox-email-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["*"]
  }

  tags = {
    Name        = "${var.environment}-chatterbox-email-api"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "mail"
    ManagedBy   = "Terraform"
  }
}

# API Gateway stage
resource "aws_apigatewayv2_stage" "email_api_stage" {
  api_id      = aws_apigatewayv2_api.email_api.id
  name        = "$default"
  auto_deploy = true
}

# API Gateway integration
resource "aws_apigatewayv2_integration" "email_api_integration" {
  api_id           = aws_apigatewayv2_api.email_api.id
  integration_type = "AWS_PROXY"

  integration_uri    = aws_lambda_function.email_reader.invoke_arn
  integration_method = "POST"
}

# API Gateway route
resource "aws_apigatewayv2_route" "email_api_route" {
  api_id    = aws_apigatewayv2_api.email_api.id
  route_key = "GET /email/{gmailId}"
  target    = "integrations/${aws_apigatewayv2_integration.email_api_integration.id}"
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.email_reader.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.email_api.execution_arn}/*/*"
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.email_reader.function_name}"
  retention_in_days = 14

  tags = {
    Name        = "${var.environment}-chatterbox-lambda-logs"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "mail"
    ManagedBy   = "Terraform"
  }
} 