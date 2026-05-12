#!/bin/bash

# Terraform Deployment Script for English Cafe Monitoring Infrastructure
# Usage: ./deploy.sh <environment> <action> [auto-approve]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT=${1:-dev}
ACTION=${2:-plan}
AUTO_APPROVE=${3:-false}

# Validate inputs
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    echo -e "${RED}❌ Error: Environment must be one of: dev, staging, prod${NC}"
    exit 1
fi

if [[ ! "$ACTION" =~ ^(plan|apply|destroy|validate|output|refresh)$ ]]; then
    echo -e "${RED}❌ Error: Action must be one of: plan, apply, destroy, validate, output, refresh${NC}"
    exit 1
fi

# Set working directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/../environments/$ENVIRONMENT"

if [[ ! -d "$TERRAFORM_DIR" ]]; then
    echo -e "${RED}❌ Error: Environment directory not found: $TERRAFORM_DIR${NC}"
    exit 1
fi

cd "$TERRAFORM_DIR"

# Check if terraform.tfvars exists
if [[ ! -f "terraform.tfvars" && "$ACTION" != "validate" ]]; then
    echo -e "${YELLOW}⚠️  Warning: terraform.tfvars not found. Creating from example...${NC}"
    if [[ -f "terraform.tfvars.example" ]]; then
        cp terraform.tfvars.example terraform.tfvars
        echo -e "${YELLOW}📝 Please edit terraform.tfvars with your actual values before proceeding${NC}"
        exit 1
    else
        echo -e "${RED}❌ Error: terraform.tfvars.example not found${NC}"
        exit 1
    fi
fi

# Function to print section headers
print_header() {
    echo -e "\n${BLUE}🚀 $1${NC}"
    echo "=================================="
}

# Function to check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Terraform version
    if ! command -v terraform &> /dev/null; then
        echo -e "${RED}❌ Terraform is not installed${NC}"
        exit 1
    fi
    
    TERRAFORM_VERSION=$(terraform version -json | jq -r '.terraform_version')
    echo -e "${GREEN}✅ Terraform version: $TERRAFORM_VERSION${NC}"
    
    # Check required environment variables for production
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        required_vars=(
            "TF_VAR_newrelic_account_id"
            "TF_VAR_newrelic_api_key"
            "TF_VAR_grafana_url"
            "TF_VAR_grafana_auth_token"
        )
        
        for var in "${required_vars[@]}"; do
            if [[ -z "${!var}" ]]; then
                echo -e "${YELLOW}⚠️  Warning: $var is not set${NC}"
            else
                echo -e "${GREEN}✅ $var is set${NC}"
            fi
        done
    fi
}

# Function to initialize Terraform
terraform_init() {
    print_header "Initializing Terraform"
    
    terraform init -upgrade
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ Terraform initialization successful${NC}"
    else
        echo -e "${RED}❌ Terraform initialization failed${NC}"
        exit 1
    fi
}

# Function to validate configuration
terraform_validate() {
    print_header "Validating Configuration"
    
    terraform validate
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ Configuration is valid${NC}"
    else
        echo -e "${RED}❌ Configuration validation failed${NC}"
        exit 1
    fi
}

# Function to plan changes
terraform_plan() {
    print_header "Planning Changes"
    
    terraform plan -out=tfplan -var-file=terraform.tfvars
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ Plan completed successfully${NC}"
        echo -e "${BLUE}📋 Plan saved to tfplan${NC}"
    else
        echo -e "${RED}❌ Planning failed${NC}"
        exit 1
    fi
}

