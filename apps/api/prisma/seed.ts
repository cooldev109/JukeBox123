import { PrismaClient, UserRole, VenueStatus, MachineStatus, SongFormat } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data (order matters for foreign keys)
  await prisma.comboItem.deleteMany();
  await prisma.venueProductPrice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.affiliateReferral.deleteMany();
  await prisma.machineAlert.deleteMany();
  await prisma.specialEvent.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.songRequest.deleteMany();
  await prisma.playlist.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.queueItem.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.regionCatalog.deleteMany();
  await prisma.song.deleteMany();
  await prisma.album.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.genre.deleteMany();
  await prisma.machine.deleteMany();
  await prisma.region.deleteMany();
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
      email: 'joao@test.com',
      phone: '+5511966663333',
      role: UserRole.CUSTOMER,
      passwordHash,
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      name: 'Maria Oliveira',
      email: 'maria@test.com',
      phone: '+5511955554444',
      role: UserRole.CUSTOMER,
      passwordHash,
    },
  });

  const customer3 = await prisma.user.create({
    data: {
      name: 'Pedro Lima',
      email: 'pedro@test.com',
      phone: '+5511944445555',
      role: UserRole.CUSTOMER,
      passwordHash,
    },
  });

  // Stage 2: Employees
  const employee1 = await prisma.user.create({
    data: {
      name: 'Lucas Mendes',
      email: 'lucas@jukebox.com',
      phone: '+5511933336666',
      role: UserRole.EMPLOYEE,
      passwordHash,
      regionAccess: 'SP',
    },
  });

  await prisma.user.create({
    data: {
      name: 'Fernanda Rocha',
      email: 'fernanda@jukebox.com',
      phone: '+5521933337777',
      role: UserRole.EMPLOYEE,
      passwordHash,
      regionAccess: 'RJ',
    },
  });

  // Stage 2: Affiliates
  const affiliate1 = await prisma.user.create({
    data: {
      name: 'Rafael Promoter',
      email: 'rafael@promo.com',
      phone: '+5511922228888',
      role: UserRole.AFFILIATE,
      passwordHash,
      referralCode: 'RAFAEL2026',
    },
  });

  const affiliate2 = await prisma.user.create({
    data: {
      name: 'Camila Waiter',
      email: 'camila@promo.com',
      phone: '+5511911119999',
      role: UserRole.AFFILIATE,
      passwordHash,
      referralCode: 'CAMILA2026',
    },
  });

  console.log('Created users (including employees and affiliates)');

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
        affiliateCommissionPercent: 25,
        featureToggles: {
          skipQueue: true,
          autoPlay: true,
          silence: true,
          voiceMessage: true,
          textMessage: true,
          photo: true,
          reactions: true,
          birthday: true,
        },
        specialEventPricing: {
          silence1min: 5.0,
          silence2min: 10.0,
          silence3min: 15.0,
          textMessage: 2.0,
          voiceMessage5s: 8.0,
          voiceMessage15s: 10.0,
          photo: 5.0,
          reaction: 1.0,
          birthdayPackage: 25.0,
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
        affiliateCommissionPercent: 20,
        featureToggles: {
          skipQueue: true,
          autoPlay: true,
          silence: true,
          voiceMessage: false,
          textMessage: true,
          photo: false,
          reactions: true,
          birthday: false,
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
  // MUSIC CATALOG: Genres → Artists → Albums → Songs
  // ============================================

  // Genres
  const genreAcoustic = await prisma.genre.create({ data: { name: 'Acoustic', sortOrder: 1 } });
  const genrePop = await prisma.genre.create({ data: { name: 'Pop', sortOrder: 2 } });
  const genreRock = await prisma.genre.create({ data: { name: 'Rock', sortOrder: 3 } });
  const genreIndie = await prisma.genre.create({ data: { name: 'Indie', sortOrder: 4 } });
  const genreElectronic = await prisma.genre.create({ data: { name: 'Electronic', sortOrder: 5 } });
  const genreJazz = await prisma.genre.create({ data: { name: 'Jazz', sortOrder: 6 } });

  console.log('Created genres');

  // Artists
  const artistDonnieSandsAcoustic = await prisma.artist.create({ data: { name: 'Donnie Sands', genreId: genreAcoustic.id } });
  const artistDonnieSandsPop = await prisma.artist.create({ data: { name: 'Donnie Sands', genreId: genrePop.id } });
  const artistDonnieSandsRock = await prisma.artist.create({ data: { name: 'Donnie Sands', genreId: genreRock.id } });
  const artistTrenchParty = await prisma.artist.create({ data: { name: 'Trench Party', genreId: genreIndie.id } });
  const artistElperfecto = await prisma.artist.create({ data: { name: 'elperfecto.com', genreId: genreElectronic.id } });
  const artistMalaventura = await prisma.artist.create({ data: { name: 'Malaventura', genreId: genreElectronic.id } });
  const artistStigSneddon = await prisma.artist.create({ data: { name: 'Stig Sneddon', genreId: genreRock.id } });
  const artistColemanHawkins = await prisma.artist.create({ data: { name: 'Coleman Hawkins', genreId: genreJazz.id } });

  console.log('Created artists');

  // Albums
  const albumDefiningMoment = await prisma.album.create({ data: { name: 'Defining Moment', artistId: artistDonnieSandsAcoustic.id } });
  const albumHero = await prisma.album.create({ data: { name: 'Hero', artistId: artistDonnieSandsPop.id } });
  const albumPerfectStorm = await prisma.album.create({ data: { name: 'The Perfect Storm', artistId: artistDonnieSandsRock.id } });
  const albumTrenchPartySingle = await prisma.album.create({ data: { name: 'Single', artistId: artistTrenchParty.id } });
  const albumElperfectoSingle = await prisma.album.create({ data: { name: 'Single', artistId: artistElperfecto.id } });
  const albumMalaventura = await prisma.album.create({ data: { name: 'Malaventura', artistId: artistMalaventura.id } });
  const albumStig2010 = await prisma.album.create({ data: { name: 'Stig 2010', artistId: artistStigSneddon.id, year: 2010 } });
  const albumJazzClassics = await prisma.album.create({ data: { name: 'Jazz Classics', artistId: artistColemanHawkins.id } });

  console.log('Created albums');

  // Songs (linked to hierarchy via albumId)
  const songs = await Promise.all([
    prisma.song.create({
      data: {
        title: 'Defining Moment', artist: 'Donnie Sands', album: 'Defining Moment', genre: 'Acoustic',
        duration: 235, fileUrl: 'https://archive.org/download/DonnieSands-DefiningMoment/12DonnieSands-DefiningMoment.mp3',
        coverArtUrl: 'https://archive.org/services/img/DonnieSands-DefiningMoment', format: SongFormat.MP3, fileSize: 5500000, playCount: 150,
        albumId: albumDefiningMoment.id, trackNumber: 1,
      },
    }),
    prisma.song.create({
      data: {
        title: 'Hero', artist: 'Donnie Sands', album: 'Hero', genre: 'Pop',
        duration: 231, fileUrl: 'https://archive.org/download/DonnieSands-Hero/09DonnieSands-Hero.mp3',
        coverArtUrl: 'https://archive.org/services/img/DonnieSands-Hero', format: SongFormat.MP3, fileSize: 4200000, playCount: 200,
        albumId: albumHero.id, trackNumber: 1,
      },
    }),
    prisma.song.create({
      data: {
        title: 'The Perfect Storm', artist: 'Donnie Sands', album: 'The Perfect Storm', genre: 'Rock',
        duration: 279, fileUrl: 'https://archive.org/download/DonnieSands-ThePerfectStormAcoustic/DonnieSands-ThePerfectStorm.mp3',
        coverArtUrl: 'https://archive.org/services/img/DonnieSands-ThePerfectStormAcoustic', format: SongFormat.MP3, fileSize: 4800000, playCount: 95,
        albumId: albumPerfectStorm.id, trackNumber: 1,
      },
    }),
    prisma.song.create({
      data: {
        title: 'Bad Parenting', artist: 'Trench Party', album: 'Single', genre: 'Indie',
        duration: 137, fileUrl: 'https://archive.org/download/BadParenting/TrenchParty-BadParenting.mp3',
        coverArtUrl: 'https://archive.org/services/img/BadParenting', format: SongFormat.MP3, fileSize: 4000000, playCount: 120,
        albumId: albumTrenchPartySingle.id, trackNumber: 1,
      },
    }),
    prisma.song.create({
      data: {
        title: 'Job 33 Remix', artist: 'elperfecto.com', album: 'Single', genre: 'Electronic',
        duration: 177, fileUrl: 'https://archive.org/download/Job33Remix/Job33Remix.mp3',
        coverArtUrl: 'https://archive.org/services/img/Job33Remix', format: SongFormat.MP3, fileSize: 3800000, playCount: 80,
        albumId: albumElperfectoSingle.id, trackNumber: 1,
      },
    }),
    prisma.song.create({
      data: {
        title: 'Frecuencias', artist: 'Malaventura', album: 'Malaventura', genre: 'Electronic',
        duration: 333, fileUrl: 'https://archive.org/download/malaventura01/01Frecuencias.mp3',
        coverArtUrl: 'https://archive.org/services/img/malaventura01', format: SongFormat.MP3, fileSize: 4100000, playCount: 110,
        albumId: albumMalaventura.id, trackNumber: 1,
      },
    }),
    prisma.song.create({
      data: {
        title: 'La Cruz', artist: 'Malaventura', album: 'Malaventura', genre: 'Electronic',
        duration: 245, fileUrl: 'https://archive.org/download/malaventura01/02LaCruz.mp3',
        coverArtUrl: 'https://archive.org/services/img/malaventura01', format: SongFormat.MP3, fileSize: 4500000, playCount: 175,
        albumId: albumMalaventura.id, trackNumber: 2,
      },
    }),
    prisma.song.create({
      data: {
        title: 'Aldous', artist: 'Stig Sneddon', album: 'Stig 2010', genre: 'Rock',
        duration: 171, fileUrl: 'https://archive.org/download/Stig_2010/Aldous.mp3',
        coverArtUrl: 'https://archive.org/services/img/Stig_2010', format: SongFormat.MP3, fileSize: 4500000, playCount: 250,
        albumId: albumStig2010.id, trackNumber: 1,
      },
    }),
    prisma.song.create({
      data: {
        title: 'Four More Years', artist: 'Stig Sneddon', album: 'Stig 2010', genre: 'Rock',
        duration: 192, fileUrl: 'https://archive.org/download/Stig_2010/FourMoreYears.mp3',
        coverArtUrl: 'https://archive.org/services/img/Stig_2010', format: SongFormat.MP3, fileSize: 6200000, playCount: 90,
        albumId: albumStig2010.id, trackNumber: 2,
      },
    }),
    prisma.song.create({
      data: {
        title: 'Blues Evermore', artist: 'Coleman Hawkins', album: 'Jazz Classics', genre: 'Jazz',
        duration: 168, fileUrl: 'https://archive.org/download/ColemanHawkins_172/ColemanHawkins-01-BluesEvermore-June141938.mp3',
        coverArtUrl: 'https://archive.org/services/img/ColemanHawkins_172', format: SongFormat.MP3, fileSize: 4000000, playCount: 300,
        albumId: albumJazzClassics.id, trackNumber: 1,
      },
    }),
  ]);

  console.log(`Created ${songs.length} songs (linked to catalog hierarchy)`);

  // ============================================
  // WALLETS
  // ============================================
  await Promise.all([
    prisma.wallet.create({ data: { userId: customer1.id, balance: 25.0 } }),
    prisma.wallet.create({ data: { userId: customer2.id, balance: 50.0, lastTopUp: new Date() } }),
    prisma.wallet.create({ data: { userId: customer3.id, balance: 10.0 } }),
    prisma.wallet.create({ data: { userId: affiliate1.id, balance: 15.0 } }),
    prisma.wallet.create({ data: { userId: affiliate2.id, balance: 5.0 } }),
  ]);

  console.log('Created wallets');

  // ============================================
  // SAMPLE QUEUE ITEMS
  // ============================================
  await prisma.queueItem.createMany({
    data: [
      { machineId: machine1.id, songId: songs[0].id, userId: customer1.id, position: 1, status: 'PLAYING', paidAmount: 2.0, paymentMethod: 'PIX' },
      { machineId: machine1.id, songId: songs[3].id, userId: customer2.id, position: 2, status: 'PENDING', paidAmount: 2.0, paymentMethod: 'WALLET' },
      { machineId: machine1.id, songId: songs[6].id, userId: customer1.id, position: 3, status: 'PENDING', paidAmount: 5.0, paymentMethod: 'PIX', isPriority: true },
    ],
  });

  console.log('Created queue items');

  // ============================================
  // SAMPLE TRANSACTIONS
  // ============================================
  const transactions = await Promise.all([
    prisma.transaction.create({ data: { userId: customer1.id, machineId: machine1.id, type: 'SONG_PAYMENT', amount: 2.0, paymentMethod: 'PIX', status: 'COMPLETED' } }),
    prisma.transaction.create({ data: { userId: customer2.id, machineId: machine1.id, type: 'SONG_PAYMENT', amount: 2.0, paymentMethod: 'WALLET', status: 'COMPLETED' } }),
    prisma.transaction.create({ data: { userId: customer1.id, machineId: machine1.id, type: 'SKIP_QUEUE', amount: 5.0, paymentMethod: 'PIX', status: 'COMPLETED' } }),
    prisma.transaction.create({ data: { userId: customer2.id, type: 'CREDIT_PURCHASE', amount: 50.0, paymentMethod: 'PIX', status: 'COMPLETED' } }),
    prisma.transaction.create({ data: { userId: customer1.id, machineId: machine1.id, type: 'SONG_PAYMENT', amount: 2.0, paymentMethod: 'CREDIT_CARD', status: 'COMPLETED', stripePaymentId: `pi_test_${crypto.randomUUID().slice(0, 16)}` } }),
  ]);

  console.log('Created transactions');

  // ============================================
  // SAMPLE PLAYLISTS
  // ============================================
  await prisma.playlist.create({
    data: { userId: customer1.id, name: 'Minhas Favoritas', songIds: [songs[0].id, songs[3].id, songs[6].id] },
  });

  console.log('Created playlists');

  // ============================================
  // STAGE 2: AFFILIATE REFERRALS
  // ============================================
  await prisma.affiliateReferral.createMany({
    data: [
      { affiliateId: affiliate1.id, venueId: venue1.id, referralCode: 'RAFAEL2026', commissionPercent: 75, durationMonths: 3, startDate: new Date('2026-02-01'), endDate: new Date('2026-05-01'), isActive: true },
      { affiliateId: affiliate2.id, venueId: venue2.id, referralCode: 'CAMILA2026', commissionPercent: 50, durationMonths: 6, startDate: new Date('2026-01-15'), endDate: new Date('2026-07-15'), isActive: true },
    ],
  });

  console.log('Created affiliate referrals');

  // ============================================
  // STAGE 2: COMMISSIONS
  // ============================================
  await prisma.commission.createMany({
    data: [
      { affiliateId: affiliate1.id, transactionId: transactions[0].id, venueId: venue1.id, percentage: 25, amount: 0.50, type: 'SALE', status: 'PENDING' },
      { affiliateId: affiliate1.id, transactionId: transactions[2].id, venueId: venue1.id, percentage: 25, amount: 1.25, type: 'SALE', status: 'PAID', paidAt: new Date() },
      { affiliateId: affiliate1.id, transactionId: transactions[4].id, venueId: venue1.id, percentage: 75, amount: 1.50, type: 'VENUE_REFERRAL', status: 'PENDING', referralDuration: 3, referralPercentage: 75 },
    ],
  });

  console.log('Created commissions');

  // ============================================
  // STAGE 2: MACHINE ALERTS
  // ============================================
  await prisma.machineAlert.createMany({
    data: [
      { machineId: machine1.id, type: 'OFFLINE', message: 'Machine went offline — no heartbeat for 5 minutes', severity: 'HIGH', isResolved: true, resolvedAt: new Date(), resolvedById: employee1.id, notifiedVia: 'DASHBOARD' },
      { machineId: machine2.id, type: 'PAYMENT_ERROR', message: 'Pix payment gateway returned error 503', severity: 'MEDIUM', isResolved: false, notifiedVia: 'WHATSAPP' },
      { machineId: machine2.id, type: 'OWNER_INACTIVE', message: 'Bar owner has not turned on machine for 4 days', severity: 'LOW', isResolved: false, notifiedVia: 'DASHBOARD' },
    ],
  });

  console.log('Created machine alerts');

  // ============================================
  // STAGE 2: SPECIAL EVENTS
  // ============================================
  await prisma.specialEvent.createMany({
    data: [
      { machineId: machine1.id, userId: customer1.id, type: 'TEXT_MESSAGE', content: 'Feliz aniversário, Maria!', duration: 15, amount: 2.0, status: 'PLAYED', approvedById: barOwner1.id },
      { machineId: machine1.id, userId: customer2.id, type: 'SILENCE', duration: 60, amount: 5.0, status: 'PLAYED' },
      { machineId: machine1.id, userId: customer3.id, type: 'VOICE_MESSAGE', content: 'https://example.com/voice/msg123.ogg', duration: 5, amount: 8.0, status: 'PENDING_APPROVAL' },
      { machineId: machine1.id, userId: customer1.id, type: 'REACTION', content: 'applause', amount: 1.0, status: 'PLAYED' },
    ],
  });

  console.log('Created special events');

  // ============================================
  // STAGE 2: BANNERS
  // ============================================
  await prisma.banner.createMany({
    data: [
      { targetRole: 'AFFILIATE', message: 'Promoção de Março: ganhe 50% extra em comissões neste mês!', isActive: true, startDate: new Date('2026-03-01'), endDate: new Date('2026-03-31'), createdById: admin.id },
      { targetRole: 'CUSTOMER', message: 'Happy Hour: músicas a R$1 das 18h às 20h!', isActive: true, startDate: new Date('2026-03-01'), endDate: new Date('2026-04-30'), createdById: admin.id },
      { targetRole: 'ALL', message: 'Bem-vindo ao JukeBox! Escaneie o QR code para começar.', isActive: true, createdById: admin.id },
    ],
  });

  console.log('Created banners');

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
          affiliateCommissionPercent: 25,
          specialEventPricing: {
            silence1min: 5.0, silence2min: 10.0, silence3min: 15.0,
            textMessage: 2.0, voiceMessage5s: 8.0, voiceMessage15s: 10.0,
            photo: 5.0, reaction: 1.0, birthdayPackage: 25.0,
          },
        },
      },
      {
        key: 'featureToggles',
        value: {
          skipQueue: true, autoPlay: true, playlists: true,
          silence: true, voiceMessage: true, textMessage: true,
          photo: true, reactions: true, birthday: true,
          stripePayments: true,
        },
      },
    ],
  });

  console.log('Created global config');

  // ============================================
  // REGIONS & REGIONAL CATALOG
  // ============================================
  const regionSP = await prisma.region.create({ data: { code: 'SP', name: 'São Paulo' } });
  const regionRJ = await prisma.region.create({ data: { code: 'RJ', name: 'Rio de Janeiro' } });

  // Link venues to regions
  await prisma.venue.update({ where: { id: venue1.id }, data: { regionId: regionSP.id } });
  await prisma.venue.update({ where: { id: venue2.id }, data: { regionId: regionSP.id } });

  // Regional catalog: make all genres available in SP, only Rock/Jazz in RJ
  await prisma.regionCatalog.createMany({
    data: [
      { regionId: regionSP.id, genreId: genreAcoustic.id, priority: 1 },
      { regionId: regionSP.id, genreId: genrePop.id, priority: 2 },
      { regionId: regionSP.id, genreId: genreRock.id, priority: 3 },
      { regionId: regionSP.id, genreId: genreIndie.id, priority: 4 },
      { regionId: regionSP.id, genreId: genreElectronic.id, priority: 5 },
      { regionId: regionSP.id, genreId: genreJazz.id, priority: 6 },
      { regionId: regionRJ.id, genreId: genreRock.id, priority: 1 },
      { regionId: regionRJ.id, genreId: genreJazz.id, priority: 2 },
    ],
  });

  console.log('Created regions and regional catalog');

  // ============================================
  // PRODUCTS (Flexible Pricing)
  // ============================================
  const productData = [
    // Music
    { code: 'SONG', name: 'Regular Song', category: 'MUSIC', basePrice: 1.20, sortOrder: 1, metadata: {} },
    { code: 'PRIORITY_SONG', name: 'Priority Song', category: 'MUSIC', basePrice: 2.00, sortOrder: 2, metadata: {} },
    // Special Events
    { code: 'SKIP_QUEUE', name: 'Skip Queue', category: 'SPECIAL_EVENT', basePrice: 2.00, sortOrder: 10, metadata: {} },
    { code: 'SILENCE_15S', name: 'Silence 15s', category: 'SPECIAL_EVENT', basePrice: 1.00, sortOrder: 20, metadata: { durationSeconds: 15 } },
    { code: 'SILENCE_30S', name: 'Silence 30s', category: 'SPECIAL_EVENT', basePrice: 2.00, sortOrder: 21, metadata: { durationSeconds: 30 } },
    { code: 'SILENCE_60S', name: 'Silence 60s', category: 'SPECIAL_EVENT', basePrice: 5.00, sortOrder: 22, metadata: { durationSeconds: 60 } },
    { code: 'SILENCE_CUSTOM', name: 'Custom Silence', category: 'SPECIAL_EVENT', basePrice: 0.10, sortOrder: 23, metadata: { perSecond: true, pricePerSecond: 0.10 } },
    { code: 'TEXT_MESSAGE', name: 'Text Message', category: 'SPECIAL_EVENT', basePrice: 1.00, sortOrder: 30, metadata: { maxLength: 200 } },
    { code: 'VOICE_MESSAGE', name: 'Voice Message', category: 'SPECIAL_EVENT', basePrice: 3.00, sortOrder: 31, metadata: { requiresApproval: true } },
    { code: 'PHOTO', name: 'Photo Display', category: 'SPECIAL_EVENT', basePrice: 2.00, sortOrder: 40, metadata: { requiresApproval: true } },
    { code: 'MEME', name: 'Meme', category: 'SPECIAL_EVENT', basePrice: 1.00, sortOrder: 41, metadata: {} },
    { code: 'REACTION', name: 'Reaction', category: 'SPECIAL_EVENT', basePrice: 0.50, sortOrder: 50, metadata: { types: ['APPLAUSE', 'BOO', 'LAUGH', 'HEART', 'FIRE'] } },
    { code: 'BIRTHDAY', name: 'Birthday Pack', category: 'SPECIAL_EVENT', basePrice: 15.00, sortOrder: 60, metadata: {} },
    { code: 'SELFIE', name: 'Selfie Display', category: 'SPECIAL_EVENT', basePrice: 2.00, sortOrder: 42, metadata: {} },
    // Combos
    { code: 'COMBO_BIRTHDAY_DELUXE', name: 'Birthday Deluxe Pack', description: 'Birthday + 60s Silence + Photo + Text Message', category: 'COMBO', basePrice: 25.00, sortOrder: 100, metadata: {} },
    { code: 'COMBO_SELFIE_MEME', name: 'Selfie + Meme Pack', description: 'Selfie Display + Meme', category: 'COMBO', basePrice: 3.50, sortOrder: 101, metadata: {} },
  ];

  const createdProducts: Record<string, string> = {};
  for (const p of productData) {
    const product = await prisma.product.create({ data: p });
    createdProducts[p.code] = product.id;
  }

  // Combo items
  await prisma.comboItem.createMany({
    data: [
      { comboId: createdProducts['COMBO_BIRTHDAY_DELUXE'], productId: createdProducts['BIRTHDAY'], quantity: 1 },
      { comboId: createdProducts['COMBO_BIRTHDAY_DELUXE'], productId: createdProducts['SILENCE_60S'], quantity: 1 },
      { comboId: createdProducts['COMBO_BIRTHDAY_DELUXE'], productId: createdProducts['PHOTO'], quantity: 1 },
      { comboId: createdProducts['COMBO_BIRTHDAY_DELUXE'], productId: createdProducts['TEXT_MESSAGE'], quantity: 1 },
      { comboId: createdProducts['COMBO_SELFIE_MEME'], productId: createdProducts['SELFIE'], quantity: 1 },
      { comboId: createdProducts['COMBO_SELFIE_MEME'], productId: createdProducts['MEME'], quantity: 1 },
    ],
  });

  console.log('Created products and combos');
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
