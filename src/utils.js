class Utils {
    constructor(signalRConnection, data) {
        this.signalRConnection = signalRConnection;
        this.data = data;
    }

    // Formats image urls to be usable 
    formatIconUrl(url) {
        try {
            return url.replace('resdb:///', this.data.ASSET_URL).replace('.webp', '').replace('.png', '');
        }
        catch {
            return 'INVALID_URL';
        }
    }

    // Basic logging stuff with time stamps
    log(message) {
        console.log(`[${Date.now()} INFO] ${message}`);
    }

    // Basic warning stuff with time stamps
    warning(message) {
        console.warn(`[${Date.now()} WARN] ${message}`);
    }

    // Basic error stuff with time stamps
    error(message) {
        console.error(`[${Date.now()} ERROR] ${message}`);
    }
}

module.exports = Utils;