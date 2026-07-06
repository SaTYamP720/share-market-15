import com.angelbroking.smartapi.SmartConnect;
import com.angelbroking.smartapi.models.OrderParams;
import com.angelbroking.smartapi.models.User;
import org.jboss.aerogear.security.otp.Totp;

// ==============================================================================
// Angel One Smart API Java Example
// Maven Dependencies:
//   <dependency>
//       <groupId>com.github.angelbroking</groupId>
//       <artifactId>smartapi-java</artifactId>
//       <version>1.0.0</version> <!-- Check latest release -->
//   </dependency>
//   <dependency>
//       <groupId>org.jboss.aerogear</groupId>
//       <artifactId>aerogear-otp-java</artifactId>
//       <version>1.0.0</version>
//   </dependency>
// ==============================================================================

public class java_example {
    public static void main(String[] args) {
        String apiKey = "YOUR_API_KEY";
        String clientCode = "YOUR_CLIENT_CODE";
        String password = "YOUR_PASSWORD";
        String totpSecret = "YOUR_TOTP_SECRET_KEY"; // Secret key provided by Angel One for TOTP

        // 1. Initialize SmartConnect Instance
        SmartConnect smartConnect = new SmartConnect();
        smartConnect.setApiKey(apiKey);

        try {
            // 2. Generate TOTP using Aerogear library
            Totp totpObj = new Totp(totpSecret);
            String totp = totpObj.now();
            System.out.println("Generated current TOTP: " + totp);

            // 3. Generate Session
            User user = smartConnect.generateSession(clientCode, password, totp);

            if (user != null && user.getJwtToken() != null) {
                System.out.println("Authentication Successful!");
                System.out.println("Welcome, " + user.getUserName());
                System.out.println("JWT Token: " + user.getJwtToken());

                // 4. Place a Limit Buy Order
                OrderParams orderParams = new OrderParams();
                orderParams.variety = "NORMAL";
                orderParams.tradingSymbol = "SBIN-EQ";
                orderParams.symbolToken = "3045";
                orderParams.transactionType = "BUY";
                orderParams.exchange = "NSE";
                orderParams.orderType = "LIMIT";
                orderParams.productType = "DELIVERY";
                orderParams.duration = "DAY";
                orderParams.price = "650.00";
                orderParams.quantity = "5";

                // Execute Placement
                User orderResponse = smartConnect.placeOrder(orderParams, "NORMAL");
                System.out.println("Order Placed successfully! Order ID: " + orderResponse.getOrderId());
            } else {
                System.out.println("Authentication failed. Please verify credentials.");
            }
        } catch (Exception e) {
            System.out.println("An error occurred: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
