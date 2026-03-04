import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import * as mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    registrationNumber: { type: String, required: true, unique: true },
    taxNumber: { type: String, required: true, unique: true },
    address: {
      street: String,
      district: String,
      city: String,
      region: String,
      country: String,
      postalCode: String,
    },
    contact: {
      primaryEmail: String,
      primaryPhone: String,
    },
    settings: {
      baseCurrency: { type: String, enum: ['USD'], default: 'USD' },
      allowedCurrencies: { type: [String], enum: ['USD'], default: ['USD'] },
      vatRate: { type: Number, default: 0 },
      lateFeeType: { type: String, enum: ['fixed', 'percentage'], default: 'percentage' },
      lateFeeValue: { type: Number, default: 5 },
      gracePeriodDays: { type: Number, default: 5 },
      invoiceDueDays: { type: Number, default: 5 },
      rentDueDay: { type: Number, default: 1 },
    },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'organizations' },
);

const userSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    email: { type: String, required: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    role: { type: String, required: true },
    permissions: { type: [String], default: ['*'] },
    accessibleBuildings: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    status: { type: String, default: 'active' },
    security: {
      passwordChangedAt: Date,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'users' },
);

const OrganizationModel = mongoose.model('OrganizationSeed', organizationSchema, 'organizations');
const UserModel = mongoose.model('UserSeed', userSchema, 'users');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required for seeding.');
  }

  await mongoose.connect(uri);

  const orgName = 'Banadir Property Management';
  let org = await OrganizationModel.findOne({ name: orgName, deletedAt: null });

  if (!org) {
    org = await OrganizationModel.create({
      name: orgName,
      registrationNumber: 'SO-REG-2026-0001',
      taxNumber: 'SO-TAX-001234',
      address: {
        street: 'Maka Al-Mukarama Road',
        district: 'Hodan',
        city: 'Mogadishu',
        region: 'Banadir',
        country: 'Somalia',
      },
      contact: {
        primaryEmail: 'info@banadirproperty.so',
        primaryPhone: '+252615551234',
      },
      settings: {
        baseCurrency: 'USD',
        allowedCurrencies: ['USD'],
        vatRate: 0,
        lateFeeType: 'percentage',
        lateFeeValue: 5,
        gracePeriodDays: 5,
        invoiceDueDays: 5,
        rentDueDay: 1,
      },
      isActive: true,
      deletedAt: null,
    });
    console.log('Created organization:', orgName);
  } else {
    console.log('Organization already exists:', orgName);
  }

  const adminEmail = 'admin@banadirproperty.so';
  const existingAdmin = await UserModel.findOne({
    organizationId: org._id,
    email: adminEmail,
    deletedAt: null,
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('ChangeMe123!', 12);

    await UserModel.create({
      organizationId: org._id,
      email: adminEmail,
      passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      role: 'admin',
      permissions: ['*'],
      accessibleBuildings: [],
      status: 'active',
      security: {
        passwordChangedAt: new Date(),
      },
      deletedAt: null,
    });

    console.log('Created admin user:', adminEmail);
    console.log('Default password: ChangeMe123! (change immediately)');
  } else {
    console.log('Admin user already exists:', adminEmail);
  }

  await mongoose.disconnect();
  console.log('Seed complete.');
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
