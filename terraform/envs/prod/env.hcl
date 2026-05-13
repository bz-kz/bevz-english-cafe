locals {
  environment = "prod"

  tags = {
    Environment = "prod"
    Project     = "english-cafe"
    ManagedBy   = "terraform"
  }
}
