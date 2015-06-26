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
            expect(hash).to.equal('9be2d5a9a52ee415ac31fa0c01e41b05d969e8c4');
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
            self.webcdn.connect('ws://localhost:8080?id=' + uuid);
            self.webcdn._update('["123456","125355"]');
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
            self.webcdn.connect('ws://localhost:8080?id=' + uuid);
            self.webcdn._lookup('123456');
        });
    });

    describe('.handleLookupResponse', function() {
        it('should receive a lookup response from the coordinator', function(done) {
            mockServer.on('connection', function(server) {
                server.send({"type": "lookup-response", "data" : "peer_id"});
                done();
            });
            self.webcdn.connect('ws://localhost:8080?id=' + uuid);
        });
    });

});
