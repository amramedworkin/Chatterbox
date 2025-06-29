# IAM Role for Chatterbox Application
resource "aws_iam_role" "chatterbox_role" {
  name = "${var.environment}-chatterbox-role"

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
    Name        = "${var.environment}-chatterbox-role"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "core"
    ManagedBy   = "Terraform"
  }
}

# IAM Policy for DynamoDB Access
resource "aws_iam_policy" "dynamodb_policy" {
  name        = "${var.environment}-chatterbox-dynamodb-policy"
  description = "Policy for DynamoDB access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
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
          var.dynamodb_table_arn,
          "${var.dynamodb_table_arn}/index/*"
        ]
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-chatterbox-dynamodb-policy"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "database"
    ManagedBy   = "Terraform"
  }
}

# IAM Policy for S3 Access
resource "aws_iam_policy" "s3_policy" {
  name        = "${var.environment}-chatterbox-s3-policy"
  description = "Policy for S3 access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetBucketLocation",
          "s3:GetBucketPolicy",
          "s3:GetBucketVersioning",
          "s3:GetBucketEncryption",
          "s3:GetBucketPublicAccessBlock"
        ]
        Resource = [
          var.s3_bucket_arn,
          "${var.s3_bucket_arn}/*",
          var.s3_backup_bucket_arn,
          "${var.s3_backup_bucket_arn}/*",
          var.s3_email_archive_bucket_arn,
          "${var.s3_email_archive_bucket_arn}/*"
          "${var.s3_backup_bucket_arn}/*"
        ]
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-chatterbox-s3-policy"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "storage"
    ManagedBy   = "Terraform"
  }
}

# IAM Policy for Secrets Manager Access
resource "aws_iam_policy" "secrets_policy" {
  name        = "${var.environment}-chatterbox-secrets-policy"
  description = "Policy for Secrets Manager access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecret"
        ]
        Resource = var.secrets_arns
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-chatterbox-secrets-policy"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "security"
    ManagedBy   = "Terraform"
  }
}

# IAM Policy for Parameter Store Access
resource "aws_iam_policy" "parameter_store_policy" {
  name        = "${var.environment}-chatterbox-parameter-store-policy"
  description = "Policy for Parameter Store access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:PutParameter"
        ]
        Resource = var.parameter_store_arn
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-chatterbox-parameter-store-policy"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "configuration"
    ManagedBy   = "Terraform"
  }
}

# IAM Policy for CloudWatch Logs
resource "aws_iam_policy" "cloudwatch_policy" {
  name        = "${var.environment}-chatterbox-cloudwatch-policy"
  description = "Policy for CloudWatch Logs access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Resource = "${var.cloudwatch_log_group_arn}*"
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-chatterbox-cloudwatch-policy"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "monitoring"
    ManagedBy   = "Terraform"
  }
}

# Attach policies to role
resource "aws_iam_role_policy_attachment" "dynamodb_attachment" {
  role       = aws_iam_role.chatterbox_role.name
  policy_arn = aws_iam_policy.dynamodb_policy.arn
}

resource "aws_iam_role_policy_attachment" "s3_attachment" {
  role       = aws_iam_role.chatterbox_role.name
  policy_arn = aws_iam_policy.s3_policy.arn
}

resource "aws_iam_role_policy_attachment" "secrets_attachment" {
  role       = aws_iam_role.chatterbox_role.name
  policy_arn = aws_iam_policy.secrets_policy.arn
}

resource "aws_iam_role_policy_attachment" "parameter_store_attachment" {
  role       = aws_iam_role.chatterbox_role.name
  policy_arn = aws_iam_policy.parameter_store_policy.arn
}

resource "aws_iam_role_policy_attachment" "cloudwatch_attachment" {
  role       = aws_iam_role.chatterbox_role.name
  policy_arn = aws_iam_policy.cloudwatch_policy.arn
}

# Instance Profile
resource "aws_iam_instance_profile" "chatterbox_profile" {
  name = "${var.environment}-chatterbox-profile"
  role = aws_iam_role.chatterbox_role.name

  tags = {
    Name        = "${var.environment}-chatterbox-profile"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "core"
    ManagedBy   = "Terraform"
  }
} 