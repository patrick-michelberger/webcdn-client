window.WebSocket = MockSocket;

var expect = chai.expect;
var updateMessage = '{"type":"update","data":["123456","125355"]}';
var uuid = "1234";

describe('WebCDN', function() {
    var self = this;

    var mockServer = null;

    beforeEach(function() {
        self.webcdn = new WebCDN();
        mockServer = new MockServer('ws://localhost:8080?id=' + uuid);
    });

    describe('.initHashing', function() {
        it('should hash each marked P2P object', function() {
            self.webcdn._initHashing();
            var items = [].slice.call(document.querySelectorAll('[data-webcdn-fallback]'));
            items.forEach(function(item) {
                expect(item.dataset.webcdnHash).not.to.be.empty;
            });
        });
    });

    describe('.getItemHash', function() {
        it('should return a hash for a DOM element', function() {
            var imageNode = document.querySelector('[data-webcdn-fallback]');
            var hash = self.webcdn._getItemHash(imageNode);
            expect(hash).to.equal('da39a3ee5e6b4b0d3255bfef95601890afd80709');
        });
    });

    describe('.connect', function() {
        it('should connect to the websocket server', function(done) {
            mockServer.on('connection', function(server) {
                expect(true).to.be.true;
                done();
            });
            self.webcdn.connect('ws://localhost:8080?id=' + uuid);
        });
    });

    describe('.update', function() {
        it('should send a update message to the coordinator', function(done) {

            mockServer.on('message', function(data) {
                var msg = JSON.parse(data);
                expect(msg.type).to.be.equal('update');
                expect(msg.data).to.equal('["123456","125355"]');
                done();
            });

            self.webcdn.connect('ws://localhost:8080?id=' + uuid, function() {
                self.webcdn._update('["123456","125355"]');
            });

        });
    });

    describe('.lookup', function() {
        it('should send a lookup request to the coordinator', function(done) {
            mockServer.on('message', function(data) {
                var msg = JSON.parse(data);
                expect(msg.type).to.be.equal('lookup');
                expect(msg.data).to.equal('123456');
                done();
            });
            self.webcdn.connect('ws://localhost:8080?id=' + uuid, function() {
                self.webcdn._lookup('123456');
            });
        });
    });

});
