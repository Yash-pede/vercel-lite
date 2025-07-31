####################################
# 1. AWS Provider
####################################
provider "aws" {
  region     = "ap-south-1"
}

# Get the default VPC in the current region
data "aws_vpc" "default" {
  default = true
}

# Get the subnets associated with the default VPC
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}


####################################
# 2. S3 Bucket - Public Read for Hosting Static Sites
####################################
resource "aws_s3_bucket" "vercel_lite_bucket" {
  bucket = "vercel-lite"
  tags = {
    Name        = "vercel-lite"
    Environment = "Production"
  }
}

resource "aws_s3_bucket_ownership_controls" "vercel_lite_bucket_ownership_controls" {
  bucket = aws_s3_bucket.vercel_lite_bucket.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_public_access_block" "unblock_public" {
  bucket                  = aws_s3_bucket.vercel_lite_bucket.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_acl" "vercel_lite_bucket_acl" {
  depends_on = [
    aws_s3_bucket_ownership_controls.vercel_lite_bucket_ownership_controls,
    aws_s3_bucket_public_access_block.unblock_public,
  ]
  bucket = aws_s3_bucket.vercel_lite_bucket.id
  acl    = "public-read"
}

resource "aws_s3_bucket_policy" "allow_public_read" {
  bucket = aws_s3_bucket.vercel_lite_bucket.id
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "${aws_s3_bucket.vercel_lite_bucket.arn}/*"
    }
  ]
}
EOF
}


####################################
# 3. ECR Repository for Docker Images
####################################
resource "aws_ecr_repository" "build_server_repo" {
  name = "build-server"
  tags = {
    Name        = "build-server"
    Environment = "Production"
  }
}

resource "aws_ecr_repository" "nginx_reverse_proxy_repo" {
  name = "nginx-reverse-proxy"
  tags = {
    Name        = "nginx-reverse-proxy"
    Environment = "Production"
  }
}

####################################
# 4. ECS Cluster
####################################
resource "aws_ecs_cluster" "build_server_cluster" {
  name = "build-server-cluster"
}


####################################
# 5. IAM Roles and Policies
####################################

# 5a. Assume Role Policy Document for ECS Task Roles
data "aws_iam_policy_document" "ecs_task_assume_role_policy" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

# 5b. Task Role - role used by your app inside container (access S3 etc.)
resource "aws_iam_role" "build_server_task_role" {
  name               = "build-server-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume_role_policy.json
}

resource "aws_iam_role_policy" "build_server_task_s3_policy" {
  name = "build-server-task-s3-policy"
  role = aws_iam_role.build_server_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.vercel_lite_bucket.arn,
          "${aws_s3_bucket.vercel_lite_bucket.arn}/*"
        ]
      }
    ]
  })
}

# 5c. Execution Role - used by ECS infrastructure to pull images and send logs
resource "aws_iam_role" "ecs_task_execution_role" {
  name               = "ecs-task-execution-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume_role_policy.json
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy_attachment" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}


####################################
# 6. CloudWatch Log Group for ECS (optional but recommended)
####################################
resource "aws_cloudwatch_log_group" "ecs_log_group" {
  name              = "/ecs/build-server"
  retention_in_days = 7
}


####################################
# 7. ECS Task Definition (Fargate)
####################################
resource "aws_ecs_task_definition" "build_server_task" {
  family                   = "build-server-task"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn # ECS infra pulls images
  task_role_arn            = aws_iam_role.build_server_task_role.arn  # Your app's AWS permissions

  container_definitions = jsonencode([
    {
      name      = "build-server-container"
      image     = "${aws_ecr_repository.build_server_repo.repository_url}:latest"
      essential = true

      # environment = [ # Example env vars; add what you need here or pass overrides
      #   { name = "S3_BUCKET_NAME", value = aws_s3_bucket.vercel_lite_bucket.bucket },
      # ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs_log_group.name
          awslogs-region        = "ap-south-1"
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
}


####################################
# 7. ALB for NGINX Reverse Proxy
####################################

module "alb" {
  source  = "terraform-aws-modules/alb/aws"
  version = "9.17.0"

  name    = "nginx-reverse-proxy"
  vpc_id  = data.aws_vpc.default.id
  subnets = data.aws_subnets.default.ids

  # Security Group
  security_group_ingress_rules = {
    all_http = {
      from_port   = 80
      to_port     = 80
      ip_protocol = "tcp"
      description = "HTTP web traffic"
      cidr_ipv4   = "0.0.0.0/0"
    }
  }
  security_group_egress_rules = {
    all = {
      ip_protocol = "-1"
      cidr_ipv4   = "0.0.0.0/0"
      description = "Allow all outbound traffic"
    }
  }

  listeners = {
    ex-http-https-redirect = {
      port     = 80
      protocol = "HTTP"
      forward  = { target_group_key = "ex-instance" }
    }

  }

  target_groups = {
    ex-instance = {
      protocol                          = "HTTP"
      port                              = 80
      target_type                       = "ip"
      deregistration_delay              = 5
      load_balancing_cross_zone_enabled = true
      create_attachment                 = false
    }
  }

  tags = {
    Environment = "Production"
    Project     = "Nginx Reverse Proxy"
  }
}

resource "aws_ecs_task_definition" "nginx_task" {
  family                   = "nginx-reverse-proxy-task"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([{
    name      = "nginx"
    image     = "${aws_ecr_repository.nginx_reverse_proxy_repo.repository_url}:latest" # Or your custom nginx image if you have one
    essential = true
    portMappings = [{
      containerPort = 80
      protocol      = "tcp"
      hostPort      = 80
    }]
  }])
}

resource "aws_ecs_service" "nginx_service" {
  name            = "nginx-service"
  cluster         = aws_ecs_cluster.build_server_cluster.id
  task_definition = aws_ecs_task_definition.nginx_task.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [module.alb.security_group_id] # Or create a dedicated SG that allows ALB traffic
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = module.alb.target_groups["ex-instance"].arn # Make sure to match your target group key
    container_name   = "nginx"
    container_port   = 80
  }

  depends_on = [
    module.alb,
  ]
}
