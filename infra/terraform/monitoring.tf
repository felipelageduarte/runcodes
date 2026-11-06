# Alertas desde o primeiro deploy. A inscrição SNS exige confirmar o e-mail
# (link enviado pela AWS no primeiro apply).

resource "aws_sns_topic" "alerts" {
  name              = "${var.project}-alerts"
  kms_master_key_id = "alias/aws/sns"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# SNS aceita publicação de CloudWatch, Budgets e Route53 health check.
data "aws_iam_policy_document" "alerts" {
  statement {
    sid       = "ServicosPublicam"
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.alerts.arn]
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com", "budgets.amazonaws.com"]
    }
  }
}

resource "aws_sns_topic_policy" "alerts" {
  arn    = aws_sns_topic.alerts.arn
  policy = data.aws_iam_policy_document.alerts.json
}

# Falha de hardware/host: a própria AWS recupera a instância.
resource "aws_cloudwatch_metric_alarm" "status_check" {
  alarm_name          = "${var.project}-status-check-failed"
  alarm_description   = "Instancia com falha de status check; recuperacao automatica acionada."
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_System"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "breaching"
  dimensions          = { InstanceId = aws_instance.app.id }
  alarm_actions       = [aws_sns_topic.alerts.arn, "arn:aws:automate:${var.region}:ec2:recover"]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "cpu_credits" {
  alarm_name          = "${var.project}-cpu-credits-low"
  alarm_description   = "Creditos de CPU acabando: host vai desacelerar. Considere subir o instance_type."
  namespace           = "AWS/EC2"
  metric_name         = "CPUCreditBalance"
  statistic           = "Minimum"
  period              = 300
  evaluation_periods  = 3
  threshold           = 20
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions          = { InstanceId = aws_instance.app.id }
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

# Métricas enviadas pelo CloudWatch Agent (config em infra/scripts/host-setup.sh).
resource "aws_cloudwatch_metric_alarm" "disk" {
  for_each = { data = "/data", root = "/" }

  alarm_name          = "${var.project}-disk-${each.key}-high"
  alarm_description   = "Disco ${each.value} acima de 80%."
  namespace           = "CWAgent"
  metric_name         = "disk_used_percent"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "breaching"
  dimensions = {
    InstanceId = aws_instance.app.id
    path       = each.value
    fstype     = "xfs" # o agente roda com drop_device=true: sem dimensao device
  }
  alarm_actions = [aws_sns_topic.alerts.arn]
}

# Backup diário (métrica emitida por infra/scripts/backup.sh). 26 horas seguidas
# sem sucesso, ou sem dado nenhum, dispara.
resource "aws_cloudwatch_metric_alarm" "backup" {
  alarm_name          = "${var.project}-backup-stale"
  alarm_description   = "Nenhum backup bem sucedido ha mais de 26h."
  namespace           = "Runcodes"
  metric_name         = "BackupSuccess"
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 26
  datapoints_to_alarm = 26
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "memory" {
  alarm_name          = "${var.project}-memory-high"
  alarm_description   = "Memoria acima de 90% (2 GB e apertado: considere t4g.medium)."
  namespace           = "CWAgent"
  metric_name         = "mem_used_percent"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 3
  threshold           = 90
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "breaching"
  dimensions          = { InstanceId = aws_instance.app.id }
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

# Saúde fim a fim: CloudFront -> Caddy -> API -> (Postgres via /api/health).
resource "aws_route53_health_check" "app" {
  fqdn              = aws_cloudfront_distribution.app.domain_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/api/health"
  request_interval  = 30
  failure_threshold = 3
  measure_latency   = false

  tags = { Name = "${var.project}-health" }
}

resource "aws_cloudwatch_metric_alarm" "health" {
  provider = aws.use1

  alarm_name          = "${var.project}-health-check-failed"
  alarm_description   = "GET /api/health falhando pelo CloudFront."
  namespace           = "AWS/Route53"
  metric_name         = "HealthCheckStatus"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  dimensions          = { HealthCheckId = aws_route53_health_check.app.id }
  alarm_actions       = [aws_sns_topic.alerts_use1.arn]
  ok_actions          = [aws_sns_topic.alerts_use1.arn]
}

# Alarmes de Route53 só existem em us-east-1; se var.region for outra, o tópico
# acima não serve. Este espelho garante o alarme em qualquer região.
resource "aws_sns_topic" "alerts_use1" {
  provider          = aws.use1
  name              = "${var.project}-alerts-use1"
  kms_master_key_id = "alias/aws/sns"
}

resource "aws_sns_topic_subscription" "email_use1" {
  provider  = aws.use1
  topic_arn = aws_sns_topic.alerts_use1.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

data "aws_iam_policy_document" "alerts_use1" {
  statement {
    sid       = "CloudWatchPublica"
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.alerts_use1.arn]
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }
  }
}

resource "aws_sns_topic_policy" "alerts_use1" {
  provider = aws.use1
  arn      = aws_sns_topic.alerts_use1.arn
  policy   = data.aws_iam_policy_document.alerts_use1.json
}

# 5xx na borda
resource "aws_cloudwatch_metric_alarm" "cf_5xx" {
  provider = aws.use1

  alarm_name          = "${var.project}-cloudfront-5xx"
  alarm_description   = "Taxa de 5xx no CloudFront acima de 5%."
  namespace           = "AWS/CloudFront"
  metric_name         = "5xxErrorRate"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 5
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions = {
    DistributionId = aws_cloudfront_distribution.app.id
    Region         = "Global"
  }
  alarm_actions = [aws_sns_topic.alerts_use1.arn]
}

# Orçamento por tag Project (a tag já está ativa como cost allocation tag).
resource "aws_budgets_budget" "monthly" {
  name         = "${var.project}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "TagKeyValue"
    values = [format("user:Project$%s", var.project)]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}
