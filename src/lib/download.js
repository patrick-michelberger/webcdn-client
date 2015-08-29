var Statistics = require('./statistics.js');

module.exports = Download;

function Download(peerid, hash, peernet, logger, callback) {
    this.peerid = peerid;
    this.hash = hash;
    this.peernet = peernet;
    this.logger = logger;
    this.done = callback;
    this.chunks = [];
};

Download.prototype.start = function() {
    var self = this;
    if (this.peerid) {
        // Statistics.mark("pc_connect_start:" + this.peerid);
        var peer = this.peernet.fetch(this.peerid, this.hash, function(chunks)  {
            self.finish(chunks);
        });
    } else {
        // CDN Fallback
        this._loadImageByCDN(this.hash);
    }
};

Download.prototype.finish = function(data) {
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
    this.peernet.finishDownload(this.hash, data, this.done);
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
        if (this.status == 200) {
            var content = this.response;
            self.peernet.finishDownload(self.hash, content, self.done);
            // Statistics.queryResourceTiming(url);
        } else {
            self.logger.trace('XHR returned ' + this.status);
        }
    };

    req.send();
};
