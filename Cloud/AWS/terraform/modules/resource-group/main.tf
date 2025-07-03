# AWS Resource Group for Chatterbox
resource "aws_resourcegroups_group" "chatterbox" {
  name = "${var.environment}-chatterbox-resources"

  resource_query {
    query = jsonencode({
      ResourceTypeFilters = [
        "AWS::S3::Bucket",
        "AWS::DynamoDB::Table",
        "AWS::Lambda::Function",
        "AWS::ApiGateway::RestApi",
        "AWS::SecretsManager::Secret",
        "AWS::SSM::Parameter",
        "AWS::CloudWatch::LogGroup",
        "AWS::CloudWatch::Alarm",
        "AWS::EC2::VPC",
        "AWS::EC2::Subnet",
        "AWS::EC2::RouteTable",
        "AWS::EC2::InternetGateway",
        "AWS::EC2::NatGateway"
      ]
      TagFilters = [
        {
          Key    = "Project"
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
    Name        = "${var.environment}-chatterbox-resource-group"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "core"
    ManagedBy   = "Terraform"
  }
}

# Outputs
output "resource_group_name" {
  description = "Name of the Chatterbox resource group"
  value       = aws_resourcegroups_group.chatterbox.name
}

output "resource_group_arn" {
  description = "ARN of the Chatterbox resource group"
  value       = aws_resourcegroups_group.chatterbox.arn
} 