const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const {createWebRtcTransport, updateTransportSettings, cleanUpTransports} = require('./core/transport');
const {startWorker} = require('./core/mediasoup');
const jwt = require("jsonwebtoken")

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const transportMap = new Map();
const producerMap = new Map();

let router;
startWorker().then(router => {
    global.router = router; // Make the router globally available
}).catch(error => {
    console.error(error);
});

app.get('/', (req, res) => {
    res.send('MediaSoup server is running...');
});

io.use((socket, next) => {
    const token = socket.handshake.query.token;
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error('Authentication error'));
        socket.decoded = decoded; // Save the decoded info for use in your handlers
        next();
    });
});

io.on('connection', async (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('createTransport', async (callback) => {
        try {
            // Create a WebRTC transport for the client
            let {transport, params} = await createWebRtcTransport(router);
            transportMap.set(transport.id, transport);

            // Store the transport with the client's socket ID
            storeClientTransport(socket.id, transport.id);

            callback({params});

            // Listen to the event when transport is connected to start consuming
            transport.on('connect', async ({dtlsParameters}, callback, errback) => {
                try {
                    await transport.connect({dtlsParameters});
                    callback();
                } catch (error) {
                    errback(error);
                }
            });
        } catch (error) {
            console.error('Error creating transport', error);
            callback({error: error.message});
            socket.emit('errorResponse', {error: 'Error creating transport.'});
        }
    });

    socket.on('produce', async ({transportId, kind, rtpParameters}, callback) => {
        try {
            const producerTransport = transportMap.get(transportId);
            if (!producerTransport) {
                callback({error: 'Transport not found'});
                return;
            }
            const producer = await producerTransport.produce({kind, rtpParameters});
            producerMap.set(producer.id, producer);
            callback({id: producer.id});
        } catch (error) {
            console.error('Error producing transport', error);
            callback({error: error.message});
            socket.emit('errorResponse', {error: 'Error producing transport.'});
        }
    });

    // Handler for client's consume request
    socket.on('consume', async ({transportId, producerId}, callback) => {
        try {
            const consumerTransport = transportMap.get(transportId);
            if (!consumerTransport) {
                callback({error: 'Transport not found'});
                return;
            }
            const producer = producerMap.get(producerId);
            if (!producer) {
                callback({error: 'Producer not found'});
                return;
            }
            const consumer = await consumerTransport.consume({
                producerId,
                rtpCapabilities: router.rtpCapabilities, // Assume router is globally accessible
                paused: true, // Start in paused mode
            });
            // Add the consumer to some collection if needed, manage consumers, etc.
            callback({
                id: consumer.id,
                producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
            });
        } catch (error) {
            console.error('Error consuming transport', error);
            callback({error: error.message});
            socket.emit('errorResponse', {error: 'Error consuming transport.'});
        }
    });

    socket.on('closeTransport', ({transportId}, callback) => {
        try {
            const transport = transportMap.get(transportId);
            if (transport) {
                transport.close();
                transportMap.delete(transportId);

                // Remove the transport from the client's list
                removeClientTransport(socket.id, transportId);
            }
        } catch (error) {
            console.error('Error closing transport', error);
            callback({error: error.message});
            socket.emit('errorResponse', {error: 'Error closing transport.'});
        }
    });

    const clientTransports = new Map();

    // When creating a new transport
    function storeClientTransport(clientId, transportId) {
        const transports = clientTransports.get(clientId) || [];
        transports.push(transportId);
        clientTransports.set(clientId, transports);
    }

    // When closing a transport
    function removeClientTransport(clientId, transportId) {
        const transports = clientTransports.get(clientId);
        if (transports) {
            const index = transports.indexOf(transportId);
            if (index !== -1) {
                transports.splice(index, 1);
            }
            // If no transports left, you might want to remove the client entry as well
            if (transports.length === 0) {
                clientTransports.delete(clientId);
            } else {
                clientTransports.set(clientId, transports);
            }
        }
    }

    // Handling client disconnects
    socket.on('disconnect', () => {
        try {
            const transports = clientTransports.get(socket.id);
            if (transports) {
                transports.forEach(transportId => {
                    const transport = transportMap.get(transportId);
                    if (transport) {
                        transport.close();
                        transportMap.delete(transportId);
                    }
                });
                clientTransports.delete(socket.id);
            }
            console.log(`Client ${socket.id} disconnected, cleaning up transports.`);
            cleanUpTransports(socket.id);
        } catch (error) {
            console.error('Error disconnecting from transport', error);
            socket.emit('errorResponse', {error: 'Error disconnecting from transport.'});
        }
    });
});

app.post('/api/transport/:id/settings', (req, res) => {
    const transportId = req.params.id;
    const settings = req.body;
    updateTransportSettings(transportId, settings)
        .then(() => res.status(200).send('Settings updated'))
        .catch(error => res.status(400).send(error.message));
});

const PORT = 3001;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));