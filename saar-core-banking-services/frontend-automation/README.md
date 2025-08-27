# SaaR Banking Frontend Demo Automation

## Quick Demo Commands

Run these commands to test your demo scenarios before presenting to investors:

### Health Check (Always run first)
```bash
npm run demo:health
```

### Individual Demo Scenarios
```bash
# Expression Builder Deep Dive
npm run demo:expressions

# Complete Loan Application Journey
npm run demo:loans

# Dynamic Forms & Configuration
npm run demo:forms

# Full Investor Rehearsal (23-minute complete flow)
npm run demo:rehearsal
```

### Full Demo Validation
```bash
# Validate all demo components
npm run demo:validate

# Run all tests in headed mode (watch the automation)
npm run demo:all
```

### Demo Recording & Debugging
```bash
# Record new demo interactions
npm run demo:record

# Interactive testing with UI
npm test:ui
```

## Demo Automation Features

✅ **Login Authentication**: Validates demo credentials and platform access  
✅ **Expression Builder**: Tests business rule creation and editing capabilities  
✅ **Loan Application**: Complete customer journey with dynamic forms  
✅ **Dynamic Configuration**: Admin configuration and schema management  
✅ **Investor Rehearsal**: Full 23-minute presentation simulation  

## Pre-Demo Checklist

1. **Start all backend services** (Expression 5004, Workflow 5012, DynamicForms 5013, LoanService 5130)
2. **Start frontend** (React app on port 3001)  
3. **Run health check**: `npm run demo:health`
4. **Run validation**: `npm run demo:validate`
5. **Practice rehearsal**: `npm run demo:rehearsal`

## Demo Story Arc Coverage

🎬 **Arc 1**: Platform access and security demonstration  
🎬 **Arc 2**: Real-time business rule creation with Expression Builder  
🎬 **Arc 3**: Complete customer loan application journey  
🎬 **Arc 4**: Administrative configuration capabilities  
🎬 **Arc 5**: Business value and investor impact summary  

## Automation Technology

- **Playwright**: Cross-browser automation with visual debugging
- **Realistic Timing**: slowMo settings for demo-appropriate pacing
- **Error Capture**: Screenshots and videos on failure for debugging
- **Multiple Browsers**: Chrome, Firefox, Safari support

## Demo Credentials

- **Username**: admin@saarbanking.com
- **Password**: admin123

## Success Indicators

Each test validates:
- Page accessibility and loading
- Form interactions and submissions  
- Real-time validation and feedback
- Expression execution and results
- Configuration changes and impacts
- Workflow progression and status updates

Run `npm run demo:validate` to ensure all demo scenarios are working perfectly before your investor presentation!
