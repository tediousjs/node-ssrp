export default class Instance {
  serverName: string;
  instanceName: string;
  isClustered: boolean;
  version: string;
  tcpPort?: number;
  npPipeName?: string;

  constructor(serverName: string, instanceName: string, isClustered: boolean, version: string) {
    this.serverName = serverName;
    this.instanceName = instanceName;
    this.isClustered = isClustered;
    this.version = version;
    this.tcpPort = undefined;
    this.npPipeName = undefined;
  }
}
