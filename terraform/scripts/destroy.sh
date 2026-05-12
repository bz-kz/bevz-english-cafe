#!/bin/bash

# Terraform Destroy Script for English Cafe Monitoring Infrastructure
# Usage: ./destroy.sh <environment> [auto-approve]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ENVIRONMENT=${1:-dev}
AUTO_APPROVE=${2:-false}

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    echo -e "${RED}❌ Error: Environment must be one of: dev, staging, prod${NC}"
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

# Function to print section headers
print_header() {
    echo -e "\n${BLUE}🔥 $1${NC}"
    echo "=================================="
}

# Function to show current resources
show_resources() {
    print_header "Current Resources"
    
    echo -e "${BLUE}📋 Resources that will be destroyed:${NC}"
    terraform state list 2>/dev/null || echo "No resources found in state"
    
    echo -e "\n${BLUE}💰 Current cost estimate:${NC}"
    terraform output cost_summary 2>/dev/null || echo "No cost information available"
}

# Function to backup state
backup_state() {
    print_header "Backing Up State"
    
    local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup state file
    if [[ -f "terraform.tfstate" ]]; then
        cp terraform.tfstate "$backup_dir/"
        echo -e "${GREEN}✅ State backed up to $backup_dir/terraform.tfstate${NC}"
    fi
    
    # Backup configuration
    cp terraform.tfvars "$backup_dir/" 2>/dev/null || echo -e "${YELLOW}⚠️  No terraform.tfvars to backup${NC}"
    
    # Export outputs
    terraform output -json > "$backup_dir/outputs.json" 2>/dev/null || echo -e "${YELLOW}⚠️  No outputs to backup${NC}"
    
    echo -e "${GREEN}✅ Backup completed in $backup_dir${NC}"
}

# Function to perform selective destroy
selective_destroy() {
    print_header "Selective Destroy Options"
    
    echo -e "${BLUE}🎯 You can destroy specific resources instead of everything:${NC}"
    echo -e "  1. New Relic resources only"
    echo -e "  2. Grafana resources only"
    echo -e "  3. Vercel resources only"
    echo -e "  4. All monitoring resources (keep infrastructure)"
    echo -e "  5. Everything (full destroy)"
    echo -e "  6. Cancel"
    
    read -p "Choose an option (1-6): " choice
    
    case $choice in
        1)
            echo -e "${YELLOW}🎯 Destroying New Relic resources...${NC}"
            terraform destroy -target=module.newrelic -var-file=terraform.tfvars ${AUTO_APPROVE:+-auto-approve}
            ;;
        2)
            echo -e "${YELLOW}🎯 Destroying Grafana resources...${NC}"
            terraform destroy -target=module.grafana -var-file=terraform.tfvars ${AUTO_APPROVE:+-auto-approve}
            ;;
        3)
            echo -e "${YELLOW}🎯 Destroying Vercel resources...${NC}"
            terraform destroy -target=vercel_project.english_cafe_frontend -var-file=terraform.tfvars ${AUTO_APPROVE:+-auto-approve}
            ;;
        4)
            echo -e "${YELLOW}🎯 Destroying monitoring resources...${NC}"
            terraform destroy -target=module.newrelic -target=module.grafana -var-file=terraform.tfvars ${AUTO_APPROVE:+-auto-approve}
            ;;
        5)
            return 0  # Continue with full destroy
            ;;
        6)
            echo -e "${YELLOW}⏸️  Destroy cancelled${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Invalid option${NC}"
            exit 1
            ;;
    esac
    
    echo -e "${GREEN}✅ Selective destroy completed${NC}"
    exit 0
}

