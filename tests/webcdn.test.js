var expect = chai.expect;
var updateMessage = '{"type":"update","data":["123456","125355"]}';

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

    describe('.getItemHash', function() {
        it('should return a hash for a DOM element', function() {
            var imageNode = document.querySelector('[data-webcdn-fallback]');
            var hash = this.webcdn.getItemHash(imageNode);
            expect(hash).to.equal('9be2d5a9a52ee415ac31fa0c01e41b05d969e8c4');
        });
    });

    describe('.connect', function() {
        it('should connect to a websocket server', function() {
            var spy = sinon.spy(window, 'WrapWebSocket');
            this.webcdn.connect('ws://' + location.hostname + ':1337');
            expect(spy.calledOnce);
        });
    });


});
