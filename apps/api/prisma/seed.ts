import { PrismaClient, UserRole, VenueStatus, MachineStatus, SongFormat } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.songRequest.deleteMany();
  await prisma.playlist.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.queueItem.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.song.deleteMany();
  await prisma.machine.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.globalConfig.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleaned existing data');

  // ============================================
  // USERS
  // ============================================
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin JukeBox',
      email: 'admin@jukebox.com',
      phone: '+5511999990000',
      role: UserRole.ADMIN,
      passwordHash,
    },
  });

  const barOwner1 = await prisma.user.create({
    data: {
      name: 'Carlos Silva',
      email: 'carlos@bar1.com',
      phone: '+5511988881111',
      role: UserRole.BAR_OWNER,
      passwordHash,
    },
  });

  const barOwner2 = await prisma.user.create({
    data: {
      name: 'Ana Costa',
      email: 'ana@bar2.com',
      phone: '+5511977772222',
      role: UserRole.BAR_OWNER,
      passwordHash,
    },
  });

  const customer1 = await prisma.user.create({
    data: {
      name: 'João Santos',
      phone: '+5511966663333',
      role: UserRole.CUSTOMER,
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      name: 'Maria Oliveira',
      phone: '+5511955554444',
      role: UserRole.CUSTOMER,
    },
  });

  const customer3 = await prisma.user.create({
    data: {
      name: 'Pedro Lima',
      phone: '+5511944445555',
      role: UserRole.CUSTOMER,
    },
  });

  console.log('Created users');

  // ============================================
  // VENUES
  // ============================================
  const venue1 = await prisma.venue.create({
    data: {
      code: 'BAR-CARLOS',
      name: 'Bar do Carlos',
      address: 'Rua Augusta, 1200',
      city: 'São Paulo',
      state: 'SP',
      country: 'BR',
      ownerId: barOwner1.id,
      status: VenueStatus.ACTIVE,
      installDate: new Date('2026-01-15'),
      settings: {
        songPrice: 2.0,
        prioritySongPrice: 5.0,
        creditTopUpAmounts: [10, 20, 50, 100],
        barOwnerCommissionPercent: 30,
        featureToggles: {
          skipQueue: true,
          autoPlay: true,
        },
      },
    },
  });

  const venue2 = await prisma.venue.create({
    data: {
      code: 'BOTECO-ANA',
      name: 'Boteco da Ana',
      address: 'Av. Paulista, 800',
      city: 'São Paulo',
      state: 'SP',
      country: 'BR',
      ownerId: barOwner2.id,
      status: VenueStatus.ACTIVE,
      installDate: new Date('2026-02-01'),
      settings: {
        songPrice: 3.0,
        prioritySongPrice: 8.0,
        creditTopUpAmounts: [10, 20, 50],
        barOwnerCommissionPercent: 25,
        featureToggles: {
          skipQueue: true,
          autoPlay: true,
        },
      },
    },
  });

  console.log('Created venues');

  // ============================================
  // MACHINES
  // ============================================
  const machine1 = await prisma.machine.create({
    data: {
      venueId: venue1.id,
      name: 'JukeBox Principal',
      serialNumber: 'JB-2026-001',
      status: MachineStatus.ONLINE,
      lastHeartbeat: new Date(),
      ipAddress: '192.168.1.100',
      config: {
        volume: 80,
        autoPlay: true,
        queueVisible: true,
        venueNameOverlay: 'Bar do Carlos',
      },
    },
  });

  const machine2 = await prisma.machine.create({
    data: {
      venueId: venue2.id,
      name: 'JukeBox Salão',
      serialNumber: 'JB-2026-002',
      status: MachineStatus.ONLINE,
      lastHeartbeat: new Date(),
      ipAddress: '192.168.1.101',
      config: {
        volume: 75,
        autoPlay: true,
        queueVisible: true,
        venueNameOverlay: 'Boteco da Ana',
      },
    },
  });

  console.log('Created machines');

  // ============================================
  // SONGS
  // ============================================
  // All songs are CC0 (Public Domain) from Archive.org — real playable MP3s
  const songs = await Promise.all([
    prisma.song.create({
      data: {
        title: 'Defining Moment',
        artist: 'Donnie Sands',
        album: 'Defining Moment',
        genre: 'Acoustic',
        duration: 235,
        fileUrl: 'https://archive.org/download/DonnieSands-DefiningMoment/12DonnieSands-DefiningMoment.mp3',
        coverArtUrl: 'https://archive.org/services/img/DonnieSands-DefiningMoment',
        format: SongFormat.MP3,
        fileSize: 5500000,
        playCount: 150,
      },
    }),
    prisma.song.create({
      data: {
        title: 'Hero',
        artist: 'Donnie Sands',
        album: 'Hero',
        genre: 'Pop',
        duration: 231,
        fileUrl: 'https://archive.org/download/DonnieSands-Hero/09DonnieSands-Hero.mp3',
        coverArtUrl: 'https://archive.org/services/img/DonnieSands-Hero',
        format: SongFormat.MP3,
        fileSize: 4200000,
        playCount: 200,
      },
    }),
    prisma.song.create({
      data: {
        title: 'The Perfect Storm',
        artist: 'Donnie Sands',
        album: 'The Perfect Storm',
        genre: 'Rock',
        duration: 279,
        fileUrl: 'https://archive.org/download/DonnieSands-ThePerfectStormAcoustic/DonnieSands-ThePerfectStorm.mp3',
        coverArtUrl: 'https://archive.org/services/img/DonnieSands-ThePerfectStormAcoustic',
        format: SongFormat.MP3,
        fileSize: 4800000,
        playCount: 95,
      },
    }),
    prisma.song.create({
      data: {
        title: 'Bad Parenting',
        artist: 'Trench Party',
        album: 'Single',
        genre: 'Indie',
        duration: 137,
        fileUrl: 'https://archive.org/download/BadParenting/TrenchParty-BadParenting.mp3',
        coverArtUrl: 'https://archive.org/services/img/BadParenting',
        format: SongFormat.MP3,
        fileSize: 4000000,
        playCount: 120,
      },
    }),
    prisma.song.create({
      data: {
        title: 'Job 33 Remix',
        artist: 'elperfecto.com',
        album: 'Single',
        genre: 'Electronic',
        duration: 177,
        fileUrl: 'https://archive.org/download/Job33Remix/Job33Remix.mp3',
        coverArtUrl: 'https://archive.org/services/img/Job33Remix',
        format: SongFormat.MP3,
        fileSize: 3800000,
        playCount: 80,
      },
    }),
    prisma.song.create({
      data: {
        title: 'Frecuencias',
        artist: 'Malaventura',
        album: 'Malaventura',
        genre: 'Electronic',
        duration: 333,
        fileUrl: 'https://archive.org/download/malaventura01/01Frecuencias.mp3',
        coverArtUrl: 'https://archive.org/services/img/malaventura01',
        format: SongFormat.MP3,
        fileSize: 4100000,
        playCount: 110,
      },
    }),
    prisma.song.create({
      data: {
        title: 'La Cruz',
        artist: 'Malaventura',
        album: 'Malaventura',
        genre: 'Electronic',
        duration: 245,
        fileUrl: 'https://archive.org/download/malaventura01/02LaCruz.mp3',
        coverArtUrl: 'https://archive.org/services/img/malaventura01',
        format: SongFormat.MP3,
        fileSize: 4500000,
        playCount: 175,
      },
    }),
    prisma.song.create({
      data: {
        title: 'Aldous',
        artist: 'Stig Sneddon',
        album: 'Stig 2010',
        genre: 'Rock',
        duration: 171,
        fileUrl: 'https://archive.org/download/Stig_2010/Aldous.mp3',
        coverArtUrl: 'https://archive.org/services/img/Stig_2010',
        format: SongFormat.MP3,
        fileSize: 4500000,
        playCount: 250,
      },
    }),
    prisma.song.create({
      data: {
        title: 'Four More Years',
        artist: 'Stig Sneddon',
        album: 'Stig 2010',
        genre: 'Rock',
        duration: 192,
        fileUrl: 'https://archive.org/download/Stig_2010/FourMoreYears.mp3',
        coverArtUrl: 'https://archive.org/services/img/Stig_2010',
        format: SongFormat.MP3,
        fileSize: 6200000,
        playCount: 90,
      },
    }),
    prisma.song.create({
      data: {
        title: 'Blues Evermore',
        artist: 'Coleman Hawkins',
        album: 'Jazz Classics',
        genre: 'Jazz',
        duration: 168,
        fileUrl: 'https://archive.org/download/ColemanHawkins_172/ColemanHawkins-01-BluesEvermore-June141938.mp3',
        coverArtUrl: 'https://archive.org/services/img/ColemanHawkins_172',
        format: SongFormat.MP3,
        fileSize: 4000000,
        playCount: 300,
      },
    }),
  ]);

  console.log(`Created ${songs.length} songs`);

  // ============================================
  // WALLETS
  // ============================================
  await Promise.all([
    prisma.wallet.create({
      data: { userId: customer1.id, balance: 25.0 },
    }),
    prisma.wallet.create({
      data: { userId: customer2.id, balance: 50.0, lastTopUp: new Date() },
    }),
    prisma.wallet.create({
      data: { userId: customer3.id, balance: 10.0 },
    }),
  ]);

  console.log('Created wallets');

  // ============================================
  // SAMPLE QUEUE ITEMS
  // ============================================
  await prisma.queueItem.create({
    data: {
      machineId: machine1.id,
      songId: songs[0].id,
      userId: customer1.id,
      position: 1,
      status: 'PLAYING',
      paidAmount: 2.0,
      paymentMethod: 'PIX',
    },
  });

  await prisma.queueItem.create({
    data: {
      machineId: machine1.id,
      songId: songs[3].id,
      userId: customer2.id,
      position: 2,
      status: 'PENDING',
      paidAmount: 2.0,
      paymentMethod: 'WALLET',
    },
  });

  await prisma.queueItem.create({
    data: {
      machineId: machine1.id,
      songId: songs[6].id,
      userId: customer1.id,
      position: 3,
      status: 'PENDING',
      paidAmount: 5.0,
      paymentMethod: 'PIX',
      isPriority: true,
    },
  });

  console.log('Created queue items');

  // ============================================
  // SAMPLE TRANSACTIONS
  // ============================================
  await prisma.transaction.createMany({
    data: [
      {
        userId: customer1.id,
        machineId: machine1.id,
        type: 'SONG_PAYMENT',
        amount: 2.0,
        paymentMethod: 'PIX',
        status: 'COMPLETED',
      },
      {
        userId: customer2.id,
        machineId: machine1.id,
        type: 'SONG_PAYMENT',
        amount: 2.0,
        paymentMethod: 'WALLET',
        status: 'COMPLETED',
      },
      {
        userId: customer1.id,
        machineId: machine1.id,
        type: 'SKIP_QUEUE',
        amount: 5.0,
        paymentMethod: 'PIX',
        status: 'COMPLETED',
      },
      {
        userId: customer2.id,
        type: 'CREDIT_PURCHASE',
        amount: 50.0,
        paymentMethod: 'PIX',
        status: 'COMPLETED',
      },
    ],
  });

  console.log('Created transactions');

  // ============================================
  // SAMPLE PLAYLISTS
  // ============================================
  await prisma.playlist.create({
    data: {
      userId: customer1.id,
      name: 'Minhas Favoritas',
      songIds: [songs[0].id, songs[3].id, songs[6].id],
    },
  });

  console.log('Created playlists');

  // ============================================
  // GLOBAL CONFIG
  // ============================================
  await prisma.globalConfig.createMany({
    data: [
      {
        key: 'defaultPricing',
        value: {
          songPrice: 2.0,
          prioritySongPrice: 5.0,
          creditTopUpAmounts: [10, 20, 50, 100],
          barOwnerCommissionPercent: 30,
        },
      },
      {
        key: 'featureToggles',
        value: {
          skipQueue: true,
          autoPlay: true,
          playlists: true,
        },
      },
    ],
  });

  console.log('Created global config');
  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