# Function to confirm destroy
confirm_destroy() {
    print_header "Destroy Confirmation"
    
    echo -e "${RED}⚠️  WARNING: This will permanently destroy all monitoring infrastructure!${NC}"
    echo -e "${RED}⚠️  Environment: $ENVIRONMENT${NC}"
    echo -e "${RED}⚠️  This action cannot be undone!${NC}"
    
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        echo -e "${RED}🚨 PRODUCTION ENVIRONMENT DETECTED!${NC}"
        echo -e "${RED}🚨 This will destroy production monitoring!${NC}"
        echo -e "${RED}🚨 Make sure you have approval for this action!${NC}"
    fi
    
    echo -e "\n${BLUE}📋 What will be destroyed:${NC}"
    echo -e "  • New Relic applications and alerts"
    echo -e "  • Grafana dashboards and alert rules"
    echo -e "  • Vercel project configuration"
    echo -e "  • All monitoring data and history"
    
    if [[ "$AUTO_APPROVE" != "true" ]]; then
        echo -e "\n${YELLOW}🤔 Do you want to see selective destroy options? (y/N)${NC}"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            selective_destroy
        fi
        
        echo -e "\n${RED}🔥 Type 'destroy-$ENVIRONMENT' to confirm full destruction:${NC}"
        read -r confirmation
        
        if [[ "$confirmation" != "destroy-$ENVIRONMENT" ]]; then
            echo -e "${YELLOW}⏸️  Destroy cancelled - confirmation text did not match${NC}"
            exit 0
        fi
    fi
}

# Function to perform destroy
perform_destroy() {
    print_header "Destroying Infrastructure"
    
    # Initialize if needed
    terraform init -upgrade
    
    # Show destroy plan
    echo -e "${BLUE}📋 Generating destroy plan...${NC}"
    terraform plan -destroy -var-file=terraform.tfvars -out=destroy.tfplan
    
    # Apply destroy
    if [[ "$AUTO_APPROVE" == "true" ]]; then
        terraform apply destroy.tfplan
    else
        echo -e "\n${YELLOW}🤔 Proceed with destroy? (y/N)${NC}"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            terraform apply destroy.tfplan
        else
            echo -e "${YELLOW}⏸️  Destroy cancelled${NC}"
            rm -f destroy.tfplan
            exit 0
        fi
    fi
    
    # Clean up
    rm -f destroy.tfplan
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ Infrastructure destroyed successfully${NC}"
    else
        echo -e "${RED}❌ Destroy failed${NC}"
        exit 1
    fi
}

# Function to post-destroy cleanup
post_destroy_cleanup() {
    print_header "Post-Destroy Cleanup"
    
    # Remove state files (optional)
    echo -e "${YELLOW}🤔 Remove local state files? (y/N)${NC}"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        rm -f terraform.tfstate*
        rm -rf .terraform/
        echo -e "${GREEN}✅ Local state files removed${NC}"
    fi
    
    # Show cleanup instructions
    echo -e "\n${BLUE}📋 Manual Cleanup Required:${NC}"
    echo -e "  • Check New Relic for any remaining resources"
    echo -e "  • Verify Grafana dashboards are removed"
    echo -e "  • Confirm Vercel project settings"
    echo -e "  • Update DNS records if using custom domain"
    echo -e "  • Remove any external monitoring integrations"
    
    # Show restoration instructions
    echo -e "\n${BLUE}🔄 To Restore Infrastructure:${NC}"
    echo -e "  1. Restore terraform.tfvars from backup"
    echo -e "  2. Run: ./deploy.sh $ENVIRONMENT plan"
    echo -e "  3. Run: ./deploy.sh $ENVIRONMENT apply"
}

# Main execution
main() {
    echo -e "${RED}🔥 English Cafe Monitoring Infrastructure Destruction${NC}"
    echo -e "${RED}Environment: $ENVIRONMENT${NC}"
    echo -e "${RED}Auto-approve: $AUTO_APPROVE${NC}"
    echo -e "${RED}Working Directory: $TERRAFORM_DIR${NC}"
    
    # Show current resources
    show_resources
    
    # Backup state
    backup_state
    
    # Confirm destroy
    confirm_destroy
    
    # Perform destroy
    perform_destroy
    
    # Post-destroy cleanup
    post_destroy_cleanup
    
    echo -e "\n${GREEN}🎉 Destroy script completed!${NC}"
    
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        echo -e "\n${RED}🚨 PRODUCTION MONITORING HAS BEEN DESTROYED!${NC}"
        echo -e "${RED}🚨 Notify the team immediately!${NC}"
        echo -e "${RED}🚨 Consider setting up temporary monitoring!${NC}"
    fi
}

# Run main function
main "$@"