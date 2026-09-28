'use strict';

/**
 * Idempotent seed: three users, fifteen disasters spanning three statuses and
 * eleven cities, thirty-plus resources geographically diverse.
 *
 * Run with `npm run seed`. Reruns converge instead of duplicating.
 */

const path = require('path');
process.chdir(path.resolve(__dirname, '..'));

const { connectDatabase, disconnectDatabase, syncIndexes } = require('../lib/server/db');
const logger = require('../lib/server/utils/logger');
const { toGeoJSONPoint } = require('../lib/server/utils/geo');
const { resolveLocation } = require('../lib/server/services/geocoding');

const User = require('../lib/server/models/User');
const Disaster = require('../lib/server/models/Disaster');
const Resource = require('../lib/server/models/Resource');
const Report = require('../lib/server/models/Report');

const USERS = [
  { username: 'admin',       password: 'Admin@12345',   role: 'admin',       displayName: 'Platform Admin' },
  { username: 'contributor', password: 'Contrib@12345', role: 'contributor', displayName: 'Field Contributor' },
  { username: 'reliefops',   password: 'Relief@12345',  role: 'contributor', displayName: 'Relief Ops Team' },
];

const RESOURCES = [
  // Manhattan core
  { name: 'Midtown Community Shelter',        type: 'shelter',  label: 'Midtown, Manhattan',           lat: 40.7549, lng: -73.984,  capacity: 450,  notes: 'Cots, hot meals, charging stations. Pet-friendly annex.' },
  { name: 'Grand Central Relief Kitchen',     type: 'food',     label: 'Grand Central, Manhattan',     lat: 40.7527, lng: -73.9772, capacity: 900,  notes: 'Open 24h during declared emergencies. Halal and vegetarian meals.' },
  { name: 'Bellevue Emergency Department',    type: 'hospital', label: 'Kips Bay, Manhattan',          lat: 40.7359, lng: -73.9811, capacity: 120,  notes: 'Level 1 trauma centre. Burn unit on site.' },
  { name: 'Lower Manhattan Water Point',      type: 'water',    label: 'Battery Park, Manhattan',      lat: 40.7033, lng: -74.017,  capacity: 3000, notes: 'Bottled and potable tank access.' },
  { name: 'Tribeca Rescue Staging',           type: 'rescue',   label: 'Tribeca, Manhattan',           lat: 40.7195, lng: -74.0089, capacity: 60,   notes: 'Swift-water and rope teams.' },
  { name: 'Chinatown Mutual Aid Depot',       type: 'food',     label: 'Chinatown, Manhattan',         lat: 40.7158, lng: -73.997,  capacity: 600,  notes: 'Community-run pantry, multilingual volunteers.' },
  // Boroughs
  { name: 'Williamsburg Emergency Shelter',   type: 'shelter',  label: 'Williamsburg, Brooklyn',       lat: 40.7145, lng: -73.9574, capacity: 300,  notes: 'School gymnasium, pet friendly.' },
  { name: 'Brooklyn Navy Yard Supply Depot',  type: 'food',     label: 'Navy Yard, Brooklyn',          lat: 40.7003, lng: -73.9725, capacity: 5000, notes: 'Primary distribution site for south Brooklyn.' },
  { name: 'Maimonides Emergency Department',  type: 'hospital', label: 'Borough Park, Brooklyn',       lat: 40.618,  lng: -73.994,  capacity: 200,  notes: 'Level 2 trauma, dialysis on standby.' },
  { name: 'Astoria Water Distribution',       type: 'water',    label: 'Astoria, Queens',              lat: 40.7644, lng: -73.9235, capacity: 2000, notes: 'Tanker refill every 4 hours.' },
  { name: 'Flushing Rescue Unit',             type: 'rescue',   label: 'Flushing, Queens',             lat: 40.7442, lng: -73.8447, capacity: 40,   notes: 'Volunteer unit, weekend staffed.' },
  { name: 'Coney Island Coastal Rescue',      type: 'rescue',   label: 'Coney Island, Brooklyn',       lat: 40.5749, lng: -73.9857, capacity: 90,   notes: 'Coast-guard liaison, jet skis.' },
  // Greater metro
  { name: 'Newark Airport Relief Hub',        type: 'shelter',  label: 'Newark, New Jersey',           lat: 40.6895, lng: -74.1745, capacity: 2000, notes: 'Federal-coordinated site.' },
  { name: 'Yonkers Flood Supply Store',       type: 'water',    label: 'Yonkers, New York',            lat: 40.9312, lng: -73.8988, capacity: 1500, notes: 'Sandbag depot co-located.' },
  { name: 'Stamford Coastal Evacuation Point',type: 'rescue',   label: 'Stamford, Connecticut',        lat: 41.0534, lng: -73.5387, capacity: 800,  notes: 'Coastal surge staging.' },
  // Washington DC
  { name: 'DC National Emergency Shelter',    type: 'shelter',  label: 'Washington, DC',               lat: 38.9072, lng: -77.0369, capacity: 1200, notes: 'FEMA-designated primary shelter.' },
  { name: 'Capitol Hill Medical Station',     type: 'hospital', label: 'Capitol Hill, Washington DC',  lat: 38.8899, lng: -77.0091, capacity: 150,  notes: 'Field surgery capability.' },
  { name: 'Anacostia Water Point',            type: 'water',    label: 'Anacostia, Washington DC',     lat: 38.8573, lng: -76.9967, capacity: 1800, notes: '' },
  { name: 'Georgetown Cooling Centre',        type: 'shelter',  label: 'Georgetown, Washington DC',    lat: 38.9076, lng: -77.0723, capacity: 400,  notes: 'Air-conditioned, refrigerated meds storage.' },
  // Boston, Miami, NOLA, LA
  { name: 'Boston Common Field Hospital',     type: 'hospital', label: 'Downtown Boston',              lat: 42.3551, lng: -71.0656, capacity: 220,  notes: 'Deployable tented triage.' },
  { name: 'Cambridge Emergency Kitchen',      type: 'food',     label: 'Cambridge, Massachusetts',     lat: 42.3736, lng: -71.1097, capacity: 700,  notes: 'MIT co-op partnership.' },
  { name: 'Miami Beach Storm Shelter',        type: 'shelter',  label: 'Miami Beach, Florida',         lat: 25.7907, lng: -80.13,   capacity: 1600, notes: 'Storm-hardened school building.' },
  { name: 'Little Havana Water Depot',        type: 'water',    label: 'Little Havana, Miami',         lat: 25.7659, lng: -80.2148, capacity: 2400, notes: 'Bilingual staff.' },
  { name: 'French Quarter Rescue Post',       type: 'rescue',   label: 'French Quarter, New Orleans',  lat: 29.9584, lng: -90.0644, capacity: 55,   notes: 'Airboat launch point.' },
  { name: 'Downtown LA Wildfire Shelter',     type: 'shelter',  label: 'Downtown Los Angeles',         lat: 34.0407, lng: -118.2468,capacity: 900,  notes: 'HEPA-filtered clean-air rooms.' },
  { name: 'Hollywood Community Kitchen',      type: 'food',     label: 'Hollywood, Los Angeles',       lat: 34.0928, lng: -118.3287,capacity: 800,  notes: 'Restaurant-industry mutual aid.' },
  // International
  { name: 'Mumbai Monsoon Relief Camp',       type: 'shelter',  label: 'Mumbai, Maharashtra',          lat: 19.076,  lng: 72.8777,  capacity: 3500, notes: 'Municipal school block.' },
  { name: 'Delhi Central Aid Kitchen',        type: 'food',     label: 'Delhi, India',                 lat: 28.6139, lng: 77.209,   capacity: 5000, notes: 'Community langar, 24/7.' },
  { name: 'Kathmandu Field Hospital',         type: 'hospital', label: 'Kathmandu, Nepal',             lat: 27.7172, lng: 85.324,   capacity: 180,  notes: 'International medical corps capability.' },
  { name: 'Manila Storm Surge Rescue',        type: 'rescue',   label: 'Manila, Philippines',          lat: 14.5995, lng: 120.9842, capacity: 120,  notes: 'Coast guard co-located.' },
  { name: 'Jakarta Community Water Point',    type: 'water',    label: 'Jakarta, Indonesia',           lat: -6.2088, lng: 106.8456, capacity: 2600, notes: '' },
];

