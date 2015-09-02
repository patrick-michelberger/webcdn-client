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
        // Statistics.mark("pc_connect_start:" + this.peerid);
        var peer = this.peernet.fetch(this.peerid, this.hash, function(arraybuffer)  {
            self.finish(arraybuffer);
        });
    } else {
        // CDN Fallback
        this._loadImageByCDN(this.hash);
    }
};

Download.prototype.finish = function(arraybuffer) {
    /* TODO
       endimage.classList.add('webcdn-loaded');
       this.emit('upload_ratio', {
           "from": this._id,
           "to": event.target.label,
           "hash": msg.hash,
           "size": base64_byte
       });
       this._signalChannel.send('upload_ratio', data);
       // Measurement code
       Statistics.mark("fetch_end:" + msg.hash);
       if (i == 2) {
           Statistics.measure();
       }
       i++;
    */

    // TODO 
    var hash = this._createContentHash(new Uint8Array(arraybuffer));
    if (hash !== this.contentHash) {
        console.log("CONTENT HASH IS NOT VALID");
    } else {
        console.log("CONTENT HASH IS VALID!!!!");
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

    var req = new XMLHttpRequest();
    req.open('GET', url, true);
    req.responseType = 'arraybuffer';
    req.onerror = function(err) {
        element.setAttribute('crossOrigin', 'anonymous');
        element.src = url;
        self.logger.handleError(err);
    };
    req.onload = function(err) {
        window.URL.revokeObjectURL(this.src);
        if (this.status == 200) {
            var arraybuffer = this.response;
            if (!element.dataset.hasOwnProperty("webcdnContentHash")) {
                // Create missing content hash
                element.dataset.webcdnContentHash = self._createContentHash(new Uint8Array(arraybuffer));
            }
            self.peernet.finishDownload(self.hash, arraybuffer, self.done);
            // Statistics.queryResourceTiming(url);
        } else {
            self.logger.trace('XHR returned ' + this.status);
        }
    };

    req.send();
};

Download.prototype._createContentHash = function(content) {
    return sha1(content);
};
