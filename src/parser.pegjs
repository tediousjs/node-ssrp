/**
  Peg.js definition for parsing SRV_RESP data as described in
  [MC-SQLR](https://msdn.microsoft.com/en-us/library/cc219703.aspx).

  This parser parses the data as specified in the specification,
  but only includes protocol information about TCP and Named Pipes.
*/

{
const Instance = require('./instance');
}

RESP_DATA = CLNT_BCAST_EX_RESPONSE / CLNT_UCAST_EX_RESPONSE / CLNT_UCAST_INST_RESPONSE

CLNT_BCAST_EX_RESPONSE = CLNT_UCAST_EX_RESPONSE

CLNT_UCAST_EX_RESPONSE = CLNT_UCAST_INST_RESPONSE*

CLNT_UCAST_INST_RESPONSE =
	"ServerName" SEMICOLON serverName:SERVERNAME SEMICOLON
  "InstanceName" SEMICOLON instanceName:INSTANCENAME SEMICOLON
  "IsClustered" SEMICOLON isClustered:YES_OR_NO SEMICOLON
  "Version" SEMICOLON version:VERSION_STRING
  protocols:(NP_INFO / TCP_INFO / VIA_INFO / RPC_INFO / SPX_INFO / ADSP_INFO / BV_INFO)*
  SEMICOLON SEMICOLON
{
  const instance = new Instance(serverName, instanceName, isClustered, version);

  for (let i = 0, len = protocols.length; i < len; i++) {
    const protocol = protocols[i];
    switch (protocol[0]) {
      case 'tcp':
        if (instance.tcpPort !== undefined) {
          expected();
        }
        instance.tcpPort = protocol[1];
      break;

      case 'np':
        if (instance.npPipeName !== undefined) {
          expected();
        }
        instance.npPipeName = protocol[1];
      break;
    }
  }

  return instance;
}

SERVERNAME = $[^;]+
INSTANCENAME = $[^;]+
YES_OR_NO = yesOrNo:("Yes" / "No") { return yesOrNo === "yes"; }
VERSION_STRING = $[0-9.]+

NP_INFO = SEMICOLON "np" SEMICOLON parameters:NP_PARAMETERS { return ["np", parameters]; }
NP_PARAMETERS = PIPENAME
PIPENAME = $[^;]+

TCP_INFO = SEMICOLON "tcp" SEMICOLON parameters:TCP_PARAMETERS { return ["tcp", parameters]; }
TCP_PARAMETERS = TCP_PORT
TCP_PORT = port:$([1-9][0-9]*) { return parseInt(port, 10); }

VIA_INFO = SEMICOLON "via" SEMICOLON parameters:VIA_PARAMETERS
VIA_PARAMETERS = NETBIOS VIALISTENINFO
VIALISTENINFO = ["," nic:VIANIC ":" port:VIAPORT]+
VIANIC = $[^:]+
VIAPORT = $([1-9][0-9]*)
NETBIOS = $[^,]+

RPC_INFO = SEMICOLON "rpc" SEMICOLON parameters:RPC_PARAMETERS
RPC_PARAMETERS = COMPUTERNAME
COMPUTERNAME = $[^;]+

SPX_INFO = SEMICOLON "spx" SEMICOLON parameters:SPX_PARAMETERS
SPX_PARAMETERS = SERVICENAME
SERVICENAME = $[^;]+

ADSP_INFO=SEMICOLON "adsp" SEMICOLON parameters:ADSP_PARAMETERS
ADSP_PARAMETERS=ADSPOBJECTNAME
ADSPOBJECTNAME = $[^;]+

BV_INFO = SEMICOLON "bv" SEMICOLON ITEMNAME SEMICOLON GROUPNAME SEMICOLON BV_PARAMETERS
BV_PARAMETERS = ITEMNAME SEMICOLON GROUPNAME SEMICOLON ORGNAME
ITEMNAME = $[^;]+
GROUPNAME = $[^;]+
ORGNAME = $[^;]+

SEMICOLON = ";"