const DISASTERS = [
  { title: 'Severe flooding across Lower Manhattan', tags: ['flood','storm','urban','power-outage'], status: 'active',
    description: 'Heavy flooding has affected Manhattan, NYC. Streets are impassable between Houston and Canal, and two residents report being stranded on the 14th floor. Con Edison has proactively cut power to sub-street infrastructure.' },
  { title: 'Wildfire smoke forcing evacuations in Queens', tags: ['wildfire','air-quality','evacuation'], status: 'active',
    description: 'A fast-moving wildfire near Flushing, Queens has blanketed the borough in smoke. Air quality is unhealthy (AQI > 200) and the fire department has ordered a partial evacuation east of Kissena Boulevard.' },
  { title: 'Earthquake damage reported in Brooklyn', tags: ['earthquake','infrastructure','urban'], status: 'active',
    description: 'A magnitude 5.1 earthquake was felt strongly in Brooklyn. Residents in Williamsburg and Dumbo report cracked masonry and power outages. USGS is confirming the epicentre offshore.' },
  { title: 'Hurricane Ida remnants inundating Newark', tags: ['flood','storm','transport'], status: 'active',
    description: 'Storm remnants have pushed 8+ inches of rain onto Newark, New Jersey in six hours. NJ Transit is suspended and the Passaic river is above flood stage.' },
  { title: 'Cyclone-driven storm surge on the Miami coastline', tags: ['cyclone','storm','coastal','evacuation'], status: 'active',
    description: 'A category-2 cyclone is tracking north-west of Miami Beach, Florida. Storm surge of 2-3 metres is expected along Ocean Drive within six hours. Mandatory evacuation zone A is now active.' },
  { title: 'Monsoon flooding paralysing central Mumbai', tags: ['flood','monsoon','transport','urban'], status: 'active',
    description: 'Extreme monsoon rainfall has flooded low-lying areas of Mumbai. Chembur, Kurla and Dadar are worst affected; suburban rail is completely down; the BMC has opened 40 relief camps.' },
  { title: 'Heatwave straining the DC power grid', tags: ['heatwave','infrastructure','power-outage'], status: 'monitoring',
    description: 'A sustained heatwave is overwhelming the power grid in Washington, DC. Cooling centres are open but several are already at capacity. Pepco reports rolling brownouts in Anacostia and Capitol Hill.' },
  { title: 'Wildfire threat escalating around Los Angeles', tags: ['wildfire','air-quality','weather-advisory'], status: 'monitoring',
    description: 'Red-flag conditions across Los Angeles county. A brush fire near Griffith Park is 20% contained but a Santa Ana wind shift is expected tonight. Downtown LA remains outside the evacuation warning zone.' },
  { title: 'Aftershock watch across Kathmandu valley', tags: ['earthquake','aftershock','humanitarian'], status: 'monitoring',
    description: "Following yesterday's magnitude 6.2 quake near Kathmandu, Nepal, seismologists warn of aftershocks up to magnitude 5.5 for the next 72 hours. Field hospital operational; UN OCHA on standby." },
  { title: 'Typhoon approaching the Manila metropolitan area', tags: ['cyclone','coastal','weather-advisory'], status: 'monitoring',
    description: 'Typhoon Betty is forecast to make landfall south of Manila, Philippines within 36 hours. PAGASA has raised signal 3. Coastal rescue and shelter staging is under way.' },
  { title: 'Air-quality alert in Delhi', tags: ['air-quality','public-health'], status: 'monitoring',
    description: 'Post-harvest stubble burning has pushed Delhi AQI above 400 for a third consecutive day. Schools closed for the rest of the week.' },
  { title: 'Coastal surge flooding in Brooklyn shoreline', tags: ['flood','storm','coastal'], status: 'resolved',
    description: 'Storm surge flooded low-lying parts of Brooklyn near Red Hook. Several blocks were briefly under water and boats were used for evacuation. All residents accounted for; water has fully receded.' },
  { title: 'Ice storm knockout of the Boston power grid', tags: ['ice-storm','infrastructure','power-outage'], status: 'resolved',
    description: 'A rare ice storm in downtown Boston brought down approximately 40 km of overhead lines last week. Power has been restored to all customers and the emergency declaration is now lifted.' },
  { title: 'New Orleans levee overtopping — French Quarter', tags: ['flood','levee'], status: 'resolved',
    description: 'Levee overtopping briefly flooded parts of the French Quarter of New Orleans. The Army Corps has completed emergency reinforcement and the district is reopen to businesses.' },
  { title: 'Landslide blocking the sole road into town', tags: ['landslide','access'], status: 'resolved',
    description: 'A landslide had blocked the only road into a remote settlement. NDRF cleared the route within 18 hours and access has been restored.' },
];

