package main

import (
	"fmt"
	"log"
	"time"

	"github.com/angel-one/smartapigo"
	"github.com/pquerna/otp/totp"
)

// ==============================================================================
// Angel One Smart API Go Example
// Dependencies: 
//   go get github.com/angel-one/smartapigo
//   go get github.com/pquerna/otp/totp
// ==============================================================================

func main() {
	apiKey := "YOUR_API_KEY"
	clientCode := "YOUR_CLIENT_CODE"
	password := "YOUR_PASSWORD"
	totpSecret := "YOUR_TOTP_SECRET_KEY" // Secret key provided by Angel One for TOTP

	// 1. Initialize SmartApi Client
	client := smartapigo.New(clientCode, password, apiKey)

	// 2. Generate TOTP using pquerna/otp
	totpCode, err := totp.GenerateCode(totpSecret, time.Now())
	if err != nil {
		log.Fatalf("Error generating TOTP: %v", err)
	}
	fmt.Printf("Generated current TOTP: %s\n", totpCode)

	// 3. Generate Session
	session, err := client.GenerateSession(totpCode)
	if err != nil {
		log.Fatalf("Authentication failed: %v", err)
	}

	fmt.Printf("Authentication Successful!\n")
	fmt.Printf("User Profile: %+v\n", session.UserToken)

	// 4. Place a Limit Buy Order
	orderParams := smartapigo.OrderParams{
		Variety:         "NORMAL",
		TradingSymbol:   "SBIN-EQ",
		SymbolToken:     "3045",
		TransactionType: "BUY",
		Exchange:        "NSE",
		OrderType:       "LIMIT",
		ProductType:     "DELIVERY",
		Duration:        "DAY",
		Price:           "650.00",
		Quantity:        "5",
	}

	orderResponse, err := client.PlaceOrder(orderParams)
	if err != nil {
		log.Fatalf("Order Placement failed: %v", err)
	}

	fmt.Printf("Order Placed Successfully. Order ID: %s\n", orderResponse.OrderID)
}
