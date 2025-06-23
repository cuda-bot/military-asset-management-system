import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
    throw new Error('MONGODB_URI not set in environment variables');
}

let client;
let db;

export async function connectToMongo() {
    if (db) {
        return db;
    }
    client = new MongoClient(uri, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    });
    await client.connect();
    db = client.db();
    return db;
}

export function getMongoClient() {
    if (!client) {
        throw new Error('MongoDB client not initialized. Call connectToMongo first.');
    }
    return client;
} 