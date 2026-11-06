variable "project" {
  description = "Prefixo de todos os recursos e valor da tag Project."
  type        = string
  default     = "runcodes"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "github_repo_subject" {
  description = "Prefixo do claim sub do OIDC do GitHub (repo tem immutable subject: owner@id/repo@id)."
  type        = string
  default     = "felipelageduarte@805982/runcodes@1420842838"
}

variable "git_repo_url" {
  description = "Repositório público clonado pela instância."
  type        = string
  default     = "https://github.com/felipelageduarte/runcodes.git"
}

variable "instance_type" {
  description = "Menor tipo viável (2 GB). Suba para t4g.medium se faltar memória."
  type        = string
  default     = "t4g.small"
}

variable "root_volume_gb" {
  type    = number
  default = 16
}

variable "data_volume_gb" {
  description = "Volume de dados: docker (imagens, Postgres, Seaweed) e workspaces de execução."
  type        = number
  default     = 40
}

variable "compiler_langs" {
  description = "Imagens de linguagem buildadas no host (cada uma ocupa disco)."
  type        = string
  default     = "c cpp python java"
}

variable "compiler_concurrency" {
  description = "Submissões executadas em paralelo."
  type        = number
  default     = 2
}

variable "alert_email" {
  description = "Recebe alarmes e alertas de orçamento (a inscrição SNS pede confirmação por e-mail)."
  type        = string
  default     = "felipelageduarte@gmail.com"
}

variable "monthly_budget_usd" {
  type    = number
  default = 40
}

variable "availability_zone" {
  type    = string
  default = "us-east-1a"
}
