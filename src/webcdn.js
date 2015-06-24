'use strict';

var sha1 = require('sha1');

(function(window) {

    function WebCDN(config) {
        var self = this;
        
        self.initHashing = function() {
            var items = [].slice.call(document.querySelectorAll('[data-webcdn-fallback]'));
            items.forEach(function(item) {
            	var hash = self.getItemHash(item);
            	item.dataset.webcdnHash = hash;
            });
        };

        self.getItemHash = function(item) {
            var data = getImageData(item);
            var hash = sha1(data);
            return hash;
        };

        function getImageData(domElement) {
            var canvas = document.createElement('canvas');
            canvas.width = domElement.width;
            canvas.height = domElement.height;
            var context = canvas.getContext('2d');
            context.drawImage(domElement, 0, 0, domElement.width, domElement.height);
            var data = canvas.toDataURL("image/jpeg");
            return data;
        };

    };

    window.WebCDN = WebCDN;
})(window);
