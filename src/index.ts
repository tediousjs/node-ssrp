import dgram from 'dgram';

const DEFAULT_PORT = 1434;
const DEFAULT_TIMEOUT = 1000;

import Instance from './instance';
import { parse, SyntaxError } from './parser';

import type { AbortSignal } from 'abort-controller';

export { Instance, SyntaxError };

/**
  A client to request data via the SQL Server Resolution Protocol.

  See https://msdn.microsoft.com/en-us/library/cc219703.aspx
*/
export async function listInstance({ host, port = DEFAULT_PORT, family, signal, timeout = DEFAULT_TIMEOUT }: {
  host: string;
  port?: number;
  family: 4 | 6;
  signal?: AbortSignal;
  timeout?: number;
}, instanceName: string) {
  if (signal?.aborted) {
    throw new Error('aborted');
  }

  const request = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(instanceName)
  ]);

  const response = await sendRequest({ address: host, family }, port, timeout, request, signal);
  if (!response) {
    return;
  }

  return parseResponse(response)[0];
}

export async function listInstances({ host, port = DEFAULT_PORT, family, signal, timeout = DEFAULT_TIMEOUT }: {
  host: string;
  port?: number;
  family: 4 | 6;
  signal?: AbortSignal;
  timeout?: number;
}) {
  if (signal?.aborted) {
    throw new Error('aborted');
  }

  const request = Buffer.from([0x03]);
  const response = await sendRequest({ address: host, family }, port, timeout, request, signal);
  if (!response) {
    return [];
  }

  return parseResponse(response);
}

function parseResponse(buffer: Buffer): Array < Instance > {
  if (buffer.readUInt8(0) !== 0x05) {
    throw new Error('Invalid SSRP response.');
  }

  const responseSize = buffer.readInt16LE(1);
  const responseString = buffer.toString('ascii', 3, 3 + responseSize);

  return parse(responseString);
}

function sendRequest(address: { address: string, family: 4 | 6 }, port: number, timeout: number, request: Buffer, signal?: AbortSignal): Promise <Buffer | undefined> {
  const socketType = address.family === 6 ? 'udp6' : 'udp4';
  const socket = dgram.createSocket(socketType);

  return new Promise((resolve, reject) => {
    socket.on('error', reject);

    socket.bind(() => {
      socket.removeListener('error', reject);

      if (signal?.aborted) {
        socket.close();
        reject(new Error('aborted'));
      }

      const onTimeout = () => {
        signal?.removeEventListener('abort', onAbort);
        socket.close();

        resolve();
      };

      const onError = (error: Error) => {
        signal?.removeEventListener('abort', onAbort);
        clearTimeout(timer);
        socket.close();

        reject(error);
      };

      const onMessage = (message: Buffer) => {
        signal?.removeEventListener('abort', onAbort);
        clearTimeout(timer);
        socket.close();

        resolve(message);
      };

      const onAbort = () => {
        signal?.removeEventListener('abort', onAbort);
        clearTimeout(timer);
        socket.close();

        reject(new Error('aborted'));
      };

      const timer = setTimeout(onTimeout, timeout);
      signal?.addEventListener('abort', onAbort);

      socket.on('error', onError);
      socket.on('message', onMessage);

      socket.send(request, 0, request.length, port, address.address, (err) => {
        if (err) {
          reject(err);
        }
      });
    });
  });
}
