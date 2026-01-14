# Installing Python 3.12 x64 for Bloomberg Integration

## Why x64 Python?

You're currently running Python on **Windows ARM64** architecture, but Bloomberg's `blpapi` package has better support for **x64 (64-bit Intel/AMD)** architecture. Installing x64 Python alongside your ARM64 version will allow you to use Bloomberg's pre-built wheels without needing to compile from source.

## Step 1: Download Python 3.12 x64

**Direct Download Link:**
https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe

Or visit: https://www.python.org/downloads/windows/ and look for:
- **Python 3.12.10**
- **Windows installer (64-bit)** ← This is the x64 version

![Python Download Page](file:///C:/Users/matth/.gemini/antigravity/brain/df8b4e35-6fec-45f5-ad8f-bbb62d2b6ac7/python_312_64bit_download_1767169271121.png)

## Step 2: Install Python 3.12 x64

1. **Run the downloaded installer:** `python-3.12.10-amd64.exe`

2. **IMPORTANT: Customize the installation**
   - ✅ Check **"Add python.exe to PATH"** (optional, but helpful)
   - Click **"Customize installation"**

3. **Optional Features:**
   - ✅ pip
   - ✅ py launcher (recommended)
   - Click **Next**

4. **Advanced Options:**
   - ✅ Install for all users (optional)
   - **Change install location** to distinguish from ARM64 version:
     - Suggested: `C:\Python312-x64\`
   - Click **Install**

5. **Complete the installation**

## Step 3: Verify Installation

Open a **new** PowerShell window and check:

```powershell
# Check if x64 Python is installed
C:\Python312-x64\python.exe --version
```

**Expected output:** `Python 3.12.10`

```powershell
# Verify it's x64 (not ARM64)
C:\Python312-x64\python.exe -c "import platform; print(platform.machine())"
```

**Expected output:** `AMD64` (this confirms it's x64)

## Step 4: Install Bloomberg API with x64 Python

Now use the x64 Python to install `blpapi`:

### Option A: Using Bloomberg's Repository (Recommended)

```powershell
C:\Python312-x64\python.exe -m pip install --index-url=https://blpapi.bloomberg.com/repository/releases/python/simple/ blpapi
```

### Option B: Download Wheel from Bloomberg API Library

1. Visit: https://www.bloomberg.com/professional/support/api-library/
2. Navigate to **Desktop API** → **Python**
3. Download: `blpapi-3.x.x.x-cp312-cp312-win_amd64.whl` (note: **amd64**, not arm64)
4. Install:
   ```powershell
   C:\Python312-x64\python.exe -m pip install C:\path\to\blpapi-3.25.11.1-cp312-cp312-win_amd64.whl
   ```

## Step 5: Verify blpapi Installation

```powershell
C:\Python312-x64\python.exe -c "import blpapi; print('✅ blpapi installed successfully')"
```

**Expected output:** `✅ blpapi installed successfully`

## Step 6: Use x64 Python for Bloomberg Project

When running the Bloomberg Python service, use the x64 Python explicitly:

```powershell
cd C:\Users\matth\credit-rating-alert\backend\bloomberg-python-service

# Install requirements with x64 Python
C:\Python312-x64\python.exe -m pip install -r requirements.txt

# Run the service with x64 Python
C:\Python312-x64\python.exe bloomberg_api.py
```

## Creating a Shortcut (Optional)

To make it easier, create a batch file `run-bloomberg-service.bat`:

```batch
@echo off
cd /d C:\Users\matth\credit-rating-alert\backend\bloomberg-python-service
C:\Python312-x64\python.exe bloomberg_api.py
pause
```

Then just double-click this file to start the Bloomberg service!

## Troubleshooting

### "python.exe is not recognized"
- Use the full path: `C:\Python312-x64\python.exe`
- Or add `C:\Python312-x64\` to your PATH environment variable

### Still getting ARM64 errors
- Make sure you're using the x64 Python explicitly
- Check architecture: `C:\Python312-x64\python.exe -c "import platform; print(platform.machine())"`
- Should show `AMD64`, not `ARM64`

### Both Python versions conflict
- Always use full paths to specify which Python to use
- The `py` launcher can help: `py -3.12-64` (if configured)

## Summary

✅ Download Python 3.12 x64 from https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe
✅ Install to `C:\Python312-x64\`
✅ Verify it's x64: `C:\Python312-x64\python.exe -c "import platform; print(platform.machine())"`
✅ Install blpapi using x64 Python
✅ Run Bloomberg service with: `C:\Python312-x64\python.exe bloomberg_api.py`

You can keep both ARM64 and x64 Python installed - just use the full path to specify which one to use!
