# Terraform Provider for Infra Pilot

The Infra Pilot Terraform provider allows you to manage infrastructure resources
such as servers, databases, and DNS records through the Infra Pilot API.

## Requirements

- [Terraform](https://www.terraform.io/downloads) >= 1.0
- [Go](https://golang.org/doc/install) >= 1.21 (to build the provider)
- Infra Pilot API access

## Usage

```hcl
terraform {
  required_providers {
    infrapilot = {
      source = "infra-pilot/terraform-provider-infrapilot"
    }
  }
}

provider "infrapilot" {
  api_url = var.api_url
  api_key = var.api_key
}
```

## Resources

- `infrapilot_server` - Manage game and application servers
- `infrapilot_database` - Manage MySQL/PostgreSQL databases
- `infrapilot_dns` - Manage DNS records

## Data Sources

- `infrapilot_server` - Query existing server information

## Authentication

Authentication is handled via API key, which can be provided through the
`api_key` provider argument or the `IPILOT_API_KEY` environment variable.
