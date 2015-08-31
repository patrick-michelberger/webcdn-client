module.exports = Logger;

function Logger(options) {
    this.DEBUG = options.debug;
};

Logger.prototype.handleError = function(err) {
    if (this.DEBUG) {
        console.log('error: ' + err);
    }
};

Logger.prototype.trace = function(message, data) {
    if (this.DEBUG) {
        if (data) {
            console.log(message, data);
        } else {
            console.log(message);
        }
    }
};
