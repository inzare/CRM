data "aws_caller_identity" "current" {

}

resource "random_password" "db" {

  length           = 32
  special          = true
  override_special = "!#$%&*+-=?"

}

resource "random_password" "jwt" {

  length  = 64
  special = false

}

resource "random_password" "pepper" {

  length  = 64
  special = false

}
locals {

  name = "${var.project}-${var.environment}"
  tags = {

    Project     = var.project
    Environment = var.environment
    ManagedBy   = "Terraform"

  }

  public_cidrs  = [for i, _ in var.availability_zones : cidrsubnet(var.vpc_cidr, 8, i)]
  private_cidrs = [for i, _ in var.availability_zones : cidrsubnet(var.vpc_cidr, 8, i + 10)]

}

resource "aws_vpc" "main" {

  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = {

    Name = local.name

  }

}

resource "aws_internet_gateway" "main" {

  vpc_id = aws_vpc.main.id
  tags = {

    Name = local.name

  }

}

resource "aws_subnet" "public" {

  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  availability_zone       = var.availability_zones[count.index]
  cidr_block              = local.public_cidrs[count.index]
  map_public_ip_on_launch = true
  tags = {

    Name = "${local.name}-public-${count.index + 1}"

  }

}

resource "aws_subnet" "private" {

  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  availability_zone = var.availability_zones[count.index]
  cidr_block        = local.private_cidrs[count.index]
  tags = {

    Name = "${local.name}-private-${count.index + 1}"

  }

}

resource "aws_eip" "nat" {

  count      = var.enable_nat_gateway ? 1 : 0
  domain     = "vpc"
  depends_on = [aws_internet_gateway.main]

}

resource "aws_nat_gateway" "main" {

  count         = var.enable_nat_gateway ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id

}

resource "aws_route_table" "public" {

  vpc_id = aws_vpc.main.id
  route {

    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id

  }

}

resource "aws_route_table_association" "public" {

  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id

}

resource "aws_route_table" "private" {

  vpc_id = aws_vpc.main.id
  dynamic "route" {

    for_each = var.enable_nat_gateway ? [1] : []
    content {

      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = aws_nat_gateway.main[0].id

    }

  }

}

resource "aws_route_table_association" "private" {

  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id

}

resource "aws_security_group" "alb" {

  name   = "${local.name}-alb"
  vpc_id = aws_vpc.main.id
  ingress {

    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]

  }
  ingress {

    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]

  }
  egress {

    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]

  }

}

resource "aws_security_group" "api" {

  name   = "${local.name}-api"
  vpc_id = aws_vpc.main.id
  ingress {

    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]

  }
  egress {

    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]

  }

}

resource "aws_security_group" "db" {

  name   = "${local.name}-db"
  vpc_id = aws_vpc.main.id
  ingress {

    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]

  }
  egress {

    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]

  }

}

resource "aws_db_subnet_group" "main" {

  name       = local.name
  subnet_ids = aws_subnet.private[*].id

}

resource "aws_db_instance" "main" {

  identifier                   = local.name
  engine                       = "postgres"
  engine_version               = "17"
  instance_class               = var.db_instance_class
  allocated_storage            = 20
  max_allocated_storage        = 100
  storage_type                 = "gp3"
  storage_encrypted            = true
  db_name                      = var.db_name
  username                     = var.db_username
  password                     = random_password.db.result
  db_subnet_group_name         = aws_db_subnet_group.main.name
  vpc_security_group_ids       = [aws_security_group.db.id]
  publicly_accessible          = false
  multi_az                     = var.environment == "production"
  backup_retention_period      = 7
  deletion_protection          = var.environment == "production"
  skip_final_snapshot          = var.environment != "production"
  final_snapshot_identifier    = var.environment == "production" ? "${local.name}-final" : null
  performance_insights_enabled = true
  apply_immediately            = false

}

resource "aws_secretsmanager_secret" "app" {

  name                    = "${local.name}/app"
  recovery_window_in_days = 7

}

resource "aws_secretsmanager_secret_version" "app" {

  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({

    DATABASE_URL       = "postgresql://${var.db_username}:${urlencode(random_password.db.result)}@${aws_db_instance.main.address}:5432/${var.db_name}?schema=public"
    JWT_ACCESS_SECRET  = random_password.jwt.result
    JWT_REFRESH_PEPPER = random_password.pepper.result

    }

  )

}

