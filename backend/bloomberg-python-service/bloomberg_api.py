"""
Bloomberg API Service
Flask REST API that connects to Bloomberg Terminal and fetches credit rating data.
"""

import blpapi
from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime, date
import os
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Bloomberg connection settings
BLOOMBERG_HOST = os.getenv('BLOOMBERG_HOST', 'localhost')
BLOOMBERG_PORT = int(os.getenv('BLOOMBERG_PORT', 8194))

# Global session
session = None
refDataService = None


class BloombergConnection:
    """Manages Bloomberg Terminal connection"""
    
    def __init__(self):
        self.session = None
        self.refDataService = None
        
    def connect(self):
        """Initialize connection to Bloomberg Terminal"""
        try:
            sessionOptions = blpapi.SessionOptions()
            sessionOptions.setServerHost(BLOOMBERG_HOST)
            sessionOptions.setServerPort(BLOOMBERG_PORT)
            
            self.session = blpapi.Session(sessionOptions)
            
            if not self.session.start():
                raise Exception("Failed to start Bloomberg session")
            
            if not self.session.openService("//blp/refdata"):
                raise Exception("Failed to open //blp/refdata service")
            
            self.refDataService = self.session.getService("//blp/refdata")
            logger.info(f"✅ Connected to Bloomberg Terminal at {BLOOMBERG_HOST}:{BLOOMBERG_PORT}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Bloomberg connection failed: {str(e)}")
            raise
    
    def disconnect(self):
        """Close Bloomberg connection"""
        if self.session:
            self.session.stop()
            logger.info("Bloomberg session stopped")


# Global connection instance
bloomberg = BloombergConnection()


def screen_usd_bonds():
    """
    Screen for Active USD Bonds across Americas, Europe, Asia-Pacific, MEA.
    Tries multiple major indices to get a broad set of constituents.
    """
    if not bloomberg.session:
        return []

    # List of indices to try in order of preference
    indices = [
        "LEGATRUU Index",    # Bloomberg Global Aggregate - USD
        "LUACTRUU Index",    # Bloomberg US Corporate
        "LF98TRUU Index",    # Bloomberg US High Yield
        "LBUSTRUU Index"     # Bloomberg US Aggregate
    ]
    
    isins = []
    
    for index_name in indices:
        if len(isins) >= 3000:
            break
            
        logger.info(f"Attempting to fetch members from {index_name}...")
        
        try:
            request = bloomberg.refDataService.createRequest("ReferenceDataRequest")
            request.getElement("securities").appendValue(index_name)
            
            # Request all common member fields
            fields = ["INDX_MEMBERS", "INDX_MWEIGHT", "INDX_MEMBERS_WEIGHTS", "MEMBERS_AND_WEIGHTS"]
            for field in fields:
                request.getElement("fields").appendValue(field)
            
            bloomberg.session.sendRequest(request)
            
            while True:
                event = bloomberg.session.nextEvent(2000)
                
                if event.eventType() == blpapi.Event.RESPONSE or \
                   event.eventType() == blpapi.Event.PARTIAL_RESPONSE:
                    
                    for msg in event:
                        # Check for global response error (e.g. LIMIT)
                        if msg.hasElement("responseError"):
                            error = msg.getElement("responseError")
                            err_code = error.getElementAsString("code")
                            err_msg = error.getElementAsString("message")
                            if "DAILY_CAPACITY_REACHED" in error.getElementAsString("subcategory"):
                                logger.error("CRITICAL: Bloomberg Daily Data Limit Reached (Error -4001)")
                                return "LIMIT_REACHED"
                            logger.error(f"Bloomberg Response Error: {err_msg} (Code: {err_code})")
                            continue

                        # DEBUG: Log the full raw message if we haven't found any members yet
                        if len(isins) == 0:
                            logger.info(f"Raw message for {index_name}: {msg}")
                        
                        if not msg.hasElement("securityData"):
                            continue
                            
                        # ... rest of existing logic ...
                        sec_data_array = msg.getElement("securityData")
                        for i in range(sec_data_array.numValues()):
                            sec_data = sec_data_array.getValueAsElement(i)
                            
                            if sec_data.hasElement("securityError"):
                                error_msg = sec_data.getElement("securityError").getElementAsString("description")
                                logger.error(f"Security error for {index_name}: {error_msg}")
                                continue
                                
                            if not sec_data.hasElement("fieldData"):
                                logger.warning(f"No fieldData found for {index_name}")
                                continue
                                
                            field_data = sec_data.getElement("fieldData")
                            
                            # Log all field names found for the first successful item
                            if i == 0:
                                available_fields = [str(field_data.getElement(j).name()) for j in range(field_data.numElements())]
                                logger.info(f"Available fields for {index_name}: {available_fields}")
                                
                            for field in fields:
                                if not field_data.hasElement(field):
                                    continue
                                    
                                members_element = field_data.getElement(field)
                                logger.info(f"Found field {field} with {members_element.numValues()} values")
                                
                                # Try more identifier fields
                                sub_fields = [
                                    "Member Ticker and Exchange Code", 
                                    "Member Ticker",
                                    "ISIN", 
                                    "ID_ISIN",
                                    "Ticker",
                                    "Security Identifier"
                                ]
                                
                                for j in range(members_element.numValues()):
                                    member_entry = members_element.getValueAsElement(j)
                                    for sub in sub_fields:
                                        if member_entry.hasElement(sub):
                                            val = member_entry.getElementAsString(sub)
                                            if val and val not in isins:
                                                isins.append(val)
                                                break
                
                if event.eventType() == blpapi.Event.RESPONSE:
                    break
                    
            logger.info(f"Current total constituents: {len(isins)}")
            
        except Exception as e:
            logger.error(f"Exception during screening of {index_name}: {str(e)}")
            continue

    if len(isins) == 0:
        logger.error("All indices returned 0 items. Check Bloomberg Terminal terminal/API permissions.")
        return []

    logger.info(f"Successfully screened {len(isins)} unique bonds from Bloomberg")
    return isins[:3000]

