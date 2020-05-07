
const functions = require('firebase-functions');
const math = require('mathjs');

const admin = require('firebase-admin');
admin.initializeApp();

exports.orderCreatedListener = functions
    .region('asia-east2')
    .firestore    
    .document('orders/{order}')
    .onCreate((snap, context) => {
        const newValue = snap.data();

        const name = newValue.orderAmount;
        console.log('Push notification event triggered for topic  ' + newValue.cart.shopInfo.id);
        var registrationToken = 'YOUR_REGISTRATION_TOKEN';
        
        const payload = {           
            
            "data": {
                title: "QWIKLY New Order: ",
                orderAmount: "Rs." + newValue.orderTotalAmount,
                location: newValue.buyerInfo.deliveryAddress.apartmentName + " " + newValue.buyerInfo.deliveryAddress.areaDetails,
                notificationType: "order"
            },
            "notification": {
                "body": "Rs." + newValue.orderTotalAmount,
                "title": "QWIKLY New Order"                
            },
            android: {
                notification: {
                    sound: 'default',
                    click_action: '.HomeActivity',
                    "priority": 'max'
                    
                },
            },

            topic: newValue.cart.shopInfo.id
        };

        const options = {
            priority: "high",
            timeToLive: 60 * 60 * 24
        };
        return admin.messaging().send(payload);
           
    });

exports.chatReceivedFromBuyerListener = functions
    .region('asia-east2')
    .firestore
    .document('chats/{chat}')
    .onUpdate((snap, context) => {
        // Get an object representing the document
        // e.g. {'name': 'Marie', 'age': 66}
        const message = snap.after.data();
        const newMessage = message.latestMessage;
        const user = message.senderName;
        const time = message.timeStamp;
        const receiver = message.receiverId;
        //const order = context.params.order;


        // access a particular field as you would any JS property
        //const name = newValue.orderAmount;
        console.log('Push notification event triggered for topic  ' + receiver + "   " + newMessage);
        var registrationToken = 'YOUR_REGISTRATION_TOKEN';

        // Create a notification
        const payload = {
            "data": {
                title: user,
                message: newMessage,
                time: time,
                notificationType: "chat"
                //"image": "https://i.postimg.cc/XqNSCWK2/qwiklytemplogo.png"
                //location: newValue.currentLocation.map("mapAddress")
            },
            "notification": {
                "body": newMessage,
                "title": "New message from " + user + "        " + time

                //"image": "https://i.postimg.cc/XqNSCWK2/qwiklytemplogo.png"

            },
            android: {
                notification: {
                    sound: 'default',
                    click_action: '.MainActivity',
                    "priority": 'max'

                },
            },
            topic: receiver
        };

        //Create an options object that contains the time to live for the notification and the priority
        const options = {
            priority: "high",
            timeToLive: 60 * 60 * 24
        };


        return admin.messaging().send(payload);

    });


