output "role_arn" {
  description = "IAM role ARN"
  value       = aws_iam_role.chatterbox_role.arn
}

output "role_name" {
  description = "IAM role name"
  value       = aws_iam_role.chatterbox_role.name
}

output "instance_profile_arn" {
  description = "IAM instance profile ARN"
  value       = aws_iam_instance_profile.chatterbox_profile.arn
}

output "instance_profile_name" {
  description = "IAM instance profile name"
  value       = aws_iam_instance_profile.chatterbox_profile.name
} 