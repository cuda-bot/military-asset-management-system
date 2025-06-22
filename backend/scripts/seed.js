import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

async function main() {
    logger.info('Start seeding...');

    // Seed bases
    const bases = await prisma.base.createMany({
        data: [
            { name: 'Fort Bragg', location: 'North Carolina, USA' },
            { name: 'Camp Pendleton', location: 'California, USA' },
            { name: 'Fort Hood', location: 'Texas, USA' },
            { name: 'Joint Base Lewis-McChord', location: 'Washington, USA' }
        ],
        skipDuplicates: true,
    });
    logger.info(`Created ${bases.count} bases.`);

    // Seed equipment types
    const equipmentTypes = await prisma.equipmentType.createMany({
        data: [
            { name: 'M4 Carbine' },
            { name: 'M249 SAW' },
            { name: '5.56mm Ammunition' },
            { name: '7.62mm Ammunition' },
            { name: 'HMMWV' },
            { name: 'M1A2 Abrams' },
            { name: 'Body Armor' },
            { name: 'Night Vision Goggles' },
            { name: 'Radio Equipment' },
            { name: 'Medical Supplies' }
        ],
        skipDuplicates: true,
    });
    logger.info(`Created ${equipmentTypes.count} equipment types.`);

    // Seed users
    const users = [
        {
            username: 'admin',
            password: await bcrypt.hash('admin123', 12),
            role: 'admin'
        },
        {
            username: 'commander_bragg',
            password: await bcrypt.hash('commander123', 12),
            role: 'base_commander'
        },
        {
            username: 'commander_pendleton',
            password: await bcrypt.hash('commander123', 12),
            role: 'base_commander'
        },
        {
            username: 'logistics_bragg',
            password: await bcrypt.hash('logistics123', 12),
            role: 'logistics_officer'
        },
        {
            username: 'logistics_pendleton',
            password: await bcrypt.hash('logistics123', 12),
            role: 'logistics_officer'
        }
    ];

    for (const user of users) {
        await prisma.user.upsert({
            where: { username: user.username },
            update: {},
            create: user,
        });
    }
    logger.info(`Created/updated ${users.length} users.`);

    // Assign users to bases
    const userBragg = await prisma.user.findUnique({ where: { username: 'commander_bragg' } });
    const baseBragg = await prisma.base.findUnique({ where: { name: 'Fort Bragg' } });

    if (userBragg && baseBragg) {
        await prisma.user.update({
            where: { id: userBragg.id },
            data: { base_id: baseBragg.id }
        });
    }

    const logisticsBragg = await prisma.user.findUnique({ where: { username: 'logistics_bragg' } });
    if (logisticsBragg && baseBragg) {
        await prisma.user.update({
            where: { id: logisticsBragg.id },
            data: { base_id: baseBragg.id }
        });
    }

    const userPendleton = await prisma.user.findUnique({ where: { username: 'commander_pendleton' } });
    const basePendleton = await prisma.base.findUnique({ where: { name: 'Camp Pendleton' } });

    if (userPendleton && basePendleton) {
        await prisma.user.update({
            where: { id: userPendleton.id },
            data: { base_id: basePendleton.id }
        });
    }

    const logisticsPendleton = await prisma.user.findUnique({ where: { username: 'logistics_pendleton' } });
    if (logisticsPendleton && basePendleton) {
        await prisma.user.update({
            where: { id: logisticsPendleton.id },
            data: { base_id: basePendleton.id }
        });
    }
    logger.info('Assigned users to bases.');

    // Seed initial assets
    const m4Carbine = await prisma.equipmentType.findUnique({ where: { name: 'M4 Carbine' } });
    const ammo556 = await prisma.equipmentType.findUnique({ where: { name: '5.56mm Ammunition' } });
    const hmmwv = await prisma.equipmentType.findUnique({ where: { name: 'HMMWV' } });

    const assetsData = [
        { name: 'M4-A1', serial_number: 'WPN-001', type_id: m4Carbine.id, base_id: baseBragg.id, status: 'in_storage' },
        { name: 'M4-A2', serial_number: 'WPN-002', type_id: m4Carbine.id, base_id: baseBragg.id, status: 'in_use' },
        { name: 'HMMWV-01', serial_number: 'VEH-001', type_id: hmmwv.id, base_id: basePendleton.id, status: 'under_maintenance' }
    ];

    for (const asset of assetsData) {
        await prisma.asset.create({
            data: asset
        });
    }
    logger.info(`Created ${assetsData.length} initial assets.`);

    logger.info('Seeding finished.');
}

main()
    .catch((e) => {
        logger.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    }); 