resource "aws_ecr_repository" "api" {

  name                 = "${local.name}-api"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration {

    scan_on_push = true

  }
  encryption_configuration {

    encryption_type = "AES256"

  }

}

resource "aws_ecr_lifecycle_policy" "api" {

  repository = aws_ecr_repository.api.name
  policy = jsonencode({

    rules = [{

      rulePriority = 1
      description  = "Retain 30 images"
      selection = {

        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 30

      }

      action = {

        type = "expire"

      }

      }

    ]

    }

  )

}

resource "aws_cloudwatch_log_group" "api" {

  name              = "/ecs/${local.name}-api"
  retention_in_days = 30

}

resource "aws_ecs_cluster" "main" {

  name = local.name
  setting {

    name  = "containerInsights"
    value = "enabled"

  }

}

resource "aws_iam_role" "execution" {

  name = "${local.name}-execution"
  assume_role_policy = jsonencode({

    Version = "2012-10-17"
    Statement = [{

      Effect = "Allow"
      Principal = {

        Service = "ecs-tasks.amazonaws.com"

      }

      Action = "sts:AssumeRole"

      }

    ]

    }

  )

}

resource "aws_iam_role_policy_attachment" "execution" {

  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"

}

resource "aws_iam_role_policy" "secrets" {

  role = aws_iam_role.execution.id
  policy = jsonencode({

    Version = "2012-10-17"
    Statement = [{

      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.app.arn

      }

    ]

    }

  )

}

resource "aws_iam_role" "task" {

  name               = "${local.name}-task"
  assume_role_policy = aws_iam_role.execution.assume_role_policy

}

resource "aws_iam_role_policy" "task" {

  role = aws_iam_role.task.id
  policy = jsonencode({

    Version = "2012-10-17"
    Statement = [{

      Effect   = "Allow"
      Action   = ["ses:SendEmail"]
      Resource = "*"

      }

    ]

    }

  )

}

resource "aws_ecs_task_definition" "api" {

  family                   = "${local.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn
  container_definitions = jsonencode([{

    name      = "api"
    image     = var.api_image
    essential = true
    portMappings = [{

      containerPort = 3000
      protocol      = "tcp"

      }

    ]
    environment = [{

      name  = "NODE_ENV",
      value = "production"

      }

      , {

        name  = "PORT",
        value = "3000"

      }

      , {

        name  = "CORS_ORIGINS",
        value = var.cors_origins

      }

      , {

        name  = "EMAIL_PROVIDER",
        value = "ses"

      }

      , {

        name  = "EMAIL_FROM",
        value = var.email_from

      }

      , {

        name  = "APP_BASE_URL",
        value = "https://${var.frontend_domain}"

      }

      , {

        name  = "APP_TIMEZONE",
        value = var.app_timezone

      }

      , {

        name  = "AWS_REGION",
        value = var.aws_region

      }

      , {

        name  = "SWAGGER_ENABLED",
        value = "false"

      }

    ]
    secrets = [{

      name      = "DATABASE_URL",
      valueFrom = "${aws_secretsmanager_secret.app.arn}:DATABASE_URL::"

      }

      , {

        name      = "JWT_ACCESS_SECRET",
        valueFrom = "${aws_secretsmanager_secret.app.arn}:JWT_ACCESS_SECRET::"

      }

      , {

        name      = "JWT_REFRESH_PEPPER",
        valueFrom = "${aws_secretsmanager_secret.app.arn}:JWT_REFRESH_PEPPER::"

      }

    ]
    logConfiguration = {

      logDriver = "awslogs"
      options = {

        awslogs-group         = aws_cloudwatch_log_group.api.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "api"

      }

    }

    healthCheck = {

      command     = ["CMD-SHELL", "node -e \"fetch('http://localhost:3000/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 30

    }

    }

  ])

}

resource "aws_lb" "api" {

  name                       = substr("${local.name}-api", 0, 32)
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.alb.id]
  subnets                    = aws_subnet.public[*].id
  drop_invalid_header_fields = true

}

resource "aws_lb_target_group" "api" {

  name                 = substr("${local.name}-api", 0, 32)
  port                 = 3000
  protocol             = "HTTP"
  vpc_id               = aws_vpc.main.id
  target_type          = "ip"
  deregistration_delay = 30
  health_check {

    path                = "/api/v1/health/ready"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
    matcher             = "200"

  }

}

