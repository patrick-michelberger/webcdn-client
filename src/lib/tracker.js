var Statistics = require('./statistics.js');

module.exports = Tracker;

function Tracker(options) {
	this._messenger = options.messenger;
};

Tracker.prototype.getInfo = function(hash, callback) {
	Statistics.mark("lookup_start:" + hash);
    this._messenger.send('lookup', hash);
    this._messenger.once('lookup-response:' + hash, function(data) {
    	Statistics.mark("lookup_end:" + data.hash);
        callback(data);
    });
};