# Function to apply changes
terraform_apply() {
    print_header "Applying Changes"
    
    if [[ ! -f "tfplan" ]]; then
        echo -e "${YELLOW}⚠️  No plan file found. Running plan first...${NC}"
        terraform_plan
    fi
    
    if [[ "$AUTO_APPROVE" == "true" ]]; then
        terraform apply tfplan
    else
        echo -e "${YELLOW}🤔 Do you want to apply these changes? (y/N)${NC}"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            terraform apply tfplan
        else
            echo -e "${YELLOW}⏸️  Apply cancelled${NC}"
            exit 0
        fi
    fi
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ Apply completed successfully${NC}"
        
        # Clean up plan file
        rm -f tfplan
        
        # Show important outputs
        echo -e "\n${BLUE}📊 Important Outputs:${NC}"
        terraform output monitoring_urls 2>/dev/null || echo "No monitoring URLs available"
        terraform output health_check_urls 2>/dev/null || echo "No health check URLs available"
        
    else
        echo -e "${RED}❌ Apply failed${NC}"
        exit 1
    fi
}

# Function to destroy infrastructure
terraform_destroy() {
    print_header "Destroying Infrastructure"
    
    echo -e "${RED}⚠️  WARNING: This will destroy all monitoring infrastructure for $ENVIRONMENT!${NC}"
    echo -e "${RED}⚠️  This action cannot be undone!${NC}"
    
    if [[ "$AUTO_APPROVE" == "true" ]]; then
        terraform destroy -var-file=terraform.tfvars -auto-approve
    else
        echo -e "${YELLOW}🤔 Are you absolutely sure you want to destroy everything? Type 'yes' to confirm:${NC}"
        read -r response
        if [[ "$response" == "yes" ]]; then
            terraform destroy -var-file=terraform.tfvars
        else
            echo -e "${YELLOW}⏸️  Destroy cancelled${NC}"
            exit 0
        fi
    fi
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ Destroy completed successfully${NC}"
    else
        echo -e "${RED}❌ Destroy failed${NC}"
        exit 1
    fi
}

# Function to show outputs
terraform_output() {
    print_header "Terraform Outputs"
    
    terraform output
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ Outputs displayed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to display outputs${NC}"
        exit 1
    fi
}

# Function to refresh state
terraform_refresh() {
    print_header "Refreshing State"
    
    terraform refresh -var-file=terraform.tfvars
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ State refreshed successfully${NC}"
    else
        echo -e "${RED}❌ State refresh failed${NC}"
        exit 1
    fi
}

# Main execution
main() {
    echo -e "${BLUE}🏗️  English Cafe Monitoring Infrastructure Deployment${NC}"
    echo -e "${BLUE}Environment: $ENVIRONMENT${NC}"
    echo -e "${BLUE}Action: $ACTION${NC}"
    echo -e "${BLUE}Working Directory: $TERRAFORM_DIR${NC}"
    
    # Always check prerequisites and initialize
    check_prerequisites
    terraform_init
    
    # Execute requested action
    case "$ACTION" in
        "validate")
            terraform_validate
            ;;
        "plan")
            terraform_validate
            terraform_plan
            ;;
        "apply")
            terraform_validate
            terraform_apply
            ;;
        "destroy")
            terraform_destroy
            ;;
        "output")
            terraform_output
            ;;
        "refresh")
            terraform_refresh
            ;;
        *)
            echo -e "${RED}❌ Unknown action: $ACTION${NC}"
            exit 1
            ;;
    esac
    
    echo -e "\n${GREEN}🎉 Deployment script completed successfully!${NC}"
    
    # Show next steps
    if [[ "$ACTION" == "plan" ]]; then
        echo -e "\n${BLUE}📋 Next Steps:${NC}"
        echo -e "  • Review the plan output above"
        echo -e "  • Run: ${YELLOW}./deploy.sh $ENVIRONMENT apply${NC} to apply changes"
    elif [[ "$ACTION" == "apply" ]]; then
        echo -e "\n${BLUE}📋 Next Steps:${NC}"
        echo -e "  • Check monitoring dashboards:"
        terraform output monitoring_urls 2>/dev/null | grep -E "(newrelic|grafana)" || true
        echo -e "  • Verify health checks:"
        terraform output health_check_urls 2>/dev/null || true
        echo -e "  • Monitor alerts in Slack and email"
    fi
}

# Run main function
main "$@"