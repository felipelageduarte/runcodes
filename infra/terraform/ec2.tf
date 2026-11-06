# Servidor único: o rcc sobe containers irmãos e precisa do socket do Docker,
# então ECS/Fargate não serve. Tudo que importa vive no volume de dados.

data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

data "aws_caller_identity" "current" {}

# ---------------------------------------------------------------------------
# IAM da instância: SSM (acesso sem SSH), parâmetros do próprio caminho e backup
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "ec2_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instance" {
  name               = "${var.project}-instance"
  assume_role_policy = data.aws_iam_policy_document.ec2_trust.json
}

resource "aws_iam_role_policy_attachment" "instance_ssm" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "instance_cwagent" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

data "aws_iam_policy_document" "instance" {
  statement {
    sid     = "ReadWriteOwnParameters"
    actions = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath", "ssm:PutParameter"]
    resources = [
      "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project}/*",
    ]
  }

  statement {
    sid       = "DecryptParametersViaSsm"
    actions   = ["kms:Decrypt", "kms:GenerateDataKey"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.region}.amazonaws.com"]
    }
  }

  statement {
    sid       = "BackupBucket"
    actions   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.backups.arn, "${aws_s3_bucket.backups.arn}/*"]
  }
}

resource "aws_iam_role_policy" "instance" {
  name   = "runcodes-instance"
  role   = aws_iam_role.instance.id
  policy = data.aws_iam_policy_document.instance.json
}

resource "aws_iam_instance_profile" "instance" {
  name = "${var.project}-instance"
  role = aws_iam_role.instance.name
}

# ---------------------------------------------------------------------------
# Instância, IP fixo e volume de dados
# ---------------------------------------------------------------------------

resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.al2023_arm64.value
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.instance.name
  ebs_optimized          = true
  monitoring             = false

  # Standard: sem cobrança surpresa por burst. Se o CPU credit balance acabar o
  # host desacelera e o alarme avisa; aí decide-se por subir o tipo.
  credit_specification {
    cpu_credits = "standard"
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2 # containers precisam alcançar o IMDS
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = var.root_volume_gb
    encrypted   = true
  }

  user_data = templatefile("${path.module}/userdata.sh.tftpl", {
    git_repo_url = var.git_repo_url
    project      = var.project
  })

  tags = { Name = "${var.project}-app" }

  lifecycle {
    # AMI nova e user_data mudam em silêncio; recriar a instância derruba o
    # serviço (ADR 009 do emboabaDuarte). Mudança de host é deliberada, via
    # `terraform apply -replace` com plan-guard liberado.
    ignore_changes = [ami, user_data]
  }
}

resource "aws_eip" "app" {
  domain = "vpc"

  tags = { Name = "${var.project}-app" }
}

resource "aws_eip_association" "app" {
  instance_id   = aws_instance.app.id
  allocation_id = aws_eip.app.id
}

resource "aws_ebs_volume" "data" {
  availability_zone = aws_instance.app.availability_zone
  size              = var.data_volume_gb
  type              = "gp3"
  encrypted         = true

  tags = {
    Name     = "${var.project}-data"
    Snapshot = "daily" # selecionado pela política DLM abaixo
  }

  # Sem prevent_destroy de propósito: o desligamento (infra/scripts/teardown.sh)
  # precisa destruir. A proteção em CI é o plan-guard (aws_ebs_volume é protegido).
}

resource "aws_volume_attachment" "data" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.app.id
}

# ---------------------------------------------------------------------------
# Snapshots diários do volume de dados (7 dias)
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "dlm_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["dlm.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "dlm" {
  name               = "${var.project}-dlm"
  assume_role_policy = data.aws_iam_policy_document.dlm_trust.json
}

resource "aws_iam_role_policy_attachment" "dlm" {
  role       = aws_iam_role.dlm.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSDataLifecycleManagerServiceRole"
}

resource "aws_dlm_lifecycle_policy" "data" {
  description        = "Snapshot diario do volume de dados do runcodes"
  execution_role_arn = aws_iam_role.dlm.arn
  state              = "ENABLED"

  policy_details {
    resource_types = ["VOLUME"]
    target_tags    = { Snapshot = "daily" }

    schedule {
      name = "diario-7d"

      create_rule {
        interval      = 24
        interval_unit = "HOURS"
        times         = ["06:00"]
      }

      retain_rule {
        count = 7
      }

      copy_tags = true
    }
  }
}
