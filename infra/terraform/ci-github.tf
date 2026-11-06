# CI/CD via GitHub Actions com OIDC (sem access keys). Mesmo desenho do
# emboabaDuarte: duas roles, trust restrito ao claim `sub`.
#
#   runcodes-github-deploy: AdministratorAccess, só workflow na main. Admin
#     porque o Terraform gerencia IAM, VPC, EC2, CloudFront etc.; qualquer
#     policy mais estreita quebra no primeiro recurso novo. Risco consciente:
#     o que está protegido é a main (ruleset: PR + checks + commits assinados).
#   runcodes-github-plan: ReadOnlyAccess, só workflow de pull_request.
#
# O provider OIDC do GitHub já existe nesta conta (criado por outro projeto):
# referenciado por data source; IAM rejeita um segundo para a mesma URL. Na
# conta nova da segregação, troque o data por um aws_iam_openid_connect_provider.
#
# O repo usa "immutable OIDC subject": o sub vem como
# repo:owner@id/repo@id:..., imune a rename/recreate. Fork não recebe id-token.

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "github_deploy_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo_subject}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name                 = "${var.project}-github-deploy"
  assume_role_policy   = data.aws_iam_policy_document.github_deploy_trust.json
  max_session_duration = 3600
}

resource "aws_iam_role_policy_attachment" "github_deploy_admin" {
  role       = aws_iam_role.github_deploy.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

data "aws_iam_policy_document" "github_plan_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo_subject}:pull_request"]
    }
  }
}

resource "aws_iam_role" "github_plan" {
  name                 = "${var.project}-github-plan"
  assume_role_policy   = data.aws_iam_policy_document.github_plan_trust.json
  max_session_duration = 3600
}

resource "aws_iam_role_policy_attachment" "github_plan_readonly" {
  role       = aws_iam_role.github_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}
