var Statistics = require('./statistics.js');
var sha1 = require('sha1');

module.exports = Download;

function Download(peerid, hash, contentHash, peernet, logger, callback) {
    this.peerid = peerid;
    this.hash = hash;
    this.contentHash = contentHash;
    this.peernet = peernet;
    this.logger = logger;
    this.done = callback;
    this.chunks = [];
};

Download.prototype.start = function() {
    var self = this;
    if (this.peerid) {
        Statistics.mark("pc_connect_start:" + this.hash);
        var peer = this.peernet.fetch(this.peerid, this.hash, function(arraybuffer)  {
            self.finish(arraybuffer);
        });
    } else {
        Statistics.mark("cdn_fallback_start:" + this.hash);
        self._loadImageByCDN(self.hash);
    }
};

Download.prototype.finish = function(arraybuffer) {
    // Statistics.mark("fetch_end:" + this.hash);

    // Data integrity check
    if (this._createContentHash(arraybuffer) !== this.contentHash) {
        this._loadImageByCDN(this.hash);
    } else {
        this.peernet.finishDownload(this.hash, arraybuffer, this.done);
    }
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

    if (url) {
            var req = new XMLHttpRequest();
            req.open('GET', url, true);
            req.responseType = 'arraybuffer';
            req.onerror = function(err) {
                element.setAttribute('crossOrigin', 'anonymous');
                element.src = url;
                self.logger.handleError(err);
            };
            req.onload = function(err) {
                if (this.status == 200) {
                    var arraybuffer = this.response;
                    if (!element.dataset.hasOwnProperty("webcdnContentHash")) {
                        // Create missing content hash
                        element.dataset.webcdnContentHash = self._createContentHash(arraybuffer);
                    }
                    Statistics.mark("cdn_fallback_end:" + self.hash);
                    var duration = Statistics.measureByType("cdn_fallback", self.hash);
                    self.peernet.finishDownload(self.hash, arraybuffer, self.done);
                } else {
                    self.logger.trace('XHR returned ' + this.status);
                }
            };
            req.send();
    } else {
        self.logger.trace("No WebCDN fallback URL available");
    }
};

/**
 * Returns a SHA-1 hash value from a given array buffer
 * @param {ArrayBuffer} content
 * @return {String} hash
 */
Download.prototype._createContentHash = function(content) {
    return sha1(new Uint8Array(content));
};
