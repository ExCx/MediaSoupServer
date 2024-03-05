const mediasoup = require('mediasoup');
const config = require('../config');
let worker;

async function startWorker() {
    worker = await mediasoup.createWorker({
        logLevel: 'debug',
        rtcMinPort: config.mediasoup.worker.rtcMinPort,
        rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
    });

    worker.on('died', () => {
        console.error('mediasoup Worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
        setTimeout(() => process.exit(1), 2000);
    });

    console.log(`MediaSoup worker started [pid:${worker.pid}]`);
    return await worker.createRouter({mediaCodecs: config.mediasoup.router.mediaCodecs});
}

module.exports = { startWorker };