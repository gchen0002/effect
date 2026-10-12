import * as RpcSerialization from "effect/rpc/RpcSerialization"
import assert from "node:assert/strict"
import { Bench } from "tinybench"

// Run on each revision with Node, Deno or Bun. Inputs are prepared outside the
// timed tasks; each task decodes one complete frame and consumes its payload.
const cases = [
  { size: 256, fragment: 1024, input: "bytes" },
  { size: 2048, fragment: 8192, input: "bytes" },
  { size: 2048, fragment: 8192, input: "string" },
  { size: 1024 * 1024, fragment: 8192, input: "bytes" },
  { size: 1024 * 1024, fragment: 8192, input: "string" },
  { size: 4 * 1024 * 1024, fragment: 16384, input: "bytes" },
  { size: 4 * 1024 * 1024, fragment: Infinity, input: "bytes" }
] as const

const bench = new Bench({ time: 500, warmupTime: 250, iterations: 8, warmupIterations: 4 })
const encoder = new TextEncoder()
let consumed = 0

for (const { fragment, input, size } of cases) {
  const frame = JSON.stringify({ data: "a".repeat(size) }) + "\n"
  const encoded = input === "bytes" ? encoder.encode(frame) : frame
  const chunks: Array<string | Uint8Array> = []
  for (let i = 0; i < encoded.length; i += fragment) {
    chunks.push(encoded.slice(i, i + fragment))
  }
  const parser = RpcSerialization.ndjson.makeUnsafe()
  const decode = () => {
    for (const chunk of chunks) {
      const items = parser.decode(chunk)
      for (const item of items) consumed += (item as { data: string }).data.length
    }
  }

  const previous = consumed
  decode()
  assert.equal(consumed - previous, size)
  bench.add(`${input}: ${size} B payload / ${fragment} B fragments`, decode)
}

await bench.run()
console.table(bench.table())
assert(consumed > 0)