def get_extended_fallback_list():
    """
    Returns a list of well-known Bloomberg securities in proper format.
    Bloomberg API requires securities in format: 'ISIN Corp', 'TICKER Govt', etc.
    Using TICKER format which is more reliable than ISIN queries.
    """
    return [
        # US Sovereigns (Format: TICKER Govt)
        "T 2 01/31/26 Govt",    # US Treasury 2yr
        "T 3 02/15/28 Govt",    # US Treasury Note
        "T 4 05/15/34 Govt",    # US Treasury 10yr
        
        # Major US Corporates (Format: TICKER Corp)
        "AAPL 2.4 05/03/23 Corp",   # Apple
        "MSFT 2.4 08/08/26 Corp",   # Microsoft
        "AMZN 3.15 08/22/27 Corp",  # Amazon
        "GOOGL 1.1 08/15/30 Corp",  # Alphabet/Google
        "META 3.5 08/15/27 Corp",   # Meta
        "JPM 3.625 12/01/27 Corp",  # JP Morgan
        "BAC 3.5 04/19/26 Corp",    # Bank of America
        "GS 3.5 04/01/25 Corp",     # Goldman Sachs
        "MS 3.625 01/20/27 Corp",   # Morgan Stanley
        "C 3.5 05/15/23 Corp",      # Citigroup
        "WFC 3.0 02/19/25 Corp",    # Wells Fargo
        "XOM 3.043 03/01/26 Corp",  # Exxon Mobil
        "CVX 2.411 03/03/27 Corp",  # Chevron
        "JNJ 2.1 09/01/40 Corp",    # Johnson & Johnson
        "PG 2.3 02/06/32 Corp",     # Procter & Gamble
        "UNH 2.0 05/15/30 Corp",    # UnitedHealth
        
        # European Sovereigns
        "DBR 0 02/15/32 Govt",      # German Bund
        "FRTR 0 05/25/32 Govt",     # French OAT
        "UKT 1.5 07/22/26 Govt",    # UK Gilt
        
        # European Corporates
        "SHBASS 0.625 09/01/27 Corp",  # Shell
        "BPLN 2.25 09/14/29 Corp",     # BP
        "TOTFP 1.375 09/04/25 Corp",   # TotalEnergies
        "SANOFI 2.625 03/29/38 Corp",  # Sanofi
        "NOVNVX 1.375 11/10/26 Corp",  # Novartis
        
        # Asian Corporates / Sovereigns
        "JGBS 0.1 12/01/31 Govt",      # Japanese Govt Bond
        "CHINA 3.5 10/21/28 Govt",     # China Govt Bond
        
        # EM/Other
        "BRAZIL 5.625 02/21/47 Govt",  # Brazil
        "MEXICO 4.75 03/08/44 Govt",   # Mexico
        
        # Major Banks / Financials
        "HSBC 4.25 08/17/25 Corp",     # HSBC
        "BARC 3.684 01/10/23 Corp",    # Barclays
        "DB 3.7 05/30/24 Corp",        # Deutsche Bank
        "UBS 4.125 04/15/26 Corp",     # UBS
        "CS 4.75 08/09/24 Corp",       # Credit Suisse (historical)
    ]