exports.getAdditionalFees = functions.region('asia-east2').https.onCall((data, context) => {
    const QWIKLY_BUYER_FEE_PERCENT = 1;
    const QWIKLY_SELLER_FEE_PERCENT = 1;
    const GST_FEE_PERCENT = 18;
    const GATEWAY_FEE_PERCENT = 2;
    const GST_GATEWAY_FEE = 18;
    var deliveryMap = new Map();
    deliveryMap.set(50, 20);
    deliveryMap.set(100, 20);
    deliveryMap.set(149, 15);
    deliveryMap.set(199, 10);
    var itemAmount = data.itemAmount;
    var shopId = data.shopId;
    var deliveryFee = 0;
    var convenienceFee = 0;
    var qwiklyBuyerFee = 0;
    var qwiklySellerFee = 0;
    var GST = 0;
    var gatewayFee = 0;
    var grossAmount = 0;
    var netAmountBeforeGatewayFee;
    var gstOnGatewayFee;
    var totalAmount;
    var sellerExtraFees;
    var str = "";
    var billingJSONObj = [];
    var keys = [...deliveryMap.keys()];
    keys.sort((a, b) => { return a - b });
    var i;

    GST = 0; //(itemAmount * GST_FEE_PERCENT) / 100;
    grossAmount = Number(itemAmount) + Number(GST);
    if (itemAmount > 0) {
        for (i = 1; i < keys.length; i++) {
            if (keys[i] > grossAmount) {
                console.log("keys " + keys[i]);
                console.log("delivery map " + deliveryMap.get(keys[i]));
                deliveryFee = deliveryMap.get(keys[i]);
                deliveryFee = Number(deliveryFee);
                break;
            }
        }
    }
    
    qwiklyBuyerFee = (grossAmount * QWIKLY_BUYER_FEE_PERCENT) / 100;
    qwiklySellerFee = (grossAmount * QWIKLY_SELLER_FEE_PERCENT) / 100;
    netAmountBeforeGatewayFee = Number(grossAmount) + Number(deliveryFee) + Number(qwiklyBuyerFee);
    gatewayFee = (netAmountBeforeGatewayFee * GATEWAY_FEE_PERCENT) / 100;
    gstOnGatewayFee = (gatewayFee * GST_GATEWAY_FEE) / 100;
    //To be implemented after payments on the platform is enabled
    //convenienceFee = Number(deliveryFee) + Number(qwiklyBuyerFee) + Number(gatewayFee) + Number(gstOnGatewayFee);
    convenienceFee = Number(deliveryFee);
    totalAmount = Number(grossAmount) + Number(convenienceFee);
    sellerExtraFees = Number(deliveryFee);

    //str = '{ "title": "Item Total", "value": ' + itemAmount + ', "display": true }';
    //billingJSONObj = JSON.parse(str);
    billingJSONObj.push({ "title": "Item Total", "value": math.round(itemAmount, 2), "display": true });
    //billingJSONObj.push({ "title": "GST", "value": math.round(GST, 2), "display": true });
    billingJSONObj.push({ "title": "Convenience Fee", "value": math.round(convenienceFee, 2), "display": true });
    billingJSONObj.push({ "title": "Total", "value": math.round(totalAmount, 2), "display": true });
    billingJSONObj.push({ "title": "Qwikly Buyer Fee", "value": math.round(qwiklyBuyerFee, 2), "display": false });
    billingJSONObj.push({ "title": "Qwikly Seller Fee", "value": math.round(qwiklySellerFee, 2), "display": false });
    billingJSONObj.push({ "title": "Payment Gateway Fee", "value": math.round(gatewayFee, 2), "display": false });
    billingJSONObj.push({ "title": "GST Payment Gateway Fee", "value": math.round(gstOnGatewayFee, 2), "display": false });
    billingJSONObj.push({ "title": "Delivery Fee", "value": math.round(deliveryFee, 2), "display": false });
    billingJSONObj.push({ "title": "Seller Extra Fee", "value": math.round(sellerExtraFees, 2), "display": false });

    console.log(deliveryFee + ", " + qwiklyBuyerFee + ", " + gatewayFee + ", " + gstOnGatewayFee + ", " + convenienceFee);
    var detailedBill = JSON.stringify(billingJSONObj);
    console.log("delivery fee " + deliveryFee);
    console.log("Detailed Bill: " + detailedBill);
    return detailedBill;
});


exports.getFAQ = functions.region('asia-east2').https.onCall((data, context) => {    
    var faqJSONObj = [];
    var questions = [];
    var answers = [];
    var contactList = [];
    var finalJSON = [];

    questions[0] = "I have not received my order";
    questions[1] = "My order is getting delayed";
    questions[2] = "Items received does not match my order";
    questions[3] = "Some items I have received are sub-standard, stale or expired";
    questions[4] = "I want to change the order";
    questions[5] = "I want to cancel the order";
    questions[6] = "I am expecting a refund";
    questions[7] = "Seller is not responding to my query";
    questions[8] = "I am a seller and want to partner with Qwikly";
    questions[9] = "Seller has charged me a different price than whats mentioned in the app";

    answers[0] = "Orders should typically arrive within 45-60 mins. If there is a delay, please contact the seller via chat or phone. \"Seller Chat\" and \"Call Seller\" is available in the shop screen";
    answers[1] = "If the order is delayed beyond 60 mins, please contact seller via Chat or Phone. \"Seller Chat\" and \"Call Seller\" is available in the shop screen";
    answers[2] = "In case of item mismatch, inform the seller via chat or phone. He will make the necessary arrangements to replace the items.";
    answers[3] = "If any of the items are expired or sub-standard, please inform the seller via chat or phone. He will replace them. If there are multiple instances of a seller providing expired or sub-standard products, please bring it to our notice via email - qwikly3@gmail.com";
    answers[4] = "Order cannot be modified by the buyer once it has been placed. However, you can contact the seller via chat or phone and request to modify the order.";
    answers[5] = "Buyer cannot cancel the order once it has been placed. In extraordinary situations where the order has been delayed beyond expected time without notification from seller, a request can be placed with the seller or Qwikly customer care to cancel the order";
    answers[6] = "Refunds can take up to 3 working days to be processed. Please contact Qwikly customer care if delay is beyond 3 working days (weekends and public holidays are not working days";
    answers[7] = "Sometimes sellers are busy serving over the counter customers, hence they may not respond immediately. Please contact the seller after some time. In case the seller does not respond for a prolonged period and there is no update on your order, please contact Qwikly customere care";
    answers[8] = "If you are a seller and want to join Qwikly mobile platform to sell your items, please contact/Whatsapp Qwikly at +91-9380854679 or email at qwikly3@gmail.com";
    answers[9] = "Prices of some items like fruits, vegetables and groceries vary periodically. The app may not reflect the current prices, hence there could be a difference in the price quoted by the seller";

    var i;
    for (i = 0; i < 10; i++) {
        faqJSONObj.push({ "title": questions[i], "value": answers[i]});
    }
    contactList.push({ "title": "email", "value": "qwikly3@gmail.com" });
    contactList.push({ "title": "whatsapp", "value": "+91-9380854679" });
    contactList.push({ "title": "phone", "value": "+91-9380854679" });

    finalJSON.push({ "title": "faq", "value": faqJSONObj });
    finalJSON.push({ "title": "contacts", "value": contactList });

    var faq = JSON.stringify(finalJSON);    
    console.log(faq);
    return faq;
});


