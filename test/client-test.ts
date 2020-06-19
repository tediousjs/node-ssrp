import dgram from 'dgram';

import { assert } from 'chai';

import { AbortController } from 'abort-controller';

import { listInstance, listInstances } from '../src/index';
import Instance from '../src/instance';
import * as Parser from '../src/parser';

(['udp4', 'udp6'] as dgram.SocketType[]).forEach(function(family) {
  describe(`via ${family}`, function() {
    let server: dgram.Socket;

    beforeEach(function(done) {
      server = dgram.createSocket(family);
      server.on('error', done);
      server.bind(0, family === 'udp6' ? '::1' : '127.0.0.1', () => {
        server.removeListener('error', done);
        server.setBroadcast(true);

        done();
      });
    });

    afterEach(function(done) {
      server.close(done);
    });

    describe('listInstance', function() {
      describe('with a valid response', function() {
        beforeEach(function() {
          server.once('message', (data, address) => {
            const response = Buffer.concat([
              Buffer.from([0x05, 0x58, 0x00]),
              Buffer.from('ServerName;ILSUNG1;InstanceName;YUKONSTD;IsClustered;No;Version;9.00.1399.06;tcp;57137;;')
            ]);
            server.send(response, 0, response.length, address.port, address.address);
          });
        });

        it('sends a CLNT_UCAST_INST request', async function() {
          server.once('message', (data) => {
            const expected = Buffer.concat([
              Buffer.from([0x04]),
              Buffer.from('YUKONSTD')
            ]);
            assert.deepEqual(data, expected);
          });

          await listInstance({
            host: server.address().address,
            family: family === 'udp6' ? 6 : 4,
            port: server.address().port,
            timeout: 100
          }, 'YUKONSTD');
        });

        it('returns an Instance object', async function() {
          let instance = await listInstance({
            host: server.address().address,
            family: family === 'udp6' ? 6 : 4,
            port: server.address().port,
            timeout: 100
          }, 'YUKONSTD');

          assert.instanceOf(instance, Instance);
          instance = instance!;

          assert.strictEqual(instance.serverName, 'ILSUNG1');
          assert.strictEqual(instance.instanceName, 'YUKONSTD');
          assert.isFalse(instance.isClustered);
          assert.strictEqual(instance.version, '9.00.1399.06');
          assert.strictEqual(instance.tcpPort, 57137);
        });
      });

      describe('with an invalid response', function() {
        it('raises a SyntaxError on invalid payload', async function() {
          server.once('message', (data, address) => {
            const response = Buffer.concat([
              Buffer.from([0x05, 0x00, 0x40]),
              Buffer.from('ServerName;ILSUNG1;InstanceName;YUKONSTD;ThisWillNoLongerBeValid')
            ]);
            server.send(response, 0, response.length, address.port, address.address);
          });

          await assert.isRejected(listInstance({
            host: server.address().address,
            family: family === 'udp6' ? 6 : 4,
            port: server.address().port,
            timeout: 100
          }, 'YUKONSTD'), Parser.SyntaxError, 'Expected "IsClustered" but "T" found.');
        });

        it('raises an Error on invalid response type', async function() {
          server.once('message', (data, address) => {
            const response = Buffer.from('This is a completely invalid response');

            server.send(response, 0, response.length, address.port, address.address);
          });

          await assert.isRejected(listInstance({
            host: server.address().address,
            family: family === 'udp6' ? 6 : 4,
            port: server.address().port,
            timeout: 100
          }, 'YUKONSTD'), Error, 'Invalid SSRP response.');
        });
      });

      describe('without a response', function() {
        it('times out after the specified timeout', async function() {
          const start = Date.now();

          await listInstance({
            host: server.address().address,
            family: family === 'udp6' ? 6 : 4,
            port: server.address().port,
            timeout: 100
          }, 'YUKONSTD');

          const duration = Date.now() - start;

          assert.isAtLeast(duration, 99);
          assert.isAtMost(duration, 200);
        });

        it('does not return an Instance object', async function() {
          const instance = await listInstance({
            host: server.address().address,
            family: family === 'udp6' ? 6 : 4,
            port: server.address().port,
            timeout: 100
          }, 'YUKONSTD');

          assert.equal(instance, undefined);
        });
      });

      describe('when aborted via the given signal', function() {
        it('returns before timing out', async function() {
          const start = Date.now();

          const controller = new AbortController();

          setTimeout(() => {
            controller.abort();
          }, 50);

          await assert.isRejected(listInstance({
            host: server.address().address,
            family: family === 'udp6' ? 6 : 4,
            port: server.address().port,
            timeout: 100,
            signal: controller.signal
          }, 'YUKONSTD'));

          const duration = Date.now() - start;

          assert.isAtLeast(duration, 50);
          assert.isAtMost(duration, 99);
        });
      });
    });

    describe('listInstances', function() {
      describe('with a valid response', function() {
        beforeEach(function() {
          server.once('message', (data, address) => {
            const response = Buffer.concat([
              Buffer.from([0x05, 0x47, 0x01]),
              Buffer.from('ServerName;ILSUNG1;InstanceName;YUKONSTD;IsClustered;No;Version;9.00.1399.06;tcp;57137;;ServerName;ILSUNG1;InstanceName;YUKONDEV;IsClustered;No;Version;9.00.1399.06;np;\\\\ILSUNG1\\pipe\\MSSQL$YUKONDEV\\sql\\query;;ServerName;ILSUNG1;InstanceName;MSSQLSERVER;IsClustered;No;Version;9.00.1399.06;tcp;1433;np;\\\\ILSUNG1\\pipe\\sql\\query;;')
            ]);
            server.send(response, 0, response.length, address.port, address.address);
          });
        });

        it('sends a CLNT_UCAST_EX request', async function() {
          server.once('message', (data) => {
            const expected = Buffer.from([0x03]);
            assert.deepEqual(data, expected);
          });

          await listInstances({
            host: server.address().address,
            family: family === 'udp6' ? 6 : 4,
            port: server.address().port,
            timeout: 100
          });
        });

        it('returns a list of Instance objects', async function() {
          const instances = await listInstances({
            host: server.address().address,
            family: family === 'udp6' ? 6 : 4,
            port: server.address().port,
            timeout: 100
          });

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

      describe('with an invalid response', function() {
        it('raises a SyntaxError on invalid payload', async function() {
          server.once('message', (data, address) => {
            const response = Buffer.concat([
              Buffer.from([0x05, 0x00, 0x40]),
              Buffer.from('ServerName;ILSUNG1;InstanceName;YUKONSTD;ThisWillNoLongerBeValid')
            ]);
            server.send(response, 0, response.length, address.port, address.address);
          });

          await assert.isRejected(listInstances({
            host: server.address().address,
            family: family === 'udp6' ? 6 : 4,
            port: server.address().port,
            timeout: 100
          }), Parser.SyntaxError, 'Expected "IsClustered" but "T" found.');
        });

        it('raises an Error on invalid response type', async function() {
          server.once('message', (data, address) => {
            const response = Buffer.from('This is a completely invalid response');

            server.send(response, 0, response.length, address.port, address.address);
          });

          await assert.isRejected(listInstances({
            host: server.address().address,
            family: family === 'udp6' ? 6 : 4,
            port: server.address().port,
            timeout: 100
          }), Error, 'Invalid SSRP response.');
        });
      });

      describe('without a response', function() {
        it('times out after the specified timeout', async function() {
          const start = Date.now();

          await listInstances({
            host: server.address().address,
            family: family === 'udp6' ? 6 : 4,
            port: server.address().port,
            timeout: 100
          });

          const duration = Date.now() - start;

          assert.isAtLeast(duration, 99);
          assert.isAtMost(duration, 200);
        });

        it('returns an empty list', async function() {
          const instances = await listInstances({
            host: server.address().address,
            family: family === 'udp6' ? 6 : 4,
            port: server.address().port,
            timeout: 100
          });

          assert.lengthOf(instances, 0);
        });
      });

      describe('when aborted via the given signal', function() {
        it('returns before timing out', async function() {
          const start = Date.now();

          const controller = new AbortController();

          setTimeout(() => {
            controller.abort();
          }, 50);

          await assert.isRejected(listInstances({
            host: server.address().address,
            family: family === 'udp6' ? 6 : 4,
            port: server.address().port,
            timeout: 100,
            signal: controller.signal
          }));

          const duration = Date.now() - start;

          assert.isAtLeast(duration, 50);
          assert.isAtMost(duration, 99);
        });
      });
    });
  });
});
