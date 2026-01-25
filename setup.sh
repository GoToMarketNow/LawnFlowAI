#!/bin/bash

# LawnFlow Onboarding System - Quick Start Script
# This script sets up the complete onboarding system with all dependencies

set -e  # Exit on error

echo "🌱 LawnFlow Onboarding System - Setup Script"
echo "============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version) detected${NC}"
echo ""

# Step 1: Install root dependencies
echo "📦 Step 1: Installing root dependencies..."
npm install
echo -e "${GREEN}✅ Root dependencies installed${NC}"
echo ""

# Step 2: Install client dependencies
echo "📦 Step 2: Installing web client dependencies..."
cd client
npm install

# Install additional Stripe dependencies
echo "   Installing Stripe dependencies..."
npm install @stripe/stripe-js @stripe/react-stripe-js

# Install QR code library
echo "   Installing QR code library..."
npm install qrcode.react

cd ..
echo -e "${GREEN}✅ Client dependencies installed${NC}"
echo ""

# Step 3: Install mobile dependencies
echo "📦 Step 3: Installing mobile app dependencies..."
cd mobile
npm install

# Install camera and device dependencies
echo "   Installing camera and device dependencies..."
npm install expo-camera expo-device expo-notifications

cd ..
echo -e "${GREEN}✅ Mobile dependencies installed${NC}"
echo ""

# Step 4: Install server dependencies
echo "📦 Step 4: Installing server dependencies..."
cd server
npm install

# Install Stripe
echo "   Installing Stripe..."
npm install stripe

cd ..
echo -e "${GREEN}✅ Server dependencies installed${NC}"
echo ""

# Step 5: Set up environment variables
echo "🔧 Step 5: Setting up environment variables..."

if [ ! -f .env ]; then
    echo "   Creating .env file from template..."
    cat > .env << 'EOF'
# Database
DATABASE_URL=postgresql://localhost:5432/lawnflow_dev

# OpenAI (for AI Help Agent)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Stripe (Test Mode)
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key-here
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key-here

# QR Code Security (generate a random secret)
QR_CODE_SECRET=change-this-to-a-random-secret-key

# Twilio (for SMS 2FA)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+15005550006

# Application
NODE_ENV=development
PORT=3000
EOF
    echo -e "${YELLOW}⚠️  .env file created. Please update with your actual keys!${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# Create client .env.local
if [ ! -f client/.env.local ]; then
    echo "   Creating client/.env.local..."
    cat > client/.env.local << 'EOF'
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key-here
VITE_API_URL=http://localhost:3000
EOF
    echo -e "${YELLOW}⚠️  client/.env.local created. Please update Stripe key!${NC}"
else
    echo -e "${GREEN}✅ client/.env.local already exists${NC}"
fi

echo ""

# Step 6: Database setup
echo "💾 Step 6: Setting up database..."

if command -v psql &> /dev/null; then
    echo "   PostgreSQL detected. Do you want to create the database now? (y/n)"
    read -r create_db
    
    if [ "$create_db" = "y" ]; then
        echo "   Creating database 'lawnflow_dev'..."
        createdb lawnflow_dev 2>/dev/null || echo "   Database may already exist"
        
        echo "   Running database migrations..."
        npm run db:push
        
        echo -e "${GREEN}✅ Database setup complete${NC}"
    else
        echo -e "${YELLOW}⚠️  Skipped database creation. Run 'createdb lawnflow_dev && npm run db:push' manually.${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  PostgreSQL not detected. Please install PostgreSQL and run:${NC}"
    echo "     createdb lawnflow_dev && npm run db:push"
fi

echo ""

# Step 7: Verify installation
echo "🔍 Step 7: Verifying installation..."

# Check for required files
required_files=(
    "server/routes/onboarding-routes.ts"
    "server/routes/mobile-binding-routes.ts"
    "server/routes/test-payment-routes.ts"
    "client/src/pages/onboarding-v2.tsx"
    "mobile/src/screens/auth/QRScanScreen.tsx"
    "shared/schema.ts"
)

all_files_exist=true
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "   ${GREEN}✅${NC} $file"
    else
        echo -e "   ${RED}❌${NC} $file (MISSING)"
        all_files_exist=false
    fi
done

echo ""

# Step 8: Summary and next steps
echo "============================================="
if [ "$all_files_exist" = true ]; then
    echo -e "${GREEN}✅ Installation Complete!${NC}"
else
    echo -e "${RED}❌ Some files are missing. Please check the installation.${NC}"
fi
echo "============================================="
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Update environment variables:"
echo "   - Edit .env with your API keys"
echo "   - Edit client/.env.local with Stripe publishable key"
echo ""
echo "2. Start the development servers:"
echo "   Terminal 1: npm run dev                # Backend"
echo "   Terminal 2: cd client && npm run dev   # Web"
echo "   Terminal 3: cd mobile && npm start     # Mobile"
echo ""
echo "3. Access the application:"
echo "   - Web: http://localhost:5173/onboarding-v2"
echo "   - API: http://localhost:3000/api"
echo "   - Mobile: Scan QR code from Expo CLI"
echo ""
echo "4. Test the onboarding flow:"
echo "   - See tests/E2E_TESTING_GUIDE.md for test cases"
echo "   - Use test card: 4242 4242 4242 4242"
echo ""
echo "📚 Documentation:"
echo "   - README_MOBILE_COMPLETE.md - Quick start guide"
echo "   - PROJECT_COMPLETE.md - Full completion report"
echo "   - tests/E2E_TESTING_GUIDE.md - Testing guide"
echo ""
echo -e "${GREEN}Happy onboarding! 🎉${NC}"
