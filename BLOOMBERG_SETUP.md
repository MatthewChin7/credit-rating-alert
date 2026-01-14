# Bloomberg Terminal Integration Setup Guide

## Overview

This guide walks you through setting up the Bloomberg Terminal integration for the Credit Rating Alert Dashboard. The integration uses a Python Flask service to connect to Bloomberg Terminal and fetch real credit rating data.

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Bloomberg Terminal installed and active subscription
- [ ] Bloomberg Terminal running and logged in
- [ ] Python 3.8+ installed (`python --version`)
- [ ] pip package manager available
- [ ] Node.js 16+ and npm installed

## Step 1: Install Bloomberg Python SDK

The Bloomberg Python SDK (`blpapi`) is required to connect to Bloomberg Terminal.

### Download from Bloomberg API Library

Since `blpapi` is not available on PyPI, download it directly from Bloomberg:

1. **Visit Bloomberg API Library**: https://www.bloomberg.com/professional/support/api-library/
2. **Navigate to "Desktop API"** section
3. **Select "Python"** from the language options
4. **Download** the appropriate package for your system:
   - **Windows**: `blpapi-3.x.x.x-cpXXX-win_amd64.whl` (match your Python version)
   - Check your Python version: `python --version`
   - For Python 3.12, download `blpapi-xxx-cp312-cp312-win_amd64.whl`

### Install the Downloaded Package

```bash
pip install C:\path\to\downloaded\blpapi-3.25.11.1-cp312-cp312-win_amd64.whl
```

**Replace the path with your actual download location.**

### Verify Installation

```python
python -c "import blpapi; print('✅ blpapi installed successfully')"
```

## Step 2: Configure Python Bloomberg Service

### Create Environment File

Navigate to the Python service directory and create `.env` file:

```bash
cd backend/bloomberg-python-service
```

Create `.env` with the following content:

```env
BLOOMBERG_HOST=localhost
BLOOMBERG_PORT=8194
FLASK_PORT=5000
FLASK_ENV=development
```

**Note:** You can copy from `.env.example` if it exists.

### Install Python Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- `blpapi` - Bloomberg API library
- `flask` - Web framework
- `flask-cors` - Cross-origin resource sharing
- `python-dotenv` - Environment variable management

## Step 3: Test Bloomberg Connection

Before running the full service, test that Bloomberg Terminal is accessible:

Create a test file `test_connection.py`:

```python
import blpapi

sessionOptions = blpapi.SessionOptions()
sessionOptions.setServerHost("localhost")
sessionOptions.setServerPort(8194)

session = blpapi.Session(sessionOptions)

if session.start():
    print("✅ Bloomberg Terminal connected!")
    session.stop()
else:
    print("❌ Connection failed - ensure Bloomberg Terminal is running")
```

Run the test:

```bash
python test_connection.py
```

**Expected output:** `✅ Bloomberg Terminal connected!`

### Troubleshooting Connection Issues

If connection fails:

1. **Verify Terminal is running:** Bloomberg Terminal window should be open and logged in
2. **Check API service status:** In Terminal, type `SAPI <GO>` to view Server API status
3. **Verify port 8194:** Ensure Bloomberg is using default API port 8194
4. **Firewall/antivirus:** Temporarily disable to test if blocking connection
5. **Restart Terminal:** Sometimes a fresh login is required
6. **Re-download blpapi:** Visit https://www.bloomberg.com/professional/support/api-library/ for latest version

## Step 4: Start the Python Service

### Run the Flask Service

```bash
python bloomberg_api.py
```

**Expected output:**
```
✅ Connected to Bloomberg Terminal at localhost:8194
 * Running on http://0.0.0.0:5000
 * Debug mode: on
```

### Test API Endpoints

In a new terminal, test the health endpoint:

```bash
curl http://localhost:5000/api/health
```

**Expected response:**
```json
{
  "status": "OK",
  "timestamp": "2025-12-31T15:30:00.000Z",
  "bloomberg_connected": true
}
```

Test the bonds endpoint:

```bash
curl http://localhost:5000/api/bonds
```

This should return JSON with bond data (or sample data if screening not yet implemented).

## Step 5: Configure Backend to Use Python Service

