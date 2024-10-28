const express = require('express');
const { dbConnect } = require('./utiles/db');
const app = express();
const cors = require('cors');
const http = require('http');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const socket = require('socket.io');

const server = http.createServer(app);

// CORS setup
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://drinks-shop-c475.onrender.com', // Frontend
        'https://drinks-shop-a23d.onrender.com', // Backend
    ],
    credentials: true,
}));

// Socket.io CORS configuration
const io = socket(server, {
    cors: {
        origin: '*',
        credentials: true,
    },
});

// Arrays to hold active users
let allCustomer = [];
let allSeller = [];
let admin = {};

// User management functions
const addUser = (customerId, socketId, userInfo) => {
    if (!allCustomer.some(u => u.customerId === customerId)) {
        allCustomer.push({ customerId, socketId, userInfo });
    }
};

const addSeller = (sellerId, socketId, userInfo) => {
    if (!allSeller.some(u => u.sellerId === sellerId)) {
        allSeller.push({ sellerId, socketId, userInfo });
    }
};

const findCustomer = (customerId) => allCustomer.find(c => c.customerId === customerId);
const findSeller = (sellerId) => allSeller.find(c => c.sellerId === sellerId);

const remove = (socketId) => {
    allCustomer = allCustomer.filter(c => c.socketId !== socketId);
    allSeller = allSeller.filter(c => c.socketId !== socketId);
};

const removeAdmin = (socketId) => {
    if (admin.socketId === socketId) admin = {};
};

// Socket.io event handlers
io.on('connection', (soc) => {
    console.log('socket server is connected...');

    soc.on('add_user', (customerId, userInfo) => {
        addUser(customerId, soc.id, userInfo);
        io.emit('activeSeller', allSeller);
        io.emit('activeCustomer', allCustomer);
    });

    soc.on('add_seller', (sellerId, userInfo) => {
        addSeller(sellerId, soc.id, userInfo);
        io.emit('activeSeller', allSeller);
        io.emit('activeCustomer', allCustomer);
        io.emit('activeAdmin', { status: true });
    });

    soc.on('add_admin', (adminInfo) => {
        delete adminInfo.email;
        admin = { ...adminInfo, socketId: soc.id };
        io.emit('activeSeller', allSeller);
        io.emit('activeAdmin', { status: true });
    });

    soc.on('send_seller_message', (msg) => {
        const customer = findCustomer(msg.receverId);
        if (customer) soc.to(customer.socketId).emit('seller_message', msg);
    });

    soc.on('send_customer_message', (msg) => {
        const seller = findSeller(msg.receverId);
        if (seller) soc.to(seller.socketId).emit('customer_message', msg);
    });

    soc.on('send_message_admin_to_seller', msg => {
        const seller = findSeller(msg.receverId);
        if (seller) soc.to(seller.socketId).emit('receved_admin_message', msg);
    });

    soc.on('send_message_seller_to_admin', msg => {
        if (admin.socketId) soc.to(admin.socketId).emit('receved_seller_message', msg);
    });

    soc.on('disconnect', () => {
        console.log('user disconnect');
        remove(soc.id);
        removeAdmin(soc.id);
        io.emit('activeAdmin', { status: false });
        io.emit('activeSeller', allSeller);
        io.emit('activeCustomer', allCustomer);
    });
});

// Middleware setup
app.use(bodyParser.json());
app.use(cookieParser());

// Define routes
app.use('/api', require('./routes/chatRoutes'));
app.use('/api', require('./routes/paymentRoutes'));
app.use('/api', require('./routes/bannerRoutes'));
app.use('/api', require('./routes/dashboard/dashboardIndexRoutes'));
app.use('/api/home', require('./routes/home/homeRoutes'));
app.use('/api', require('./routes/order/orderRoutes'));
app.use('/api', require('./routes/home/cardRoutes'));
app.use('/api', require('./routes/authRoutes'));
app.use('/api', require('./routes/home/customerAuthRoutes'));
app.use('/api', require('./routes/dashboard/sellerRoutes'));
app.use('/api', require('./routes/dashboard/categoryRoutes'));
app.use('/api', require('./routes/dashboard/productRoutes'));

app.get('/', (req, res) => res.send('Hello World!'));

// CORS handling for custom origins
app.use((req, res, next) => {
    const allowedOrigins = [
        process.env.FRONTEND,
        process.env.TESTHOST,
        process.env.DASHBOARD,
        'https://drinks-shop-c475.onrender.com',
        'https://drinks-shop-a23d.onrender.com'
    ];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin) || origin === '*') {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        res.header('Access-Control-Allow-Credentials', true);
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    }
    next();
});

// Connect to database and start server
dbConnect();
const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server is running on port ${port}!`));
