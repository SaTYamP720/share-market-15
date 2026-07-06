# ==============================================================================
# Angel One Smart API R Example (Direct HTTP REST API Integration)
# Dependencies: install.packages(c("httr", "jsonlite", "rotp"))
# ==============================================================================

library(httr)
library(jsonlite)
library(rotp) # For generating TOTP codes

# 1. Credentials
api_key <- "YOUR_API_KEY"
client_code <- "YOUR_CLIENT_CODE"
password <- "YOUR_PASSWORD"
totp_secret <- "YOUR_TOTP_SECRET_KEY" # Secret key provided by Angel One for TOTP

# 2. Generate TOTP
# rotp handles Time-based One-Time Passwords
totp_code <- rotp::totp(totp_secret)
print(paste("Generated current TOTP:", totp_code))

# 3. Headers Required by SmartAPI
headers <- add_headers(
  `Content-Type` = "application/json",
  `Accept` = "application/json",
  `X-UserType` = "USER",
  `X-SourceID` = "WEB",
  `X-ClientLocalIP` = "192.168.1.100",  # Your local IP
  `X-ClientPublicIP` = "106.51.151.22",  # Your public IP
  `X-MACAddress` = "02:00:00:00:00:00",  # Device MAC Address
  `X-PrivateKey` = api_key
)

# 4. Authenticate & Create Session
login_url <- "https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword"
login_payload <- list(
  clientcode = client_code,
  password = password,
  totp = totp_code
)

response <- POST(
  url = login_url,
  body = toJSON(login_payload, auto_unbox = TRUE),
  headers,
  encode = "json"
)

result <- content(response, as = "parsed", type = "application/json")

if (result$status == TRUE) {
  print("Authentication Successful!")
  
  jwt_token <- result$data$jwtToken
  refresh_token <- result$data$refreshToken
  feed_token <- result$data$feedToken
  
  # Update headers for subsequent requests to include Auth JWT Token
  auth_headers <- add_headers(
    `Content-Type` = "application/json",
    `Accept` = "application/json",
    `X-UserType` = "USER",
    `X-SourceID` = "WEB",
    `X-ClientLocalIP` = "192.168.1.100",
    `X-ClientPublicIP` = "106.51.151.22",
    `X-MACAddress` = "02:00:00:00:00:00",
    `X-PrivateKey` = api_key,
    `Authorization` = paste("Bearer", jwt_token)
  )
  
  # 5. Place a Limit Buy Order
  order_url <- "https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/placeOrder"
  order_payload <- list(
    variety = "NORMAL",
    tradingsymbol = "SBIN-EQ",
    symboltoken = "3045",
    transactiontype = "BUY",
    exchange = "NSE",
    ordertype = "LIMIT",
    producttype = "DELIVERY",
    duration = "DAY",
    price = "650.00",
    quantity = "5"
  )
  
  order_response <- POST(
    url = order_url,
    body = toJSON(order_payload, auto_unbox = TRUE),
    auth_headers,
    encode = "json"
  )
  
  order_result <- content(order_response, as = "parsed", type = "application/json")
  print("Order Response:")
  print(order_result)
  
} else {
  print("Authentication Failed:")
  print(result$message)
}
