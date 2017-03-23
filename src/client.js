/* @flow */

const dgram = require('dgram');

const DEFAULT_PORT = 1434;
const DEFAULT_TIMEOUT = 1000;

const Instance = require('./instance');
const Parser = require('./parser');

/**
  A client to request data via the SQL Server Resolution Protocol.

  See https://msdn.microsoft.com/en-us/library/cc219703.aspx
*/
module.exports = class Client {
  port: number;
  timeout: number;

  constructor() {
    this.port = DEFAULT_PORT;
    this.timeout = DEFAULT_TIMEOUT;
  }

  listInstance(address: { address: string, family: 4 | 6 }, instanceName: string) : Promise<?Instance> {
    const request = Buffer.concat([
      new Buffer([ 0x04 ]),
      new Buffer(instanceName)
    ]);

    return this.sendRequest(address, request).then((response) => {
      if (response) {
        return this.parseResponse(response)[0];
      }
    });
  }

  listInstances(address: { address: string, family: 4 | 6 }) : Promise<Array<Instance>> {
    const request = new Buffer([ 0x03 ]);

    return this.sendRequest(address, request).then((response) => {
      if (!response) {
        return [];
      }

      return this.parseResponse(response);
    });
  }

  sendRequest(address: { address: string, family: 4 | 6 }, request: Buffer) : Promise<?Buffer> {
    const socketType = address.family === 6 ? 'udp6' : 'udp4';
    const socket = dgram.createSocket(socketType);

    return new Promise((resolve, reject) => {
      const onTimeout = () => {
        socket.close();
        resolve();
      };

      const onError = (error) => {
        clearTimeout(timer);
        reject(error);
      };

      const onMessage = (message) => {
        clearTimeout(timer);
        socket.close();
        resolve(message);
      };

      const timer = setTimeout(onTimeout, this.timeout);

      socket.on('error', onError);
      socket.on('message', onMessage);

      socket.send(request, 0, request.length, this.port, address.address);
    });
  }

  parseResponse(buffer: Buffer) : Array<Instance> {
    if (buffer.readUInt8(0) !== 0x05) {
      throw new Error('Invalid SSRP response.');
    }

    const responseSize = buffer.readInt16LE(1);
    const responseString = buffer.toString('ascii', 3, 3 + responseSize);

    return Parser.parse(responseString);
  }
};
