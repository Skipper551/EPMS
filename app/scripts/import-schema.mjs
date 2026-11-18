// Imports ../pb_schema.json into a PocketBase instance (local development only).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import PocketBase from 'pocketbase'

const url = process.env.PB_URL || 'http://127.0.0.1:8090'
const pb = new PocketBase(url)
await pb.collection('_superusers').authWithPassword(process.env.PB_EMAIL, process.env.PB_PASSWORD)
const schema = JSON.parse(readFileSync(fileURLToPath(new URL('../../pb_schema.json', import.meta.url)), 'utf8'))
await pb.collections.import(schema, false)
console.log(`Imported ${schema.length} collections into ${url}`)
