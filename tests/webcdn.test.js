window.WebSocket = MockSocket;

var expect = chai.expect;
var updateMessage = '{"type":"update","data":["123456","125355"]}';
var lookupResponseMessage = '{"type":"lookup-response","data":{"peerid": "65a33500-35bd-4c3f-9103-a6fe48d42a3b","hash":"783b7477e2fb5b827556947d9a71fae24d699740"}}';
var uuid = "1234";

describe('WebCDN', function() {
    var self = this;
    var mockServer = null;

    beforeEach(function() {
        self.webcdn = new WebCDN();
        mockServer = new MockServer('ws://localhost:8080?id=' + uuid);
    });

    describe('.connect', function() {
        it('should connect to the websocket server', function(done) {
            mockServer.on('connection', function(server) {
                expect(true).to.be.true;
                done();
            });
            self.webcdn._connect('ws://localhost:8080?id=' + uuid);
        });
    });

    describe('.getItemHash', function() {
        it('should return a hash for a DOM element', function() {
            var imageNode = document.querySelector('[data-webcdn-fallback]');
            var hash = self.webcdn._getItemHash(imageNode);
            expect(hash).to.equal('783b7477e2fb5b827556947d9a71fae24d699740');
        });
    });

    xdescribe('.load', function() {
        xit('should load a resource via WebRTC DataChannel', function(done) {
            var hash = "783b7477e2fb5b827556947d9a71fae24d699740";
            mockServer.on('connection', function(server) {
                mockServer.on('message', function(data) {
                    var msg = JSON.parse(data);
                    if (msg.type === "relay") {
                        if (msg.data.type === 'offer') {
                            var matches = /\?id=(.*)/g.exec(server.url);
                            var uuid = matches[1];
                            msg.from = "1234";
                        }
                        if (msg.data.type === 'answer') {
                            msg.from = "65a33500-35bd-4c3f-9103-a6fe48d42a3b";
                        }
                        if (msg.data.type === 'candidate') {
                            msg.from = "1234";
                        }
                    } else if (msg.type === "lookup") {
                        msg = JSON.parse(lookupResponseMessage);
                    }
                    server.send(JSON.stringify(msg));
                });
            });

            // peer 2
            var peer2 = new WebCDN();
            peer2._connect('ws://localhost:8080?id=' + uuid, function() {

            });

            // peer 1
            self.webcdn._connect('ws://localhost:8080?id=' + uuid, function() {
                self.webcdn.load(hash);
                setTimeout(function() {
                    var image = document.querySelector('[data-webcdn-hash="' + hash + '"]');
                    expect(image.classList.contains('webcdn-loaded')).to.be.true;
                    done();
                }, 400);
            });

        });
    });

    describe('._initLoad', function() {
        it('should send three initial lookup requests to the coordinator', function(done) {
            var i = 0;
            mockServer.on('message', function(data) {
                var msg = JSON.parse(data);
                if (msg.type === "lookup") {
                    i++;
                }
                if (i === 3) {
                    done();
                }
            });
            self.webcdn._connect('ws://localhost:8080?id=' + uuid, function() {
                self.webcdn._initLoad();
            });

        });
    });

    describe('._tracker.getInfo', function() {
        it('should send a lookup request to the coordinator', function(done) {
            mockServer.on('message', function(data) {
                var msg = JSON.parse(data);
                expect(msg.type).to.be.equal('lookup');
                expect(msg.data).to.equal('123456');
                done();
            });
            self.webcdn._connect('ws://localhost:8080?id=' + uuid, function() {
                self.webcdn._tracker.getInfo('123456');
            });
        });
    });

    describe('._update', function() {
        it('should send a update message to the coordinator', function(done) {

            mockServer.on('message', function(data) {
                var msg = JSON.parse(data);
                expect(msg.type).to.be.equal('update');
                expect(msg.data).to.equal('["123456","125355"]');
                done();
            });

            self.webcdn._connect('ws://localhost:8080?id=' + uuid, function() {
                self.webcdn._update('["123456","125355"]');
            });

        });
    });
});
