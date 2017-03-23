/* @flow */

const dgram = require('dgram');
const assert = require('chai').assert;

const Client = require('../src/client');
const Instance = require('../src/instance');
const Parser = require('../src/parser');

describe('Client', function() {
  beforeEach(function(done) {
    this.server = dgram.createSocket('udp4');

    // Flow does not know that the port option is optional.
    // See https://github.com/facebook/flow/pull/3490.
    // $FlowFixMe
    this.server.bind(() => { done(); });
  });

  beforeEach(function() {
    this.client = new Client();
    this.client.port = this.server.address().port;
    this.client.timeout = 100;
  });

  describe('#listInstance', function(done) {
    describe('with a valid response', function() {
      beforeEach(function() {
        this.server.once('message', (data, address) => {
          const response = Buffer.concat([
            new Buffer([0x05, 0x58, 0x00]),
            new Buffer('ServerName;ILSUNG1;InstanceName;YUKONSTD;IsClustered;No;Version;9.00.1399.06;tcp;57137;;')
          ]);
          this.server.send(response, 0, response.length, address.port, address.address);
        });
      });

      it('sends a CLNT_UCAST_INST request', function() {
        this.server.once('message', (data) => {
          const expected = Buffer.concat([
            new Buffer([0x04]),
            new Buffer('YUKONSTD')
          ]);
          assert.deepEqual(data, expected);
        });

        return this.client.listInstance(this.server.address(), 'YUKONSTD');
      });

      it('returns an Instance object', function() {
        return this.client.listInstance(this.server.address(), 'YUKONSTD').then((instance) => {
          assert.instanceOf(instance, Instance);

          if (!instance) { return; }
          assert.strictEqual(instance.serverName, 'ILSUNG1');
          assert.strictEqual(instance.instanceName, 'YUKONSTD');
          assert.isFalse(instance.isClustered);
          assert.strictEqual(instance.version, '9.00.1399.06');
          assert.strictEqual(instance.tcpPort, 57137);
        });
      });
    });

    describe('with an invalid response', function() {
      it('raises a SyntaxError on invalid payload', function() {
        this.server.once('message', (data, address) => {
          const response = Buffer.concat([
            new Buffer([0x05, 0x00, 0x40]),
            new Buffer('ServerName;ILSUNG1;InstanceName;YUKONSTD;ThisWillNoLongerBeValid')
          ]);
          this.server.send(response, 0, response.length, address.port, address.address);
        });

        return this.client.listInstance(this.server.address(), 'YUKONSTD').then(() => {
          assert.fail(true, false, 'Expected a SyntaxError, but none was thrown');
        }, (err) => {
          assert.instanceOf(err, Parser.SyntaxError);
          assert.strictEqual(err.message, 'Expected "IsClustered" but "T" found.');
        });
      });

      it('raises an Error on invalid response type', function() {
        this.server.once('message', (data, address) => {
          const response = new Buffer('This is a completely invalid response');

          this.server.send(response, 0, response.length, address.port, address.address);
        });

        return this.client.listInstance(this.server.address(), 'YUKONSTD').then(() => {
          assert.fail(true, false, 'Expected an Error, but none was thrown');
        }, (err) => {
          assert.instanceOf(err, Error);
          assert.strictEqual(err.message, 'Invalid SSRP response.');
        });
      });
    });

    describe('without a response', function() {
      it('times out after the specified timeout', function() {
        const start = Date.now();

        return this.client.listInstance(this.server.address(), 'YUKONSTD').then(() => {
          const duration = Date.now() - start;

          assert.isAtLeast(duration, this.client.timeout);
          assert.isAtMost(duration, this.client.timeout + 100);
        });
      });

      it('does not return an Instance object', function() {
        return this.client.listInstance(this.server.address(), 'YUKONSTD').then((instance) => {
          assert.equal(instance, undefined);
        });
      });
    });
  });

  describe('#listInstances', function() {
    describe('with a valid response', function() {
      beforeEach(function() {
        this.server.once('message', (data, address) => {
          const response = Buffer.concat([
            new Buffer([0x05, 0x47, 0x01]),
            new Buffer('ServerName;ILSUNG1;InstanceName;YUKONSTD;IsClustered;No;Version;9.00.1399.06;tcp;57137;;ServerName;ILSUNG1;InstanceName;YUKONDEV;IsClustered;No;Version;9.00.1399.06;np;\\\\ILSUNG1\\pipe\\MSSQL$YUKONDEV\\sql\\query;;ServerName;ILSUNG1;InstanceName;MSSQLSERVER;IsClustered;No;Version;9.00.1399.06;tcp;1433;np;\\\\ILSUNG1\\pipe\\sql\\query;;')
          ]);
          this.server.send(response, 0, response.length, address.port, address.address);
        });
      });

      it('sends a CLNT_UCAST_EX request', function() {
        this.server.once('message', (data) => {
          const expected = new Buffer([0x03]);
          assert.deepEqual(data, expected);
        });

        return this.client.listInstances(this.server.address());
      });

      it('returns a list of Instance objects', function() {
        return this.client.listInstances(this.server.address()).then((instances) => {
          let instance;
          assert.lengthOf(instances, 3);

          instance = instances[0];
          assert.strictEqual(instance.serverName, 'ILSUNG1');
          assert.strictEqual(instance.instanceName, 'YUKONSTD');
          assert.isFalse(instance.isClustered);
          assert.strictEqual(instance.version, '9.00.1399.06');
          assert.strictEqual(instance.tcpPort, 57137);
          assert.isUndefined(instance.npPipeName);

          instance = instances[1];
          assert.strictEqual(instance.serverName, 'ILSUNG1');
          assert.strictEqual(instance.instanceName, 'YUKONDEV');
          assert.isFalse(instance.isClustered);
          assert.strictEqual(instance.version, '9.00.1399.06');
          assert.isUndefined(instance.tcpPort);
          assert.strictEqual(instance.npPipeName, '\\\\ILSUNG1\\pipe\\MSSQL$YUKONDEV\\sql\\query');

          instance = instances[2];
          assert.strictEqual(instance.serverName, 'ILSUNG1');
          assert.strictEqual(instance.instanceName, 'MSSQLSERVER');
          assert.isFalse(instance.isClustered);
          assert.strictEqual(instance.version, '9.00.1399.06');
          assert.strictEqual(instance.tcpPort, 1433);
          assert.strictEqual(instance.npPipeName, '\\\\ILSUNG1\\pipe\\sql\\query');
        });
      });
    });

    describe('with an invalid response', function() {
      it('raises a SyntaxError on invalid payload', function() {
        this.server.once('message', (data, address) => {
          const response = Buffer.concat([
            new Buffer([0x05, 0x00, 0x40]),
            new Buffer('ServerName;ILSUNG1;InstanceName;YUKONSTD;ThisWillNoLongerBeValid')
          ]);
          this.server.send(response, 0, response.length, address.port, address.address);
        });

        return this.client.listInstances(this.server.address()).then(() => {
          assert.fail(true, false, 'Expected a SyntaxError, but none was thrown');
        }, (err) => {
          assert.instanceOf(err, Parser.SyntaxError);
          assert.strictEqual(err.message, 'Expected "IsClustered" but "T" found.');
        });
      });

      it('raises an Error on invalid response type', function() {
        this.server.once('message', (data, address) => {
          const response = new Buffer('This is a completely invalid response');

          this.server.send(response, 0, response.length, address.port, address.address);
        });

        return this.client.listInstances(this.server.address()).then(() => {
          assert.fail(true, false, 'Expected an Error, but none was thrown');
        }, (err) => {
          assert.instanceOf(err, Error);
          assert.strictEqual(err.message, 'Invalid SSRP response.');
        });
      });
    });

    describe('without a response', function() {
      it('times out after the specified timeout', function() {
        const start = Date.now();

        return this.client.listInstances(this.server.address()).then(() => {
          const duration = Date.now() - start;

          assert.isAtLeast(duration, this.client.timeout);
          assert.isAtMost(duration, this.client.timeout + 100);
        });
      });

      it('returns an empty list', function() {
        return this.client.listInstances(this.server.address()).then((instances) => {
          assert.lengthOf(instances, 0);
        });
      });
    });
  });
});
