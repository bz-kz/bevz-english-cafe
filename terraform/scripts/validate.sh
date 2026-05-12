#!/bin/bash

# Terraform Configuration Validation Script
# Usage: ./validate.sh [environment]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ENVIRONMENT=${1:-all}

# Function to print section headers
print_header() {
    echo -e "\n${BLUE}🔍 $1${NC}"
    echo "=================================="
}

# Function to validate a single environment
validate_environment() {
    local env=$1
    local env_dir="terraform/environments/$env"
    
    print_header "Validating $env Environment"
    
    if [[ ! -d "$env_dir" ]]; then
        echo -e "${RED}❌ Environment directory not found: $env_dir${NC}"
        return 1
    fi
    
    cd "$env_dir"
    
    # Check if required files exist
    local required_files=("main.tf" "variables.tf" "outputs.tf")
    for file in "${required_files[@]}"; do
        if [[ -f "$file" ]]; then
            echo -e "${GREEN}✅ $file exists${NC}"
        else
            echo -e "${RED}❌ $file is missing${NC}"
            return 1
        fi
    done
    
    # Check if terraform.tfvars.example exists
    if [[ -f "terraform.tfvars.example" ]]; then
        echo -e "${GREEN}✅ terraform.tfvars.example exists${NC}"
    else
        echo -e "${YELLOW}⚠️  terraform.tfvars.example is missing${NC}"
    fi
    
    # Initialize and validate
    echo -e "${BLUE}🔧 Initializing Terraform...${NC}"
    terraform init -backend=false > /dev/null 2>&1
    
    echo -e "${BLUE}🔍 Validating configuration...${NC}"
    if terraform validate; then
        echo -e "${GREEN}✅ $env environment configuration is valid${NC}"
    else
        echo -e "${RED}❌ $env environment configuration is invalid${NC}"
        return 1
    fi
    
    # Format check
    echo -e "${BLUE}📝 Checking formatting...${NC}"
    if terraform fmt -check -recursive; then
        echo -e "${GREEN}✅ $env environment formatting is correct${NC}"
    else
        echo -e "${YELLOW}⚠️  $env environment needs formatting. Run 'terraform fmt -recursive'${NC}"
    fi
    
    cd - > /dev/null
}