exports.orderStatusUpdateListener = functions
    .region('asia-east2')
    .firestore
    .document('orderstest/{order}')
    .onUpdate((snap, context) => {
        const newValue = snap.after.data();
        const oldValue = snap.before.data();
        const name = newValue.orderAmount;
        console.log('Push notification event triggered for topic  ' + newValue.cart.shopInfo.id + "  " + newValue.status);
        var registrationToken = 'YOUR_REGISTRATION_TOKEN';

        const payload = {

            "data": {
                title: "Order Status Changed: ",
                orderNumber: "Order# " + newValue.orderNumber,
                orderAmount: "Rs." + newValue.orderTotalAmount,
                orderStatus: newValue.status,
                shopName: newValue.cart.shopInfo.name,
                orderId: newValue.orderId,
                notificationType: "orderstatus"
            },
            "notification": {
                "body": newValue.status,
                "title": "Order Status Changed - " + newValue.cart.shopInfo.name
            },
            android: {
                notification: {
                    sound: 'default',
                    click_action: '.HomeActivity',
                    "priority": 'max'
                },
            },

            topic: newValue.buyerInfo.id
        };
        console.log("topic: " + newValue.buyerInfo.id);
        const options = {
            priority: "high",
            timeToLive: 60 * 60 * 24
        };
        if (newValue.status !== oldValue.status) {
            return admin.messaging().send(payload);
        }
        else
            return null;

    });

exports.deliveryPartnerOrderAssignedListener = functions
    .region('asia-east2')
    .firestore
    .document('orderstest/{order}')
    .onUpdate((snap, context) => {
        const newValue = snap.after.data();
        const oldValue = snap.before.data();
        const name = newValue.orderAmount;
        console.log('Push notification event triggered for topic  ' + newValue.cart.shopInfo.id + "  " + newValue.status);
        var registrationToken = 'YOUR_REGISTRATION_TOKEN';

        const payload = {

            "data": {
                title: "New Order Assigned: ",
                orderNumber: "Order# " + newValue.orderNumber,
                orderAmount: "Rs." + newValue.orderTotalAmount,
                location: newValue.buyerInfo.deliveryAddress.apartmentName + " " + newValue.buyerInfo.deliveryAddress.areaDetails,
                orderId: newValue.orderId,
                notificationType: "deliveryPartnerAssigned"
            },
            "notification": {
                "body": newValue.status,
                "title": "Order Status Changed - " + newValue.cart.shopInfo.name
            },
            android: {
                notification: {
                    sound: 'default',
                    click_action: '.HomeActivity',
                    "priority": 'max'
                },
            },

            topic: newValue.deliveryPartner.mobile
        };
        console.log("topic: " + newValue.deliveryPartner.mobile);
        const options = {
            priority: "high",
            timeToLive: 60 * 60 * 24
        };
        if ((oldValue.deliveryPartner === null) && (newValue.deliveryPartner !== null)) {
            return admin.messaging().send(payload);
        }
        else
            return null;

    });



exports.orderCreatedListener_TestCollection = functions
    .region('asia-east2')
    .firestore
    .document('orderstest/{order}')
    .onCreate((snap, context) => {
        const newValue = snap.data();

        const name = newValue.orderAmount;
        console.log('Push notification event triggered for topic  ' + newValue.cart.shopInfo.id);
        var registrationToken = 'YOUR_REGISTRATION_TOKEN';

        const payload = {

            "data": {
                title: "QWIKLY New Order: ",
                orderAmount: "Rs." + newValue.orderTotalAmount,
                location: newValue.buyerInfo.deliveryAddress.apartmentName + " " + newValue.buyerInfo.deliveryAddress.areaDetails,
                notificationType: "order"
            },
            "notification": {
                "body": "Rs." + newValue.orderTotalAmount,
                "title": "QWIKLY New Order"
            },
            android: {
                notification: {
                    sound: 'default',
                    click_action: '.HomeActivity',
                    "priority": 'max'

                },
            },

            topic: newValue.cart.shopInfo.id
        };

        const options = {
            priority: "high",
            timeToLive: 60 * 60 * 24
        };
        return admin.messaging().send(payload);

    });
