# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "main" {
  name              = var.log_group_name
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.environment}-chatterbox-logs"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "monitoring"
    ManagedBy   = "Terraform"
  }
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.environment}-chatterbox-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", var.dynamodb_table_name]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "DynamoDB Read Capacity Units"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/S3", "NumberOfObjects", "BucketName", var.s3_bucket_name]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "S3 Object Count"
        }
      }
    ]
  })
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "dynamodb_errors" {
  alarm_name          = "${var.environment}-chatterbox-dynamodb-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "DynamoDB errors"
  alarm_actions       = var.alarm_actions

  dimensions = {
    TableName = var.dynamodb_table_name
  }

  tags = {
    Name        = "${var.environment}-chatterbox-dynamodb-errors"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "monitoring"
    ManagedBy   = "Terraform"
  }
}

resource "aws_cloudwatch_metric_alarm" "s3_errors" {
  alarm_name          = "${var.environment}-chatterbox-s3-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/S3"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "S3 errors"
  alarm_actions       = var.alarm_actions

  dimensions = {
    BucketName = var.s3_bucket_name
  }

  tags = {
    Name        = "${var.environment}-chatterbox-s3-errors"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "monitoring"
    ManagedBy   = "Terraform"
  }
} 