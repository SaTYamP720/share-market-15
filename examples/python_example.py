import pyotp
from SmartApi import SmartConnect

# ==============================================================================
# Angel One Smart API Python Example
# Dependencies: pip install smartapi-python pyotp
# ==============================================================================

# 1. Initialize SmartConnect Instance
API_KEY = "YOUR_API_KEY"
CLIENT_ID = "YOUR_CLIENT_ID"
PASSWORD = "YOUR_PASSWORD"
TOTP_SECRET = "YOUR_TOTP_SECRET_KEY"  # Secret key provided by Angel One for TOTP

smart_conn = SmartConnect(api_key=API_KEY)

try:
    # 2. Generate TOTP using pyotp
    totp = pyotp.TOTP(TOTP_SECRET).now()
    print(f"Generated current TOTP: {totp}")

    # 3. Authenticate and Generate Session
    session_data = smart_conn.generateSession(CLIENT_ID, PASSWORD, totp)
    print("Authentication Successful!")
    print(f"JWT Token: {session_data['data']['jwtToken']}")
    print(f"Refresh Token: {session_data['data']['refreshToken']}")
    print(f"Feed Token: {session_data['data']['feedToken']}")

    # 4. Fetch Profile Details
    profile = smart_conn.getProfile(session_data['data']['refreshToken'])
    print(f"Profile Name: {profile['data']['name']}")
    print(f"Email: {profile['data']['email']}")

    # 5. Fetch Holdings
    holdings = smart_conn.holding()
    print("Holdings Fetched Successfully:", holdings)

    # 6. Place a Limit Buy Order
    order_params = {
        "variety": "NORMAL",
        "tradingsymbol": "SBIN-EQ",
        "symboltoken": "3045",  # Token for SBIN-EQ
        "transactiontype": "BUY",
        "exchange": "NSE",
        "ordertype": "LIMIT",
        "producttype": "DELIVERY",
        "duration": "DAY",
        "price": "650.00",
        "quantity": "5"
    }
    
    order_id = smart_conn.placeOrder(order_params)
    print(f"Order placed successfully! Order ID: {order_id}")

except Exception as e:
    print(f"An error occurred: {e}")