# Function to validate modules
validate_modules() {
    print_header "Validating Modules"
    
    local modules_dir="terraform/modules"
    
    if [[ ! -d "$modules_dir" ]]; then
        echo -e "${RED}❌ Modules directory not found: $modules_dir${NC}"
        return 1
    fi
    
    for module_dir in "$modules_dir"/*; do
        if [[ -d "$module_dir" ]]; then
            local module_name=$(basename "$module_dir")
            echo -e "${BLUE}🔍 Validating module: $module_name${NC}"
            
            cd "$module_dir"
            
            # Check required files
            local required_files=("main.tf" "variables.tf" "outputs.tf")
            for file in "${required_files[@]}"; do
                if [[ -f "$file" ]]; then
                    echo -e "${GREEN}✅ $module_name/$file exists${NC}"
                else
                    echo -e "${RED}❌ $module_name/$file is missing${NC}"
                    cd - > /dev/null
                    return 1
                fi
            done
            
            # Validate module
            terraform init -backend=false > /dev/null 2>&1
            if terraform validate; then
                echo -e "${GREEN}✅ $module_name module is valid${NC}"
            else
                echo -e "${RED}❌ $module_name module is invalid${NC}"
                cd - > /dev/null
                return 1
            fi
            
            cd - > /dev/null
        fi
    done
}

# Function to check documentation
validate_documentation() {
    print_header "Validating Documentation"
    
    local docs_to_check=(
        "terraform/README.md"
        "docs/terraform-monitoring-design.md"
    )
    
    for doc in "${docs_to_check[@]}"; do
        if [[ -f "$doc" ]]; then
            echo -e "${GREEN}✅ $doc exists${NC}"
        else
            echo -e "${YELLOW}⚠️  $doc is missing${NC}"
        fi
    done
}

# Function to check security
validate_security() {
    print_header "Security Validation"
    
    # Check for hardcoded secrets
    echo -e "${BLUE}🔒 Checking for hardcoded secrets...${NC}"
    
    local secret_patterns=(
        "api_key.*=.*[\"'][^\"']*[\"']"
        "password.*=.*[\"'][^\"']*[\"']"
        "token.*=.*[\"'][^\"']*[\"']"
        "secret.*=.*[\"'][^\"']*[\"']"
    )
    
    local found_secrets=false
    
    for pattern in "${secret_patterns[@]}"; do
        if grep -r -E "$pattern" terraform/ --include="*.tf" --exclude="*.example" | grep -v "var\." | grep -v "local\." > /dev/null; then
            echo -e "${RED}❌ Potential hardcoded secret found:${NC}"
            grep -r -E "$pattern" terraform/ --include="*.tf" --exclude="*.example" | grep -v "var\." | grep -v "local\."
            found_secrets=true
        fi
    done
    
    if [[ "$found_secrets" == false ]]; then
        echo -e "${GREEN}✅ No hardcoded secrets found${NC}"
    fi
    
    # Check .gitignore
    if [[ -f ".gitignore" ]]; then
        local gitignore_patterns=(
            "*.tfvars"
            "*.tfstate"
            "*.tfstate.backup"
            ".terraform/"
        )
        
        for pattern in "${gitignore_patterns[@]}"; do
            if grep -q "$pattern" .gitignore; then
                echo -e "${GREEN}✅ $pattern is in .gitignore${NC}"
            else
                echo -e "${YELLOW}⚠️  $pattern should be added to .gitignore${NC}"
            fi
        done
    else
        echo -e "${RED}❌ .gitignore file is missing${NC}"
    fi
}

# Function to validate provider versions
validate_providers() {
    print_header "Validating Provider Versions"
    
    # Check for consistent provider versions across environments
    local environments=("dev" "staging" "prod")
    local providers=("newrelic" "grafana" "vercel")
    
    for provider in "${providers[@]}"; do
        echo -e "${BLUE}🔍 Checking $provider provider versions...${NC}"
        
        local versions=()
        for env in "${environments[@]}"; do
            local env_file="terraform/environments/$env/main.tf"
            if [[ -f "$env_file" ]]; then
                local version=$(grep -A 3 "source.*$provider" "$env_file" | grep "version" | head -1 | sed 's/.*version.*=.*"\(.*\)".*/\1/')
                if [[ -n "$version" ]]; then
                    versions+=("$env:$version")
                fi
            fi
        done
        
        # Check if all versions are the same
        local unique_versions=$(printf '%s\n' "${versions[@]}" | cut -d: -f2 | sort -u | wc -l)
        if [[ $unique_versions -eq 1 ]]; then
            echo -e "${GREEN}✅ $provider provider versions are consistent${NC}"
        else
            echo -e "${YELLOW}⚠️  $provider provider versions are inconsistent:${NC}"
            printf '%s\n' "${versions[@]}"
        fi
    done
}

# Main execution
main() {
    echo -e "${BLUE}🔍 Terraform Configuration Validation${NC}"
    echo -e "${BLUE}Environment: $ENVIRONMENT${NC}"
    
    local validation_failed=false
    
    # Validate modules first
    if ! validate_modules; then
        validation_failed=true
    fi
    
    # Validate environments
    if [[ "$ENVIRONMENT" == "all" ]]; then
        local environments=("dev" "staging" "prod")
        for env in "${environments[@]}"; do
            if ! validate_environment "$env"; then
                validation_failed=true
            fi
        done
    else
        if ! validate_environment "$ENVIRONMENT"; then
            validation_failed=true
        fi
    fi
    
    # Additional validations
    validate_documentation
    validate_security
    validate_providers
    
    # Summary
    print_header "Validation Summary"
    
    if [[ "$validation_failed" == true ]]; then
        echo -e "${RED}❌ Validation failed. Please fix the issues above.${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ All validations passed successfully!${NC}"
        
        echo -e "\n${BLUE}📋 Next Steps:${NC}"
        echo -e "  • Run: ${YELLOW}./deploy.sh <environment> plan${NC} to see planned changes"
        echo -e "  • Run: ${YELLOW}./deploy.sh <environment> apply${NC} to deploy infrastructure"
        echo -e "  • Check: ${YELLOW}terraform fmt -recursive${NC} to format code"
    fi
}

# Run main function
main "$@"