### Update Main Environment File

Edit the main `.env` file in the project root:

```env
PYTHON_SERVICE_URL=http://localhost:5000
```

### Restart Backend

The backend should automatically connect to the Python service on startup.

## Step 6: Run Full Application Stack

### Terminal 1: Python Service
```bash
cd backend/bloomberg-python-service
python bloomberg_api.py
```

### Terminal 2: Backend
```bash
cd backend
npm run dev
```

Look for this log message:
```
📊 Bloomberg Terminal connected via Python service
🚀 Credit Rating Alert API running on http://localhost:3001
```

### Terminal 3: Frontend
```bash
npm run dev
```

### Access Dashboard

Open browser to: **http://localhost:5173**

## Verification Checklist

Verify the integration is working:

- [ ] Python service shows Bloomberg connected
- [ ] Backend logs show "Bloomberg Terminal connected via Python service"
- [ ] Dashboard loads without errors
- [ ] Master table displays issuer data
- [ ] Filters show expanded regions (8 regions) and sectors (12 sectors)
- [ ] Data refreshes when clicking reload

## Bloomberg Field Reference

The Python service fetches these Bloomberg fields:

### Issuer Information
- `ID_ISIN` - ISIN identifier
- `ISSUER` / `ISSUER_BULK` - Issuer name
- `COUNTRY_ISO` - Country code

### Credit Ratings
- `RTG_MOODY` - Moody's rating
- `RTG_SP` - S&P rating
- `RTG_FITCH` - Fitch rating
- `RTG_MOODY_RATING_DATE` - Moody's rating date
- `RTG_SP_RATING_DATE` - S&P rating date
- `RTG_FITCH_RATING_DATE` - Fitch rating date

### Outlooks
- `RTG_MOODY_OUTLOOK` - Moody's outlook
- `RTG_SP_OUTLOOK` - S&P outlook
- `RTG_FITCH_OUTLOOK` - Fitch outlook
- `RTG_MOODY_OUTLOOK_DT` - Moody's outlook date
- `RTG_SP_OUTLOOK_DT` - S&P outlook date
- `RTG_FITCH_OUTLOOK_DT` - Fitch outlook date

### Watchlist/Review Status
- `RTG_MOODY_REVIEW` - Moody's review status
- `RTG_SP_CREDITWATCH` - S&P CreditWatch
- `RTG_FITCH_WATCH` - Fitch Watch

### Sector/Industry
- `GICS_SECTOR_NAME` - GICS sector
- `GICS_INDUSTRY_NAME` - GICS industry

## Next Steps

### Implement Bond Screening

The current Python service has a placeholder `screen_usd_bonds()` function. To fetch real data:

1. Update the function to use Bloomberg's screening capabilities
2. Query for active USD bonds across all regions
3. Filter by maturity, credit quality, etc. as needed

### Optimize Performance

For 3000+ bonds:
- Implement caching (Redis recommended)
- Batch requests to Bloomberg
- Consider pagination
- Add background refresh jobs

### Production Deployment

When deploying to production:
- Use environment-specific `.env` files
- Set `FLASK_ENV=production`
- Implement proper logging
- Add monitoring and alerting
- Consider running Python service as a system service

## Troubleshooting

### Python Service Won't Start

**Error:** `ModuleNotFoundError: No module named 'blpapi'`
- Solution: Install blpapi: `pip install blpapi`

**Error:** `Failed to start Bloomberg session`
- Solution: Ensure Bloomberg Terminal is running and logged in

### Backend Can't Connect to Python Service

**Error:** `Bloomberg Terminal not available, running in demo mode`
- Solution: Verify Python service is running on port 5000
- Check `PYTHON_SERVICE_URL` in `.env` is correct

### No Data Showing

If dashboard shows empty table:
- Check backend logs for errors
- Verify Python service is returning data
- TestAPI endpoints directly with curl
- Check browser console for frontend errors

## Support

For Bloomberg API specific questions:
- Bloomberg Terminal: `DOCS <GO>` → API Documentation
- Bloomberg Support: `HELP <GO>`
- Stack Overflow: [bloomberg-api tag](https://stackoverflow.com/questions/tagged/bloomberg-api)
