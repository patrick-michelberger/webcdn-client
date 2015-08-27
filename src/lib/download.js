var Statistics = require('./statistics.js');

module.exports = Download;

function Download(peerid, hash, size, peernet, callback) {
    this.peerid = peerid;
    this.hash = hash;
    this.size = size;
    this.peernet = peernet;
    this.done = callback;
    this.chunks = [];
};

Download.prototype.start = function() {
    if (this.peerid) {
        // Statistics.mark("pc_connect_start:" + this.peerid);
        var peer = this.peernet.createConnection(this.peerid, this.hash);
        peer.doOffer();
    } else {
        // CDN Fallback
        this._loadImageByCDN(this.hash);
    }
};

Download.prototype.finish = function() {
	var content = new ArrayBuffer(this.size);
	this.peernet.finishDownload(this.hash, content, this.done);
};

/**
 * Downloads a given resouce from its CDN fallback URL. CORS has to be enabled.
 * @param {String} hash content hash value
 * @private
 */
Download.prototype._loadImageByCDN = function(hash) {
    var self = this;
    var element = document.querySelector('[data-webcdn-hash="' + hash + '"]');
    var url = element.dataset.webcdnFallback;

    var req = new XMLHttpRequest();
    req.open('GET', url, true);
    req.responseType = 'arraybuffer';
    req.onerror = function(err) {
        console.log("XHR Error: ", err);
        element.setAttribute('crossOrigin', 'anonymous');
        element.src = url;
    };
    req.onload = function(err) {
        if (this.status == 200) {
            var content = this.response;
           	self.peernet.finishDownload(self.hash, content, self.done);
            // Statistics.queryResourceTiming(url);
        } else {
            console.log('XHR returned ' + this.status);
        }
    };

    req.send();
};