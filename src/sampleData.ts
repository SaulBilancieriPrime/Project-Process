import { createMergedGraphDocument } from "./data/mergeGraphExports";
import type { GraphDocument } from "./types";

export function createSampleDocument(): GraphDocument {
  return createMergedGraphDocument();
}
