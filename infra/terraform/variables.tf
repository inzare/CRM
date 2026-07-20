variable "project" {

  type    = string
  default = "consultflow"

}
variable "environment" {

  type    = string
  default = "production"

}
variable "aws_region" {

  type    = string
  default = "us-east-1"

}
variable "vpc_cidr" {

  type    = string
  default = "10.42.0.0/16"

}
variable "availability_zones" {

  type    = list(string)
  default = ["us-east-1a", "us-east-1b"]
  validation {

    condition     = length(var.availability_zones) >= 2
    error_message = "At least two availability zones are required."

  }

}
variable "api_image" {

  type        = string
  description = "Immutable API image URI including digest or tag."

}
variable "db_instance_class" {

  type    = string
  default = "db.t4g.micro"

}
variable "db_name" {

  type    = string
  default = "consultflow"

}
variable "db_username" {

  type      = string
  default   = "consultflow"
  sensitive = true

}
variable "desired_count" {

  type    = number
  default = 2

}
variable "certificate_arn" {

  type        = string
  default     = ""
  description = "ACM certificate in the workload region for the API ALB."

}
variable "cloudfront_certificate_arn" {

  type        = string
  default     = ""
  description = "ACM certificate in us-east-1 for CloudFront."

}
variable "api_domain" {

  type    = string
  default = ""

}
variable "frontend_domain" {

  type    = string
  default = ""

}
variable "cors_origins" {

  type        = string
  description = "Comma-separated HTTPS frontend origins."

}
variable "email_from" {

  type = string

}
variable "app_timezone" {

  type    = string
  default = "America/Mexico_City"

}
variable "enable_nat_gateway" {

  type        = bool
  default     = true
  description = "Set false only when equivalent VPC endpoints/egress are supplied."

}

