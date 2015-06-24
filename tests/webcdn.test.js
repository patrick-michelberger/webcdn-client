var expect = chai.expect;

describe('WebCDN', function() {
    before(function() {
        this.webcdn = new WebCDN();
    });

    describe('.initHashing', function() {
        it('should hash each marked P2P object', function() {
            this.webcdn.initHashing();
            var items = [].slice.call(document.querySelectorAll('[data-webcdn-fallback]'));
            items.forEach(function(item) {
            	expect(item.dataset.webcdnHash).not.to.be.empty;
            });
        });
    });
});
