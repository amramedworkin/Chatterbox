output "bucket_name" {
  description = "S3 data bucket name"
  value       = aws_s3_bucket.data.bucket
}

output "bucket_arn" {
  description = "S3 data bucket ARN"
  value       = aws_s3_bucket.data.arn
}

output "backup_bucket_name" {
  description = "S3 backup bucket name"
  value       = aws_s3_bucket.backup.bucket
}

output "backup_bucket_arn" {
  description = "S3 backup bucket ARN"
  value       = aws_s3_bucket.backup.arn
} 