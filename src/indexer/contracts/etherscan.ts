export interface EtherscanLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  timeStamp: string;
  gasPrice: string;
  gasUsed: string;
  logIndex: string;
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
}

export interface EtherscanGetLogsResult {
  status: string;
  message: string;
  result: EtherscanLog[];
}

export interface ParsedEtherscanLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  timeStamp: number;
  gasUsed: string;
  gasPrice: string;
  logIndex: number;
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
}

export interface EventLogsReq {
  fromBlock: number;
  toBlock: number;
  safeBlock: number;
}

export interface EtherscanGetBlockResult {
  id: number;
  jsonrpc: string;
  result: {
    hash: string;
    timestamp: string;
    transactions: EtherscanBlockTxResult[];
    transactionsRoot: string;
  };
}

export interface EtherscanBlockTxResult {
  blockHash: string;
  blockNumber: string;
  from: string;
  gas: string;
  gasPrice: string;
  hash: string;
  input: string;
  nonce: string;
  to: string;
  transactionIndex: string;
  value: string;
  type: string;
  v: string;
  r: string;
  s: string;
}

export interface EtherscanGetTransactionReceiptResult {
  id: number;
  jsonrpc: string;
  result: EtherscanTransactionReceipt;
}

export interface EtherscanTransactionReceipt {
  to: string;
  from: string;
  blockNumber: string;
  contractAddress: string;
  logs: Array<EtherscanLog>;
  transactionHash: string;
}
