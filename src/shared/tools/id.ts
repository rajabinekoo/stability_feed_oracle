// blockNumber * 2^32 + logIndex
export const buildEventId = (
  blockNumber: number | string,
  logIndex: number | string,
) => ((BigInt(blockNumber) << 32n) | BigInt(logIndex)).toString();