def fetch_reference_data(securities, fields):
    """
    Fetch reference data for securities using Bloomberg API with batching
    
    Args:
        securities: List of security identifiers
        fields: List of Bloomberg field names
    
    Returns:
        Dictionary mapping securities to field values
    """
    if not securities:
        return {}

    all_results = {}
    batch_size = 100
    
    for i in range(0, len(securities), batch_size):
        batch = securities[i:i + batch_size]
        logger.info(f"Processing batch {i//batch_size + 1}: {len(batch)} securities")
        
        try:
            request = bloomberg.refDataService.createRequest("ReferenceDataRequest")
            
            # Add securities
            for security in batch:
                if security and security.strip():
                    request.getElement("securities").appendValue(security.strip())
            
            # Add fields
            for field in fields:
                request.getElement("fields").appendValue(field)
            
            # Send request
            bloomberg.session.sendRequest(request)
            
            while True:
                event = bloomberg.session.nextEvent(2000) # Increased timeout
                
                if event.eventType() == blpapi.Event.RESPONSE or \
                   event.eventType() == blpapi.Event.PARTIAL_RESPONSE:
                    
                    for msg in event:
                        if not msg.hasElement("securityData"):
                            continue
                            
                        securityDataArray = msg.getElement("securityData")
                        
                        for i in range(securityDataArray.numValues()):
                            securityData = securityDataArray.getValueAsElement(i)
                            security = securityData.getElementAsString("security")
                            
                            if securityData.hasElement("fieldExceptions") and securityData.getElement("fieldExceptions").numValues() > 0:
                                logger.warning(f"Field exceptions for {security}")
                            
                            if securityData.hasElement("securityError"):
                                error = securityData.getElement("securityError")
                                logger.error(f"Security error for {security}: {error.getElementAsString('description')}")
                                continue

                            fieldData = securityData.getElement("fieldData")
                            secData = {}
                            
                            for field in fields:
                                try:
                                    if fieldData.hasElement(field):
                                        value = fieldData.getElement(field).getValue()
                                        # Convert datetime to ISO string
                                        if isinstance(value, datetime):
                                            value = value.isoformat()
                                        elif isinstance(value, date):
                                            value = value.isoformat()
                                        secData[field] = value
                                    else:
                                        secData[field] = None
                                except Exception as e:
                                    secData[field] = None
                            
                            all_results[security] = secData
                
                if event.eventType() == blpapi.Event.RESPONSE:
                    break
                    
        except Exception as e:
            logger.error(f"Error fetching batch: {str(e)}")
            continue # Try next batch
            
    logger.info(f"Total securities with data: {len(all_results)}")
    return all_results


