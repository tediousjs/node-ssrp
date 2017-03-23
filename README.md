# node-ssrp

> An implementation of the SQL Server Resolution protocol.

```js
const SSRPClient = require('ssrp').Client;
const client = new SSRPClient();

client.listInstances({ address: "192.168.0.4", family: 4 }).then((instances) => {
  if (instances.length === 0) {
    console.log("Found no SQLServer instances.");
    return;
  }

  console.log("Found the following SQLServer instances:");
  for (let i = 0, length = instances.length; i < length; i++) {
    console.log(`* ${instance.instanceName} - ${instance.version}`);
  }
});
```
