terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Bucket e tabela de lock são exclusivos do runcodes e criados ANTES do
  # primeiro init por infra/scripts/bootstrap-state.sh (dependência circular:
  # não podem ser gerenciados por este próprio state).
  #
  # Para mover o runcodes de conta/região, troque estes valores (ou use
  # `terraform init -backend-config=...`) e siga infra/docs/segregacao.md.
  backend "s3" {
    bucket         = "runcodes-tfstate-220395825071"
    key            = "infra/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "runcodes-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Application = "runcodes"
      Environment = var.environment
      Project     = var.project
      ManagedBy   = "terraform"
    }
  }
}

# CloudFront gera métricas e health checks do Route53 só em us-east-1.
provider "aws" {
  alias  = "use1"
  region = "us-east-1"
}
