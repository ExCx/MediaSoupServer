const { webRtcTransport } = require('../config').mediasoup;

const transports = new Map();

async function createWebRtcTransport(router, socketId) {
    const transport = await router.createWebRtcTransport({
        listenIps: webRtcTransport.listenIps,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: webRtcTransport.initialAvailableOutgoingBitrate,
        minimumAvailableOutgoingBitrate: webRtcTransport.minimumAvailableOutgoingBitrate,
        maxPacketLifeTime: 12000,
        maxIncomingBitrate: webRtcTransport.maxIncomingBitrate,
    });

    // Store the transport with its ID and associate the socketId
    transports.set(transport.id, { transport, socketId });
    return transport;
}

// Assuming this function updates transport settings
async function updateTransportSettings(transportId, settings) {
    transportId = sanitizeInput(transportId); // Sanitize the input
    const transport = findTransportById(transportId);
    if (!transport) throw new Error('Transport not found');

    // Validate settings - example for bitrate validation
    if (typeof settings.maxIncomingBitrate !== 'number' || settings.maxIncomingBitrate < 100000 || settings.maxIncomingBitrate > 5000000) {
        throw new Error('Invalid maxIncomingBitrate value');
    }

    // Apply the settings after validation
    await transport.setMaxIncomingBitrate(settings.maxIncomingBitrate);
}

function findTransportById(transportId) {
    let entry = transports.get(transportId);
    return entry ? entry.transport : undefined;
}

function cleanUpTransports(socketId) {
    // Iterate through all transports and close the ones associated with the socketId
    for (let [id, { transport, socketId: storedSocketId }] of transports.entries()) {
        if (storedSocketId === socketId) {
            transport.close(); // Close the transport
            transports.delete(id); // Remove from the map
        }
    }
}

function sanitizeInput(input) {
    return input.replace(/<script.*?>.*?<\/script>/gi, ''); // Simple XSS prevention
}

module.exports = { createWebRtcTransport, updateTransportSettings, cleanUpTransports };