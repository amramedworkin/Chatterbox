variable "environment" {
  description = "Environment name"
  type        = string
}

variable "bucket_name" {
  description = "Name of the S3 bucket for data storage"
  type        = string
}

variable "backup_bucket_name" {
  description = "Name of the S3 bucket for backups"
  type        = string
} 