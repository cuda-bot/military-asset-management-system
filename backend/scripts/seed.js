import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI);

async function main() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db();

        console.log('Clearing existing collections...');
        await Promise.all([
            db.collection('users').deleteMany({}),
            db.collection('bases').deleteMany({}),
            db.collection('equipment_types').deleteMany({}),
            db.collection('assets').deleteMany({}),
            db.collection('purchases').deleteMany({}),
            db.collection('transfers').deleteMany({}),
            db.collection('assignments').deleteMany({}),
        ]);

        console.log('Seeding new data...');

        // Users
        const passwordHash = await bcrypt.hash('password123', 12);
        const usersResult = await db.collection('users').insertMany([
            {
                username: 'admin',
                email: 'admin@example.com',
                password: passwordHash,
                firstName: 'Admin',
                lastName: 'User',
                role: 'admin',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                username: 'commander',
                email: 'commander@example.com',
                password: passwordHash,
                firstName: 'Base',
                lastName: 'Commander',
                role: 'base_commander',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);
        console.log(`${usersResult.insertedCount} users created.`);
        const adminUser = await db.collection('users').findOne({ username: 'admin' });
        const commanderUser = await db.collection('users').findOne({ username: 'commander' });

        // Bases
        const basesResult = await db.collection('bases').insertMany([
            { name: 'Fort Courage', location: 'USA', createdAt: new Date(), updatedAt: new Date() },
            { name: 'Camp Victory', location: 'USA', createdAt: new Date(), updatedAt: new Date() },
        ]);
        console.log(`${basesResult.insertedCount} bases created.`);
        const fortCourage = await db.collection('bases').findOne({ name: 'Fort Courage' });
        const campVictory = await db.collection('bases').findOne({ name: 'Camp Victory' });

        // Assign commander to Fort Courage
        await db.collection('users').updateOne(
            { _id: commanderUser._id },
            { $set: { base_ids: [fortCourage._id] } }
        );
        console.log('Assigned commander to base.');

        // Equipment Types
        const eqTypesResult = await db.collection('equipment_types').insertMany([
            { name: 'Rifle', category: 'Weapon' },
            { name: 'Helmet', category: 'Armor' },
            { name: 'Jeep', category: 'Vehicle' },
        ]);
        console.log(`${eqTypesResult.insertedCount} equipment types created.`);
        const rifle = await db.collection('equipment_types').findOne({ name: 'Rifle' });

        // Assets
        const assetsResult = await db.collection('assets').insertMany([
            { base_id: fortCourage._id, equipment_type_id: rifle._id, quantity: 100, openingBalance: 100, createdAt: new Date() },
        ]);
        console.log(`${assetsResult.insertedCount} assets created.`);

        console.log('Database seeded successfully!');
    } catch (e) {
        console.error('Failed to seed database:', e);
        process.exit(1);
    } finally {
        await client.close();
    }
}

main();
