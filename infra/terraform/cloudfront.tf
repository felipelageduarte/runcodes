# Borda: domínio padrão *.cloudfront.net (HTTPS sem certificado nem DNS).
# O Caddy na instância fala HTTP puro na porta 80, aberta só ao CloudFront
# (prefix list) e que exige o cabeçalho secreto X-Origin-Verify.
#
# Quando houver domínio próprio: ACM em us-east-1 + aliases + registro Route53
# (ver infra/docs/operacao.md, "Domínio próprio").

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

# Repassa cookies, cabeçalhos e query string ao origin (menos o Host, que o
# CloudFront troca pelo do origin).
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

data "aws_cloudfront_response_headers_policy" "security" {
  name = "Managed-SecurityHeadersPolicy"
}

resource "random_password" "origin_verify" {
  length  = 40
  special = false
}

resource "aws_cloudfront_distribution" "app" {
  enabled         = true
  is_ipv6_enabled = true
  http_version    = "http2and3"
  price_class     = "PriceClass_100"
  comment         = "${var.project} (${var.environment})"

  default_root_object = "index.html"

  origin {
    origin_id   = "app"
    domain_name = aws_eip.app.public_dns

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "http-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 60
      origin_keepalive_timeout = 30
    }

    custom_header {
      name  = "X-Origin-Verify"
      value = random_password.origin_verify.result
    }
  }

  # Estáticos com hash no nome (Vite): cache longo.
  ordered_cache_behavior {
    path_pattern               = "/assets/*"
    target_origin_id           = "app"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.optimized.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security.id
  }

  # Resto (SPA, /api, /docs): sem cache, tudo repassado.
  default_cache_behavior {
    target_origin_id           = "app"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# Valores que a instância lê no deploy (ver infra/scripts/remote-deploy.sh).
# Segredos da aplicação NÃO passam por aqui: a instância os gera e grava no SSM,
# então nunca entram no state do Terraform.
resource "aws_ssm_parameter" "public_url" {
  name  = "/${var.project}/prod/PUBLIC_URL"
  type  = "SecureString"
  value = "https://${aws_cloudfront_distribution.app.domain_name}"
}

resource "aws_ssm_parameter" "origin_verify" {
  name  = "/${var.project}/prod/ORIGIN_VERIFY"
  type  = "SecureString"
  value = random_password.origin_verify.result
}

resource "aws_ssm_parameter" "langs" {
  name  = "/${var.project}/prod/COMPILER_LANGS"
  type  = "SecureString"
  value = var.compiler_langs
}

resource "aws_ssm_parameter" "concurrency" {
  name  = "/${var.project}/prod/COMPILER_CONCURRENCY"
  type  = "SecureString"
  value = tostring(var.compiler_concurrency)
}

resource "aws_ssm_parameter" "backup_bucket" {
  name  = "/${var.project}/prod/BACKUP_BUCKET"
  type  = "SecureString"
  value = aws_s3_bucket.backups.bucket
}