async function seedUsers() {
  const map = {};
  for (const u of USERS) {
    const passwordHash = await User.hashPassword(u.password);
    const doc = await User.findOneAndUpdate(
      { username: u.username },
      { $set: { displayName: u.displayName, role: u.role, passwordHash },
        $setOnInsert: { username: u.username } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    map[u.username] = doc;
  }
  return map;
}

async function seedResources() {
  await Resource.bulkWrite(RESOURCES.map((r) => ({
    updateOne: {
      filter: { name: r.name, type: r.type },
      update: { $set: {
        location: {
          label: r.label, source: 'seeded', provider: 'seed',
          point: toGeoJSONPoint(r.lat, r.lng),
        },
        capacity: r.capacity ?? null,
        notes: r.notes ?? null,
      }},
      upsert: true,
    },
  })), { ordered: false });
}

async function seedDisasters(users) {
  const authors = [users.admin, users.contributor, users.reliefops].filter(Boolean);
  for (let i = 0; i < DISASTERS.length; i++) {
    const entry = DISASTERS[i];
    const author = authors[i % authors.length];
    const location = await resolveLocation(entry.description);
    await Disaster.findOneAndUpdate(
      { title: entry.title },
      { $set: {
          description: entry.description,
          tags: entry.tags,
          status: entry.status,
          location,
          createdBy: author._id,
        },
        $setOnInsert: { title: entry.title } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

async function main() {
  await connectDatabase();
  await syncIndexes();
  const users = await seedUsers();
  await seedResources();
  await seedDisasters(users);

  const [userCount, disasterCount, resourceCount, reportCount] = await Promise.all([
    User.countDocuments(), Disaster.countDocuments(),
    Resource.countDocuments(), Report.countDocuments(),
  ]);
  const breakdown = await Disaster.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  process.stdout.write('\nSeed complete.\n');
  process.stdout.write('--------------------------------------------------------------\n');
  process.stdout.write(`  users     : ${userCount}\n`);
  process.stdout.write(`  disasters : ${disasterCount}`);
  if (breakdown.length) process.stdout.write(`  (${breakdown.map((b) => `${b.count} ${b._id}`).join(', ')})`);
  process.stdout.write('\n');
  process.stdout.write(`  resources : ${resourceCount}\n`);
  process.stdout.write(`  reports   : ${reportCount} (fetched lazily on first read)\n\n`);
  process.stdout.write('  Demo logins:\n');
  process.stdout.write('    admin       / Admin@12345    (admin — full access)\n');
  process.stdout.write('    contributor / Contrib@12345  (contributor — create+update)\n');
  process.stdout.write('    reliefops   / Relief@12345   (contributor)\n');
  process.stdout.write('--------------------------------------------------------------\n\n');
}

main()
  .catch((err) => {
    logger.error('seed failed', { message: err.message, stack: err.stack });
    process.exitCode = 1;
  })
  .finally(async () => { await disconnectDatabase(); });
