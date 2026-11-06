# VPC própria do runcodes: nenhuma dependência de rede de outro projeto.
# Uma subnet pública só (sem NAT, que custaria mais que a instância).
# O CIDR difere do 10.0.0.0/16 do emboabaDuarte para permitir peering se um dia
# precisar.

resource "aws_vpc" "main" {
  cidr_block           = "10.60.0.0/24"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.project}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "${var.project}-igw" }
}

resource "aws_subnet" "public" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.60.0.0/25"
  availability_zone = var.availability_zone

  # IP público vem do Elastic IP, não do auto-assign.
  map_public_ip_on_launch = false

  tags = { Name = "${var.project}-public" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.project}-public" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Fecha o security group padrão da VPC (boa prática CIS): nada usa o default.
resource "aws_default_security_group" "default" {
  vpc_id = aws_vpc.main.id
}

# Flow logs: custo desprezível neste volume e dá trilha para investigar incidente.
resource "aws_cloudwatch_log_group" "flow" {
  name              = "/aws/vpc/${var.project}-flow"
  retention_in_days = 365
}

data "aws_iam_policy_document" "flow_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "flow" {
  name               = "${var.project}-vpc-flow"
  assume_role_policy = data.aws_iam_policy_document.flow_trust.json
}

resource "aws_iam_role_policy" "flow" {
  name = "write-flow-logs"
  role = aws_iam_role.flow.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
      Resource = "${aws_cloudwatch_log_group.flow.arn}:*"
    }]
  })
}

resource "aws_flow_log" "main" {
  vpc_id          = aws_vpc.main.id
  traffic_type    = "REJECT"
  iam_role_arn    = aws_iam_role.flow.arn
  log_destination = aws_cloudwatch_log_group.flow.arn
}

# Só o CloudFront alcança a porta 80. Sem SSH: acesso administrativo por SSM.
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "app" {
  name        = "${var.project}-app"
  description = "runcodes: HTTP somente do CloudFront"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${var.project}-app" }
}

resource "aws_vpc_security_group_ingress_rule" "http_cloudfront" {
  security_group_id = aws_security_group.app.id
  description       = "HTTP do CloudFront (origin-facing)"
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.app.id
  description       = "Saida: pacotes, imagens, GitHub, SSM, SMTP"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}