def get_sample_bonds():
    """
    Return comprehensive sample bond data for testing/demo mode.
    This provides a diverse set of issuers with various ratings, outlooks, and regions.
    """
    samples = [
        # US Sovereigns
        {"isin": "US912828Z250", "issuer": "United States Treasury", "country": "US", "sector": "sovereign", "industry": "Government", "moodys_rating": "Aaa", "sp_rating": "AA+", "fitch_rating": "AAA", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2024-01-15", "sp_rating_date": "2024-02-20", "fitch_rating_date": "2024-01-10", "moodys_outlook_date": "2024-01-15", "sp_outlook_date": "2024-02-20", "fitch_outlook_date": "2024-01-10", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        
        # US Tech
        {"isin": "US0378331005", "issuer": "Apple Inc.", "country": "US", "sector": "technology", "industry": "Consumer Electronics", "moodys_rating": "Aaa", "sp_rating": "AA+", "fitch_rating": "AA+", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-08-01", "sp_rating_date": "2023-09-15", "fitch_rating_date": "2023-07-20", "moodys_outlook_date": "2023-08-01", "sp_outlook_date": "2023-09-15", "fitch_outlook_date": "2023-07-20", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        {"isin": "US5949181045", "issuer": "Microsoft Corp.", "country": "US", "sector": "technology", "industry": "Software", "moodys_rating": "Aaa", "sp_rating": "AAA", "fitch_rating": "AAA", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-06-10", "sp_rating_date": "2023-07-05", "fitch_rating_date": "2023-06-15", "moodys_outlook_date": "2023-06-10", "sp_outlook_date": "2023-07-05", "fitch_outlook_date": "2023-06-15", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        {"isin": "US0231351067", "issuer": "Amazon.com Inc.", "country": "US", "sector": "consumer", "industry": "E-commerce", "moodys_rating": "A1", "sp_rating": "AA", "fitch_rating": "A+", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "positive", "moodys_rating_date": "2023-04-20", "sp_rating_date": "2023-05-10", "fitch_rating_date": "2023-04-25", "moodys_outlook_date": "2023-04-20", "sp_outlook_date": "2023-05-10", "fitch_outlook_date": "2023-04-25", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        {"isin": "US02079K3059", "issuer": "Alphabet Inc.", "country": "US", "sector": "technology", "industry": "Internet Services", "moodys_rating": "Aa2", "sp_rating": "AA+", "fitch_rating": "AA+", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-03-15", "sp_rating_date": "2023-04-01", "fitch_rating_date": "2023-03-20", "moodys_outlook_date": "2023-03-15", "sp_outlook_date": "2023-04-01", "fitch_outlook_date": "2023-03-20", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        
        # US Banks
        {"isin": "US46625H1005", "issuer": "JPMorgan Chase & Co.", "country": "US", "sector": "financial", "industry": "Banks", "moodys_rating": "A1", "sp_rating": "A-", "fitch_rating": "AA-", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-11-01", "sp_rating_date": "2023-11-15", "fitch_rating_date": "2023-10-20", "moodys_outlook_date": "2023-11-01", "sp_outlook_date": "2023-11-15", "fitch_outlook_date": "2023-10-20", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        {"isin": "US0605051046", "issuer": "Bank of America Corp.", "country": "US", "sector": "financial", "industry": "Banks", "moodys_rating": "A2", "sp_rating": "A-", "fitch_rating": "A+", "moodys_outlook": "stable", "sp_outlook": "negative", "fitch_outlook": "stable", "moodys_rating_date": "2023-10-05", "sp_rating_date": "2023-10-20", "fitch_rating_date": "2023-09-15", "moodys_outlook_date": "2023-10-05", "sp_outlook_date": "2023-10-20", "fitch_outlook_date": "2023-09-15", "moodys_watch": "Not on watchlist", "sp_watch": "Negative", "fitch_watch": "Not on watchlist"},
        {"isin": "US38141G1040", "issuer": "Goldman Sachs Group Inc.", "country": "US", "sector": "financial", "industry": "Investment Banking", "moodys_rating": "A2", "sp_rating": "BBB+", "fitch_rating": "A", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-09-10", "sp_rating_date": "2023-09-25", "fitch_rating_date": "2023-08-30", "moodys_outlook_date": "2023-09-10", "sp_outlook_date": "2023-09-25", "fitch_outlook_date": "2023-08-30", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        
        # US Energy
        {"isin": "US30231G1022", "issuer": "Exxon Mobil Corp.", "country": "US", "sector": "energy", "industry": "Oil & Gas", "moodys_rating": "Aa2", "sp_rating": "AA-", "fitch_rating": "AA-", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-07-15", "sp_rating_date": "2023-08-01", "fitch_rating_date": "2023-07-20", "moodys_outlook_date": "2023-07-15", "sp_outlook_date": "2023-08-01", "fitch_outlook_date": "2023-07-20", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        {"isin": "US1667641005", "issuer": "Chevron Corp.", "country": "US", "sector": "energy", "industry": "Oil & Gas", "moodys_rating": "Aa2", "sp_rating": "AA-", "fitch_rating": "AA-", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-06-20", "sp_rating_date": "2023-07-10", "fitch_rating_date": "2023-06-25", "moodys_outlook_date": "2023-06-20", "sp_outlook_date": "2023-07-10", "fitch_outlook_date": "2023-06-25", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        
        # European Sovereigns
        {"isin": "DE0001102341", "issuer": "Federal Republic of Germany", "country": "DE", "sector": "sovereign", "industry": "Government", "moodys_rating": "Aaa", "sp_rating": "AAA", "fitch_rating": "AAA", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2024-01-05", "sp_rating_date": "2024-01-10", "fitch_rating_date": "2024-01-08", "moodys_outlook_date": "2024-01-05", "sp_outlook_date": "2024-01-10", "fitch_outlook_date": "2024-01-08", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        {"isin": "FR0014007L00", "issuer": "French Republic", "country": "FR", "sector": "sovereign", "industry": "Government", "moodys_rating": "Aa2", "sp_rating": "AA", "fitch_rating": "AA-", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "negative", "moodys_rating_date": "2023-12-15", "sp_rating_date": "2023-12-20", "fitch_rating_date": "2023-12-18", "moodys_outlook_date": "2023-12-15", "sp_outlook_date": "2023-12-20", "fitch_outlook_date": "2023-12-18", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Negative"},
        {"isin": "GB00BM8Z2S21", "issuer": "United Kingdom", "country": "GB", "sector": "sovereign", "industry": "Government", "moodys_rating": "Aa3", "sp_rating": "AA", "fitch_rating": "AA-", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-11-20", "sp_rating_date": "2023-12-01", "fitch_rating_date": "2023-11-25", "moodys_outlook_date": "2023-11-20", "sp_outlook_date": "2023-12-01", "fitch_outlook_date": "2023-11-25", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        {"isin": "IT0005436693", "issuer": "Republic of Italy", "country": "IT", "sector": "sovereign", "industry": "Government", "moodys_rating": "Baa3", "sp_rating": "BBB", "fitch_rating": "BBB", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-10-10", "sp_rating_date": "2023-10-15", "fitch_rating_date": "2023-10-12", "moodys_outlook_date": "2023-10-10", "sp_outlook_date": "2023-10-15", "fitch_outlook_date": "2023-10-12", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        
        # European Corporates
        {"isin": "XS2388365457", "issuer": "Shell Plc", "country": "GB", "sector": "energy", "industry": "Oil & Gas", "moodys_rating": "Aa2", "sp_rating": "A+", "fitch_rating": "AA-", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-08-15", "sp_rating_date": "2023-09-01", "fitch_rating_date": "2023-08-20", "moodys_outlook_date": "2023-08-15", "sp_outlook_date": "2023-09-01", "fitch_outlook_date": "2023-08-20", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        {"isin": "XS1967664286", "issuer": "BP Plc", "country": "GB", "sector": "energy", "industry": "Oil & Gas", "moodys_rating": "A2", "sp_rating": "A-", "fitch_rating": "A", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-07-01", "sp_rating_date": "2023-07-15", "fitch_rating_date": "2023-07-05", "moodys_outlook_date": "2023-07-01", "sp_outlook_date": "2023-07-15", "fitch_outlook_date": "2023-07-05", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        {"isin": "DE000A1R07P5", "issuer": "Deutsche Telekom AG", "country": "DE", "sector": "telecommunications", "industry": "Telecom", "moodys_rating": "Baa1", "sp_rating": "BBB+", "fitch_rating": "BBB+", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-05-20", "sp_rating_date": "2023-06-01", "fitch_rating_date": "2023-05-25", "moodys_outlook_date": "2023-05-20", "sp_outlook_date": "2023-06-01", "fitch_outlook_date": "2023-05-25", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        {"isin": "FR0013446132", "issuer": "TotalEnergies SE", "country": "FR", "sector": "energy", "industry": "Oil & Gas", "moodys_rating": "Aa3", "sp_rating": "A+", "fitch_rating": "A+", "moodys_outlook": "stable", "sp_outlook": "positive", "fitch_outlook": "stable", "moodys_rating_date": "2023-04-10", "sp_rating_date": "2023-04-25", "fitch_rating_date": "2023-04-15", "moodys_outlook_date": "2023-04-10", "sp_outlook_date": "2023-04-25", "fitch_outlook_date": "2023-04-15", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        
        # Asia-Pacific
        {"isin": "JP1103661L42", "issuer": "Government of Japan", "country": "JP", "sector": "sovereign", "industry": "Government", "moodys_rating": "A1", "sp_rating": "A+", "fitch_rating": "A", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-12-01", "sp_rating_date": "2023-12-10", "fitch_rating_date": "2023-12-05", "moodys_outlook_date": "2023-12-01", "sp_outlook_date": "2023-12-10", "fitch_outlook_date": "2023-12-05", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        {"isin": "CNY00001JY79", "issuer": "People's Republic of China", "country": "CN", "sector": "sovereign", "industry": "Government", "moodys_rating": "A1", "sp_rating": "A+", "fitch_rating": "A+", "moodys_outlook": "negative", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-11-05", "sp_rating_date": "2023-11-15", "fitch_rating_date": "2023-11-10", "moodys_outlook_date": "2023-11-05", "sp_outlook_date": "2023-11-15", "fitch_outlook_date": "2023-11-10", "moodys_watch": "Negative", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        {"isin": "AU0000097495", "issuer": "Commonwealth of Australia", "country": "AU", "sector": "sovereign", "industry": "Government", "moodys_rating": "Aaa", "sp_rating": "AAA", "fitch_rating": "AAA", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2024-01-02", "sp_rating_date": "2024-01-05", "fitch_rating_date": "2024-01-03", "moodys_outlook_date": "2024-01-02", "sp_outlook_date": "2024-01-05", "fitch_outlook_date": "2024-01-03", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        
        # Emerging Markets
        {"isin": "BRSTNCNTB3P4", "issuer": "Federative Republic of Brazil", "country": "BR", "sector": "sovereign", "industry": "Government", "moodys_rating": "Ba2", "sp_rating": "BB-", "fitch_rating": "BB", "moodys_outlook": "positive", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-10-01", "sp_rating_date": "2023-10-10", "fitch_rating_date": "2023-10-05", "moodys_outlook_date": "2023-10-01", "sp_outlook_date": "2023-10-10", "fitch_outlook_date": "2023-10-05", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        {"isin": "MX0MGO0000Y4", "issuer": "United Mexican States", "country": "MX", "sector": "sovereign", "industry": "Government", "moodys_rating": "Baa2", "sp_rating": "BBB", "fitch_rating": "BBB-", "moodys_outlook": "negative", "sp_outlook": "negative", "fitch_outlook": "stable", "moodys_rating_date": "2023-09-01", "sp_rating_date": "2023-09-15", "fitch_rating_date": "2023-09-10", "moodys_outlook_date": "2023-09-01", "sp_outlook_date": "2023-09-15", "fitch_outlook_date": "2023-09-10", "moodys_watch": "Negative", "sp_watch": "Negative", "fitch_watch": "Not on watchlist"},
        {"isin": "ZAG000016320", "issuer": "Republic of South Africa", "country": "ZA", "sector": "sovereign", "industry": "Government", "moodys_rating": "Ba2", "sp_rating": "BB-", "fitch_rating": "BB-", "moodys_outlook": "negative", "sp_outlook": "stable", "fitch_outlook": "negative", "moodys_rating_date": "2023-08-01", "sp_rating_date": "2023-08-15", "fitch_rating_date": "2023-08-10", "moodys_outlook_date": "2023-08-01", "sp_outlook_date": "2023-08-15", "fitch_outlook_date": "2023-08-10", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Negative"},
        
        # Middle East
        {"isin": "XS1508675508", "issuer": "Kingdom of Saudi Arabia", "country": "SA", "sector": "sovereign", "industry": "Government", "moodys_rating": "A1", "sp_rating": "A", "fitch_rating": "A+", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-07-20", "sp_rating_date": "2023-08-01", "fitch_rating_date": "2023-07-25", "moodys_outlook_date": "2023-07-20", "sp_outlook_date": "2023-08-01", "fitch_outlook_date": "2023-07-25", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        {"isin": "XS1405780619", "issuer": "United Arab Emirates", "country": "AE", "sector": "sovereign", "industry": "Government", "moodys_rating": "Aa2", "sp_rating": "AA", "fitch_rating": "AA-", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-06-15", "sp_rating_date": "2023-07-01", "fitch_rating_date": "2023-06-20", "moodys_outlook_date": "2023-06-15", "sp_outlook_date": "2023-07-01", "fitch_outlook_date": "2023-06-20", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        
        # Healthcare & Pharma
        {"isin": "US4781601046", "issuer": "Johnson & Johnson", "country": "US", "sector": "healthcare", "industry": "Pharmaceuticals", "moodys_rating": "Aaa", "sp_rating": "AAA", "fitch_rating": "AAA", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-05-10", "sp_rating_date": "2023-05-25", "fitch_rating_date": "2023-05-15", "moodys_outlook_date": "2023-05-10", "sp_outlook_date": "2023-05-25", "fitch_outlook_date": "2023-05-15", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        {"isin": "US7170811035", "issuer": "Pfizer Inc.", "country": "US", "sector": "healthcare", "industry": "Pharmaceuticals", "moodys_rating": "A2", "sp_rating": "A+", "fitch_rating": "A", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-04-01", "sp_rating_date": "2023-04-15", "fitch_rating_date": "2023-04-05", "moodys_outlook_date": "2023-04-01", "sp_outlook_date": "2023-04-15", "fitch_outlook_date": "2023-04-05", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        
        # Consumer & Retail
        {"isin": "US7427181091", "issuer": "Procter & Gamble Co.", "country": "US", "sector": "consumer", "industry": "Consumer Products", "moodys_rating": "Aa3", "sp_rating": "AA-", "fitch_rating": "A+", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-03-01", "sp_rating_date": "2023-03-15", "fitch_rating_date": "2023-03-05", "moodys_outlook_date": "2023-03-01", "sp_outlook_date": "2023-03-15", "fitch_outlook_date": "2023-03-05", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
        {"isin": "US1912161007", "issuer": "Coca-Cola Co.", "country": "US", "sector": "consumer", "industry": "Beverages", "moodys_rating": "A1", "sp_rating": "A+", "fitch_rating": "A+", "moodys_outlook": "stable", "sp_outlook": "stable", "fitch_outlook": "stable", "moodys_rating_date": "2023-02-10", "sp_rating_date": "2023-02-25", "fitch_rating_date": "2023-02-15", "moodys_outlook_date": "2023-02-10", "sp_outlook_date": "2023-02-25", "fitch_outlook_date": "2023-02-15", "moodys_watch": "Not on watchlist", "sp_watch": "Not on watchlist", "fitch_watch": "Not on watchlist"},
    ]
    return samples


def transform_bloomberg_data(bloomberg_data):
    """
    Transform Bloomberg field data to frontend format
    
    Args:
        bloomberg_data: Dict with Bloomberg field names
        
    Returns:
        Dict formatted for the application
    """
    
    def parse_outlook(outlook_str):
        """Parse Bloomberg outlook string to lowercase format"""
        if not outlook_str:
            return "stable"
        outlook_map = {
            "POSITIVE": "positive",
            "NEGATIVE": "negative",
            "STABLE": "stable",
            "DEVELOPING": "developing",
            "POS": "positive",
            "NEG": "negative",
            "STA": "stable",
            "DEV": "developing"
        }
        return outlook_map.get(str(outlook_str).upper(), "stable")
    
    def parse_watchlist(watch_str):
        """Parse Bloomberg watchlist status"""
        if not watch_str or watch_str == "":
            return "Not on watchlist"
        watch_upper = str(watch_str).upper()
        if "POSITIVE" in watch_upper or "UPGRADE" in watch_upper:
            return "Positive"
        elif "NEGATIVE" in watch_upper or "DOWNGRADE" in watch_upper:
            return "Negative"
        return "Not on watchlist"
    
    return {
        "isin": bloomberg_data.get("ID_ISIN", ""),
        "issuer": bloomberg_data.get("ISSUER", bloomberg_data.get("ISSUER_BULK", "")),
        "country": bloomberg_data.get("COUNTRY_ISO", ""),
        "moodys_rating": bloomberg_data.get("RTG_MOODY", ""),
        "sp_rating": bloomberg_data.get("RTG_SP", ""),
        "fitch_rating": bloomberg_data.get("RTG_FITCH", ""),
        "moodys_rating_date": bloomberg_data.get("RTG_MOODY_RATING_DATE", ""),
        "sp_rating_date": bloomberg_data.get("RTG_SP_RATING_DATE", ""),
        "fitch_rating_date": bloomberg_data.get("RTG_FITCH_RATING_DATE", ""),
        "moodys_outlook": parse_outlook(bloomberg_data.get("RTG_MOODY_OUTLOOK")),
        "sp_outlook": parse_outlook(bloomberg_data.get("RTG_SP_OUTLOOK")),
        "fitch_outlook": parse_outlook(bloomberg_data.get("RTG_FITCH_OUTLOOK")),
        "moodys_outlook_date": bloomberg_data.get("RTG_MOODY_OUTLOOK_DT", ""),
        "sp_outlook_date": bloomberg_data.get("RTG_SP_OUTLOOK_DT", ""),
        "fitch_outlook_date": bloomberg_data.get("RTG_FITCH_OUTLOOK_DT", ""),
        "moodys_watch": parse_watchlist(bloomberg_data.get("RTG_MOODY_REVIEW")),
        "sp_watch": parse_watchlist(bloomberg_data.get("RTG_SP_CREDITWATCH")),
        "fitch_watch": parse_watchlist(bloomberg_data.get("RTG_FITCH_WATCH")),
        "sector": bloomberg_data.get("GICS_SECTOR_NAME", ""),
        "industry": bloomberg_data.get("GICS_INDUSTRY_NAME", "")
    }


# API Routes

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "OK",
        "timestamp": datetime.now().isoformat(),
        "bloomberg_connected": bloomberg.session is not None
    })


@app.route('/api/connect', methods=['POST'])
def connect():
    """Initialize Bloomberg connection"""
    try:
        bloomberg.connect()
        return jsonify({
            "success": True,
            "message": "Connected to Bloomberg Terminal"
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/bonds', methods=['GET'])
def get_bonds():
    """
    Fetch all USD bonds with credit rating data from Bloomberg.
    NO DEMO MODE - returns error if Bloomberg data unavailable.
    
    Query params:
        - limit: Max number of bonds to return (default: 3000)
    """
    try:
        limit = int(request.args.get('limit', 3000))
        
        # Strict mode: No demo fallback
        if not bloomberg.session:
            logger.error("Bloomberg Terminal not connected")
            return jsonify({
                "error": "Bloomberg Terminal not connected. Please ensure Bloomberg is running and logged in.",
                "bonds": [],
                "count": 0,
                "mode": "error"
            }), 503
        
        # Screen for bonds
        isins = screen_usd_bonds()
        
        if isins == "LIMIT_REACHED":
            return jsonify({
                "error": "Bloomberg Daily Data Limit Reached (Error -4001). Please wait for limit reset or check Terminal settings.",
                "bonds": [],
                "count": 0,
                "mode": "error"
            }), 429
            
        if not isins:
            logger.error("No bonds found in screening")
            return jsonify({
                "error": "Failed to screen bonds from Bloomberg. Check terminal permissions.",
                "bonds": [],
                "count": 0,
                "mode": "error"
            }), 503
        
        # Limit results
        isins = isins[:limit]
        logger.info(f"Fetching data for {len(isins)} securities...")
        
        # Define Bloomberg fields to fetch
        fields = [
            "ID_ISIN",
            "ISSUER",
            "ISSUER_BULK",
            "COUNTRY_ISO",
            "RTG_MOODY",
            "RTG_SP",
            "RTG_FITCH",
            "RTG_MOODY_RATING_DATE",
            "RTG_SP_RATING_DATE",
            "RTG_FITCH_RATING_DATE",
            "RTG_MOODY_OUTLOOK",
            "RTG_SP_OUTLOOK",
            "RTG_FITCH_OUTLOOK",
            "RTG_MOODY_OUTLOOK_DT",
            "RTG_SP_OUTLOOK_DT",
            "RTG_FITCH_OUTLOOK_DT",
            "RTG_MOODY_REVIEW",
            "RTG_SP_CREDITWATCH",
            "RTG_FITCH_WATCH",
            "GICS_SECTOR_NAME",
            "GICS_INDUSTRY_NAME"
        ]
        
        # Fetch data from Bloomberg
        bloomberg_data = fetch_reference_data(isins, fields)
        
        if not bloomberg_data:
            logger.error("No data returned from Bloomberg")
            return jsonify({
                "error": "Bloomberg returned no data. Securities may be invalid or permissions missing.",
                "bonds": [],
                "count": 0,
                "mode": "error"
            }), 503
        
        # Transform to application format
        bonds = [transform_bloomberg_data(data) for data in bloomberg_data.values()]
        
        # DEBUG: Log first bond if available
        if bonds:
            logger.info(f"Sample transformed bond: {bonds[0]}")
        
        # Filter out bonds with no issuer name (invalid data)
        valid_bonds = [b for b in bonds if b.get('issuer') and b.get('issuer') != '']
        
        logger.info(f"Filtered {len(bonds) - len(valid_bonds)} bonds with empty issuer names. {len(valid_bonds)} valid bonds remaining.")
        
        if not valid_bonds:
            logger.error("All bonds have empty issuer names - data quality issue")
            # DEBUG: Log raw Bloomberg data for first few items
            sample_keys = list(bloomberg_data.keys())[:5]
            for k in sample_keys:
                logger.info(f"Raw Bloomberg data for {k}: {bloomberg_data[k]}")
            return jsonify({
                "error": "Bloomberg returned data but all issuer fields are empty. Check security identifiers.",
                "bonds": [],
                "count": 0,
                "mode": "error"
            }), 503
        
        logger.info(f"Successfully fetched {len(valid_bonds)} bonds with valid data")
        
        return jsonify({
            "bonds": valid_bonds,
            "count": len(valid_bonds),
            "timestamp": datetime.now().isoformat(),
            "mode": "live"
        })
        
    except Exception as e:
        logger.error(f"Error fetching bonds: {str(e)}")
        return jsonify({
            "error": f"Bloomberg API error: {str(e)}",
            "bonds": [],
            "count": 0,
            "mode": "error"
        }), 500


@app.route('/api/bonds/<isin>', methods=['GET'])
def get_bond_by_isin(isin):
    """Get specific bond data by ISIN"""
    try:
        if not bloomberg.session:
            return jsonify({"error": "Bloomberg not connected"}), 503
        
        fields = [
            "ID_ISIN", "ISSUER", "COUNTRY_ISO",
            "RTG_MOODY", "RTG_SP", "RTG_FITCH",
            "RTG_MOODY_OUTLOOK", "RTG_SP_OUTLOOK", "RTG_FITCH_OUTLOOK"
        ]
        
        data = fetch_reference_data([isin], fields)
        
        if isin in data:
            return jsonify(transform_bloomberg_data(data[isin]))
        else:
            return jsonify({"error": "Bond not found"}), 404
            
    except Exception as e:
        logger.error(f"Error fetching bond {isin}: {str(e)}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    
    # Try to connect on startup
    try:
        bloomberg.connect()
    except Exception as e:
        logger.warning(f"Could not connect to Bloomberg on startup: {str(e)}")
        logger.warning("Service will run in demo mode")
    
    app.run(host='0.0.0.0', port=port, debug=True)
