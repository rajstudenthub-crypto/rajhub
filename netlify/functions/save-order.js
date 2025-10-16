
const admin = require('firebase-admin');

// Netlify Environment Variable থেকে Firebase Admin কনফিগারেশন লোড করা হচ্ছে।
const serviceAccountString = process.env.FIREBASE_ADMIN_CONFIG;

if (!serviceAccountString) {
    throw new Error('Firebase Admin config not found in environment variables.');
}

const serviceAccount = JSON.parse(serviceAccountString);

// Firebase Admin কে শুধুমাত্র একবার initialize করা।
if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// Netlify Function Handler
exports.handler = async (event, context) => {
    
    // শুধুমাত্র POST রিকোয়েস্ট allow করা হচ্ছে।
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: "Method Not Allowed. Use POST." }),
        };
    }
    
    let orderData;
    try {
        // ফ্রন্টএন্ড থেকে আসা JSON ডেটা পার্স করা।
        orderData = JSON.parse(event.body);
    } catch (e) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Invalid JSON format in request body." }),
        };
    }
    
    // প্রয়োজনীয় ফিল্ড ভ্যালিডেট করা।
    const { name, phone, address, product_id, product_name, total_price, payment_method } = orderData;
    
    if (!name || !phone || !address || !product_id || !payment_method) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Missing required order fields." }),
        };
    }

    // অর্ডার অবজেক্ট তৈরি করা।
    const newOrder = {
        customerName: name,
        customerPhone: phone,
        deliveryAddress: address,
        productDetails: {
            id: product_id,
            name: product_name,
            price: total_price
        },
        paymentMethod: payment_method,
        // MFS-এর জন্য পেমেন্টের প্রাথমিক স্ট্যাটাস: Pending Confirmation
        paymentStatus: 'Pending Confirmation (MFS)', 
        orderStatus: 'New Order',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
        // 'orders' কালেকশনে ডেটা সেভ করা।
        const docRef = await db.collection('orders').add(newOrder);

        // সফল হলে Response
        return {
            statusCode: 200,
            headers: {
                // CORS সমস্যার জন্য এই হেডারটি দরকার হতে পারে।
                'Access-Control-Allow-Origin': '*', 
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: JSON.stringify({ 
                message: "Order placed successfully and saved to Firestore.", 
                orderId: docRef.id 
            }),
        };

    } catch (error) {
        console.error("Firestore Save Error:", error);
        // ত্রুটি হলে Response
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to save order to database.", error: error.message }),
        };
    }
};
