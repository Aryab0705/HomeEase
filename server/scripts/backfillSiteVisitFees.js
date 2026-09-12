require("dotenv").config({ path: "d:/Home Ease/server/.env" });
const mongoose = require("mongoose");
const { Booking } = require("../src/models/Booking");
const { Provider } = require("../src/models/Provider");

async function backfill() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not defined in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB Atlas.");

  const rawBookings = await mongoose.connection.db.collection("bookings").find({}).toArray();
  console.log(`Found ${rawBookings.length} total bookings in raw collection.`);

  let updatedCount = 0;

  for (const b of rawBookings) {
    const fee =
      b.siteVisitFee ||
      b.consultationFee ||
      b.pricing?.consultationFee ||
      (b.totalAmount && b.totalAmount < 10000 ? b.totalAmount : 0) ||
      b.estimatedAmount ||
      0;

    const needsUpdate = (!b.siteVisitFee || b.siteVisitFee === 0) && fee > 0;

    if (needsUpdate) {
      await mongoose.connection.db.collection("bookings").updateOne(
        { _id: b._id },
        {
          $set: {
            siteVisitFee: fee,
            consultationFee: fee,
            "pricing.consultationFee": b.pricing?.consultationFee || fee,
          },
        }
      );
      updatedCount++;
      console.log(`  Updated booking ${b._id} with siteVisitFee: ₹${fee}`);
    }
  }

  console.log(`\nBackfill complete! Updated ${updatedCount} bookings.`);
  await mongoose.disconnect();
  process.exit(0);
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
