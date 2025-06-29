# Data sources for ARN construction
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# Parameter Store parameters for Chatterbox configuration
resource "aws_ssm_parameter" "app_config" {
  name = "${var.prefix}/app-config"
  type = "String"
  value = jsonencode({
    interactionsBaseFolder = "../interactions"
    defaultPollGmailUser   = "awsamram@gmail.com"
    defaultSendGmailUser   = "amram.dworkin@gmail.com"
    defaultGetGmailUser    = "awsamram@gmail.com"
  })

  tags = {
    Name        = "${var.environment}-chatterbox-app-config"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "configuration"
    ManagedBy   = "Terraform"
  }
}

resource "aws_ssm_parameter" "polling_config" {
  name = "${var.prefix}/polling-config"
  type = "String"
  value = jsonencode({
    defaultIntervalMinutes = 2.0
    defaultDurationMinutes = 60
  })

  tags = {
    Name        = "${var.environment}-chatterbox-polling-config"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "configuration"
    ManagedBy   = "Terraform"
  }
}

resource "aws_ssm_parameter" "openai_config" {
  name = "${var.prefix}/openai-config"
  type = "String"
  value = jsonencode({
    llmModel          = "gpt-4o"
    organizationId    = "org-jtUOS2ket5MKPTVgmcbv5mIP"
    maxResponseTokens = 10000
  })

  tags = {
    Name        = "${var.environment}-chatterbox-openai-config"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "openai"
    ManagedBy   = "Terraform"
  }
}

resource "aws_ssm_parameter" "google_config" {
  name = "${var.prefix}/google-config"
  type = "String"
  value = jsonencode({
    scopes = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send"
    ]
    redirectUri = "http://localhost:3000"
  })

  tags = {
    Name        = "${var.environment}-chatterbox-google-config"
    Project     = "Chatterbox"
    Environment = var.environment
    Subsystem   = "mail"
    ManagedBy   = "Terraform"
  }
} 