module.exports = {
    // MediaSoup server configurations
    mediasoup: {
        // Number of mediasoup workers to spawn
        numWorkers: require('os').cpus().length,
        // Worker settings
        worker: {
            rtcMinPort: 10000,
            rtcMaxPort: 10100,
        },
        // Router settings
        router: {
            mediaCodecs:
                [
                    {
                        kind: 'audio',
                        mimeType: 'audio/opus',
                        clockRate: 48000,
                        channels: 2
                    },
                    {
                        kind: 'video',
                        mimeType: 'video/VP8',
                        clockRate: 90000,
                        parameters:
                            {
                                'x-google-start-bitrate': 1000
                            }
                    }
                ]
        },
        // WebRtcTransport settings
        webRtcTransport: {
            listenIps: [
                { ip: '0.0.0.0', announcedIp: null } // Replace with your network IP
            ],
            initialAvailableOutgoingBitrate: 1000000,
            minimumAvailableOutgoingBitrate: 600000,
            maxIncomingBitrate: 1500000
        }
    }
};