resource "aws_lb_listener" "http" {

  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"
  default_action {

    type = var.certificate_arn == "" ? "forward" : "redirect"
    dynamic "forward" {

      for_each = var.certificate_arn == "" ? [1] : []
      content {

        target_group {

          arn = aws_lb_target_group.api.arn

        }

      }

    }
    dynamic "redirect" {

      for_each = var.certificate_arn == "" ? [] : [1]
      content {

        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"

      }

    }

  }

}

resource "aws_lb_listener" "https" {

  count             = var.certificate_arn == "" ? 0 : 1
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn
  default_action {

    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn

  }

}

resource "aws_ecs_service" "api" {

  name                              = "${local.name}-api"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.api.arn
  desired_count                     = var.desired_count
  launch_type                       = "FARGATE"
  platform_version                  = "LATEST"
  health_check_grace_period_seconds = 60
  enable_execute_command            = true
  deployment_circuit_breaker {

    enable   = true
    rollback = true

  }
  network_configuration {

    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = false

  }
  load_balancer {

    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000

  }

  depends_on = [aws_lb_listener.http]
  lifecycle {

    ignore_changes = [desired_count]

  }

}

resource "aws_appautoscaling_target" "api" {

  max_capacity       = 8
  min_capacity       = var.desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"

}

resource "aws_appautoscaling_policy" "cpu" {

  name               = "${local.name}-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  target_tracking_scaling_policy_configuration {

    target_value = 60
    predefined_metric_specification {

      predefined_metric_type = "ECSServiceAverageCPUUtilization"

    }

    scale_in_cooldown  = 120
    scale_out_cooldown = 60

  }

}

resource "aws_cloudwatch_metric_alarm" "api_5xx" {

  alarm_name          = "${local.name}-api-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  dimensions = {

    LoadBalancer = aws_lb.api.arn_suffix

  }

  treat_missing_data = "notBreaching"

}

resource "aws_s3_bucket" "frontend" {

  bucket = "${local.name}-frontend-${data.aws_caller_identity.current.account_id}"

}

resource "aws_s3_bucket_versioning" "frontend" {

  bucket = aws_s3_bucket.frontend.id
  versioning_configuration {

    status = "Enabled"

  }

}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {

  bucket = aws_s3_bucket.frontend.id
  rule {

    apply_server_side_encryption_by_default {

      sse_algorithm = "AES256"

    }

  }

}

resource "aws_s3_bucket_public_access_block" "frontend" {

  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true

}

resource "aws_cloudfront_origin_access_control" "frontend" {

  name                              = local.name
  description                       = "ConsultFlow frontend OAC"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"

}

resource "aws_cloudfront_distribution" "frontend" {

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = var.frontend_domain == "" ? [] : [var.frontend_domain]
  origin {

    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id

  }
  default_cache_behavior {

    target_origin_id           = "frontend"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD", "OPTIONS"]
    compress                   = true
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6"
    response_headers_policy_id = "67f7725c-6f97-4210-82d7-5512b31e9d03"

  }
  custom_error_response {

    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0

  }
  custom_error_response {

    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0

  }
  restrictions {

    geo_restriction {

      restriction_type = "none"

    }

  }
  viewer_certificate {

    cloudfront_default_certificate = var.cloudfront_certificate_arn == ""
    acm_certificate_arn            = var.cloudfront_certificate_arn == "" ? null : var.cloudfront_certificate_arn
    ssl_support_method             = var.cloudfront_certificate_arn == "" ? null : "sni-only"
    minimum_protocol_version       = var.cloudfront_certificate_arn == "" ? "TLSv1" : "TLSv1.2_2021"

  }

}

resource "aws_s3_bucket_policy" "frontend" {

  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({

    Version = "2012-10-17"
    Statement = [{

      Sid    = "CloudFrontRead"
      Effect = "Allow"
      Principal = {

        Service = "cloudfront.amazonaws.com"

      }

      Action   = "s3:GetObject"
      Resource = "${aws_s3_bucket.frontend.arn}/*"
      Condition = {

        StringEquals = {

          "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn

        }

      }

      }

    ]

    }

  )

}

